import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { clienteComo, configSupabaseLocal, unico, type UsuarioPrueba } from "./credenciales";

// Aislamiento entre escuelas por la MISMA vía que usa la app (API de
// Supabase con la clave pública + sesión del usuario), contra el Supabase
// local con las migraciones reales.

const como = (usuario: UsuarioPrueba): Promise<SupabaseClient> => clienteComo(usuario);

const nombres = (filas: { nombre: string }[] | null) => (filas ?? []).map((f) => f.nombre).sort();

test("director de A: solo ve la escuela A y sus membresías", async () => {
  const sb = await como("DIRECTOR_A");
  expect(nombres((await sb.from("escuelas").select("nombre")).data)).toEqual(["Escuela Demo A"]);
  const m = await sb.from("membresias").select("rol, escuela:escuelas!inner(nombre)");
  expect(m.error).toBeNull();
  expect(m.data).toHaveLength(2); // director + entrenador de A
  expect(JSON.stringify(m.data)).not.toContain("Escuela Demo B");
  // Pedir explícitamente la escuela B no devuelve nada.
  expect((await sb.from("escuelas").select("id").eq("nombre", "Escuela Demo B")).data).toEqual([]);
  expect((await sb.from("perfiles").select("id")).data).toHaveLength(2);
});

test("director de B: solo ve la escuela B", async () => {
  const sb = await como("DIRECTOR_B");
  expect(nombres((await sb.from("escuelas").select("nombre")).data)).toEqual(["Escuela Demo B"]);
  expect((await sb.from("membresias").select("rol")).data).toHaveLength(1);
});

test("usuario sin escuela: no ve escuelas ni membresías", async () => {
  const sb = await como("SIN_ESCUELA");
  expect((await sb.from("escuelas").select("id")).data).toEqual([]);
  expect((await sb.from("membresias").select("id")).data).toEqual([]);
});

test("desde la API nadie crea escuelas ni se da de alta como director", async () => {
  const sb = await como("SIN_ESCUELA");
  const escuela = await sb.from("escuelas").insert({ nombre: "Intrusa" });
  expect(escuela.error?.code).toBe("42501");
  const { data: a } = await (await como("DIRECTOR_A")).from("escuelas").select("id").single();
  const { data: yo } = await sb.auth.getUser();
  const alta = await sb.from("membresias").insert({ escuela_id: a!.id, usuario_id: yo.user!.id, rol: "director" });
  expect(alta.error?.code).toBe("42501");
  // El procedimiento de alta no está expuesto por la API (esquema privado).
  const rpc = await sb.rpc("crear_escuela_con_director", { p_nombre: "X", p_email_director: "x@evora.invalid" });
  expect(rpc.error).not.toBeNull();
});

test("sin sesión (solo clave pública) no se lee nada", async () => {
  const { url, clave } = configSupabaseLocal();
  const anon = createClient(url, clave, { auth: { persistSession: false } });
  const r = await anon.from("escuelas").select("id");
  expect(r.error?.code).toBe("42501");
});

// ---------------------------------------------------------------------------
// Jugadores, grupos y asignaciones (Fase 4)
// ---------------------------------------------------------------------------

async function escuelaDe(sb: SupabaseClient): Promise<string> {
  const { data, error } = await sb.from("escuelas").select("id").single();
  expect(error).toBeNull();
  return data!.id as string;
}

/** Jugador y grupo de la Escuela Demo A, creados por su director. */
async function datosDeA() {
  const sb = await como("DIRECTOR_A");
  const escuela = await escuelaDe(sb);
  const s = unico();
  const jugador = await sb.from("jugadores").insert({ escuela_id: escuela, nombre: `RLS jugador A ${s}` }).select("id").single();
  expect(jugador.error).toBeNull();
  const grupo = await sb.from("grupos").insert({ escuela_id: escuela, nombre: `RLS grupo A ${s}` }).select("id").single();
  expect(grupo.error).toBeNull();
  return { sb, escuela, jugadorId: jugador.data!.id as string, grupoId: grupo.data!.id as string };
}

test("entrenador: crea, edita y archiva jugadores y asigna, pero no crea, edita ni borra grupos", async () => {
  const a = await datosDeA();
  const sb = await como("ENTRENADOR_A");

  const nuevo = await sb.from("jugadores").insert({ escuela_id: a.escuela, nombre: `RLS entrenador ${unico()}` }).select("id").single();
  expect(nuevo.error).toBeNull();
  const archivar = await sb.from("jugadores").update({ activo: false }).eq("id", nuevo.data!.id).select("id");
  expect(archivar.data).toHaveLength(1);

  expect((await sb.from("grupos").insert({ escuela_id: a.escuela, nombre: `RLS intruso ${unico()}` })).error?.code).toBe("42501");
  expect((await sb.from("grupos").update({ nombre: "Renombrado" }).eq("id", a.grupoId).select("id")).data).toEqual([]);
  expect((await sb.from("grupos").delete().eq("id", a.grupoId).select("id")).data).toEqual([]);
  // Borrar jugadores es solo de la dirección (la app archiva, no borra).
  expect((await sb.from("jugadores").delete().eq("id", a.jugadorId).select("id")).data).toEqual([]);

  const asignar = await sb.from("grupo_jugadores").insert({ escuela_id: a.escuela, grupo_id: a.grupoId, jugador_id: a.jugadorId });
  expect(asignar.error).toBeNull();
  // Repetir la asignación no la duplica (clave primaria).
  expect((await sb.from("grupo_jugadores").insert({ escuela_id: a.escuela, grupo_id: a.grupoId, jugador_id: a.jugadorId })).error?.code).toBe("23505");
  const quitar = await sb.from("grupo_jugadores").delete().eq("grupo_id", a.grupoId).eq("jugador_id", a.jugadorId).select("jugador_id");
  expect(quitar.data).toHaveLength(1);
});

test("director de B: no ve ni toca jugadores, grupos ni asignaciones de A", async () => {
  const a = await datosDeA();
  const sb = await como("DIRECTOR_B");
  const escuelaB = await escuelaDe(sb);

  // Lectura: nada de A, ni pidiéndolo por id.
  expect((await sb.from("jugadores").select("id").eq("id", a.jugadorId)).data).toEqual([]);
  expect((await sb.from("grupos").select("id").eq("id", a.grupoId)).data).toEqual([]);
  expect((await sb.from("grupo_jugadores").select("jugador_id").eq("grupo_id", a.grupoId)).data).toEqual([]);

  // Escritura en la escuela A: RLS lo rechaza.
  expect((await sb.from("jugadores").insert({ escuela_id: a.escuela, nombre: "Intruso" })).error?.code).toBe("42501");
  expect((await sb.from("grupos").insert({ escuela_id: a.escuela, nombre: "Intruso" })).error?.code).toBe("42501");
  expect((await sb.from("jugadores").update({ nombre: "Cambiado" }).eq("id", a.jugadorId).select("id")).data).toEqual([]);
  expect((await sb.from("jugadores").update({ activo: false }).eq("id", a.jugadorId).select("id")).data).toEqual([]);
  expect((await sb.from("grupos").update({ nombre: "Cambiado" }).eq("id", a.grupoId).select("id")).data).toEqual([]);
  expect((await sb.from("grupo_jugadores").insert({ escuela_id: a.escuela, grupo_id: a.grupoId, jugador_id: a.jugadorId })).error?.code).toBe("42501");

  // Mezclar escuelas: un jugador de B en un grupo de A (con la escuela de B) lo
  // impide la clave foránea compuesta.
  const propio = await sb.from("jugadores").insert({ escuela_id: escuelaB, nombre: `RLS jugador B ${unico()}` }).select("id").single();
  expect(propio.error).toBeNull();
  const mezcla = await sb.from("grupo_jugadores").insert({ escuela_id: escuelaB, grupo_id: a.grupoId, jugador_id: propio.data!.id });
  expect(mezcla.error?.code).toBe("23503");

  // Nada ha cambiado en A.
  const { data } = await a.sb.from("jugadores").select("nombre, activo").eq("id", a.jugadorId).single();
  expect(data).toMatchObject({ activo: true });
  expect(data!.nombre).toMatch(/^RLS jugador A /);
});

test("el entrenador de un grupo tiene que ser de la misma escuela", async () => {
  const a = await datosDeA();
  const b = await como("DIRECTOR_B");
  const { data: yoB } = await b.auth.getUser();
  const r = await a.sb.from("grupos").update({ entrenador_id: yoB.user!.id }).eq("id", a.grupoId).select("id");
  expect(r.error?.code).toBe("23503");
});

test("nombre de grupo único por escuela (sin distinguir mayúsculas)", async () => {
  const a = await datosDeA();
  const { data } = await a.sb.from("grupos").select("nombre").eq("id", a.grupoId).single();
  const repetido = await a.sb.from("grupos").insert({ escuela_id: a.escuela, nombre: ` ${data!.nombre.toUpperCase()} ` });
  expect(repetido.error?.code).toBe("23505");
  // En otra escuela sí se puede usar el mismo nombre.
  const b = await como("DIRECTOR_B");
  const enB = await b.from("grupos").insert({ escuela_id: await escuelaDe(b), nombre: data!.nombre });
  expect(enB.error).toBeNull();
});
