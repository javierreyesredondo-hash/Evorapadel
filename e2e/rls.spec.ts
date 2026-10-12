import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { configSupabaseLocal, credenciales, type UsuarioPrueba } from "./credenciales";

// Aislamiento entre escuelas por la MISMA vía que usa la app (API de
// Supabase con la clave pública + sesión del usuario), contra el Supabase
// local con las migraciones reales.

async function como(usuario: UsuarioPrueba): Promise<SupabaseClient> {
  const { url, clave } = configSupabaseLocal();
  const cliente = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  const { email, contrasena } = credenciales(usuario);
  const { error } = await cliente.auth.signInWithPassword({ email, password: contrasena });
  expect(error).toBeNull();
  return cliente;
}

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
