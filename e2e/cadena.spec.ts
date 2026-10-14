import type { Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "./fixtures";
import { clienteComo, credenciales, unico, type UsuarioPrueba } from "./credenciales";
import { leerPdf } from "./pdf";

// Evaluación rápida en cadena de un grupo y propuesta automática de informe,
// contra el Supabase local con datos SINTÉTICOS. Cada prueba crea su propio
// grupo (las pruebas corren en paralelo sobre la misma base de datos).

async function entrar(page: Page, usuario: UsuarioPrueba) {
  const { email, contrasena } = credenciales(usuario);
  await page.goto("/acceso");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(contrasena);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("region", { name: "Tu escuela" })).toBeVisible();
}

const visible = (page: Page, texto: string | RegExp) => page.getByText(texto).filter({ visible: true });
const aviso = (page: Page) => page.locator('[data-prueba="aviso-guardado"]');
const nota = (page: Page, competencia: string, n: number) => page.getByRole("radio", { name: new RegExp(`^${competencia}: ${n} `) });
const guardar = (page: Page) => page.getByRole("button", { name: /^(Guardar evaluación|Reintentar)$/ });

type Grupo = { sb: SupabaseClient; escuela: string; id: string; nombre: string; jugadores: { id: string; nombre: string }[] };

/** Grupo con jugadores (nombres en orden alfabético) en la escuela del director, entrenado por `entrenador`. */
async function grupo(director: UsuarioPrueba, nombres: string[], entrenador?: UsuarioPrueba): Promise<Grupo> {
  const sb = await clienteComo(director);
  const s = unico();
  const { data: esc } = await sb.from("escuelas").select("id").single();
  const escuela = esc!.id as string;
  const entrenadorId = entrenador ? (await (await clienteComo(entrenador)).auth.getUser()).data.user!.id : null;
  const g = await sb.from("grupos").insert({ escuela_id: escuela, nombre: `Cadena ${s}`, entrenador_id: entrenadorId }).select("id, nombre").single();
  expect(g.error).toBeNull();
  const jugadores = [];
  for (const n of nombres) {
    const j = await sb.from("jugadores").insert({ escuela_id: escuela, nombre: `${n} ${s}` }).select("id, nombre").single();
    await sb.from("grupo_jugadores").insert({ escuela_id: escuela, grupo_id: g.data!.id, jugador_id: j.data!.id });
    jugadores.push(j.data!);
  }
  return { sb, escuela, id: g.data!.id, nombre: g.data!.nombre, jugadores };
}

/** Puntúa las competencias indicadas (nombre → nota). */
async function puntuar(page: Page, notas: Record<string, number>) {
  for (const [c, n] of Object.entries(notas)) await nota(page, c, n).check();
}

const BASE = ["Golpes de fondo", "Juego en la red", "Juego aéreo", "Lectura táctica", "Condición física", "Fortaleza mental"];
const todas = (valores: number[]) => Object.fromEntries(BASE.map((c, i) => [c, valores[i]]));

test.describe("Evaluación en cadena", () => {
  test("el entrenador evalúa su grupo en cadena: guarda, avanza, sale y vuelve sin perder nada", async ({ page }) => {
    test.setTimeout(120_000);
    const g = await grupo("DIRECTOR_A", ["Ana", "Bea", "Carla"], "ENTRENADOR_A");
    const [ana, bea, carla] = g.jugadores;

    await entrar(page, "ENTRENADOR_A");
    await page.goto("/entrenamiento");
    await page.getByRole("link", { name: `Evaluar el grupo ${g.nombre}` }).click();
    await expect(page).toHaveURL(new RegExp(`/entrenamiento/evaluar/${g.id}`));
    await expect(visible(page, "Evaluados hoy: 0 de 3")).toBeVisible();
    await expect(page.getByRole("heading", { name: ana.nombre })).toBeVisible();

    // Ana: perfil diferenciado. La propuesta usa las competencias y la escala reales.
    await puntuar(page, todas([5, 2, 3, 3, 3, 2]));
    await page.getByLabel("Observaciones del entrenador/a").fill("Buena sesión sintética en Golpes de fondo.");
    await page.getByLabel("Objetivo de trabajo").fill("Juego en la red: diez voleas seguidas");
    const fortalezas = page.getByLabel(/^Fortalezas/);
    await expect(fortalezas).toHaveValue(/• Golpes de fondo \(5 · Excelente\)/);
    await expect(page.getByLabel(/^Aspectos a mejorar/)).toHaveValue(/• Juego en la red \(2 · En desarrollo\)/);
    const interpretacion = page.getByLabel(/^Interpretación técnica/);
    await expect(interpretacion).toHaveValue(/se centra en Juego en la red, coherente con los aspectos a mejorar/);
    // El entrenador corrige la interpretación: se respeta y deja de cambiar sola.
    await interpretacion.fill(`${await interpretacion.inputValue()} Revisado por el entrenador.`);
    await expect(page.getByText("editado por ti")).toBeVisible();
    await nota(page, "Condición física", 4).check();
    await expect(interpretacion).toHaveValue(/Revisado por el entrenador\.$/);

    await guardar(page).click();
    await expect(page.getByRole("heading", { name: "✓ Guardada" })).toBeVisible();
    await expect(aviso(page)).toHaveText(`Evaluación de ${ana.nombre} guardada.`);
    await page.getByRole("button", { name: `Siguiente: ${bea.nombre}` }).click();
    await expect(visible(page, "Evaluados hoy: 1 de 3")).toBeVisible();
    await expect(page.getByRole("heading", { name: bea.nombre })).toBeVisible();

    // Bea: otro perfil, otra redacción. Sin observaciones ni objetivo (no son obligatorios).
    await puntuar(page, todas([2, 4, 4, 5, 4, 4]));
    await expect(page.getByLabel(/^Fortalezas/)).toHaveValue(/Lectura táctica \(5 · Excelente\)/);
    await guardar(page).click();
    await expect(page.getByRole("heading", { name: "✓ Guardada" })).toBeVisible();

    // Salir y volver: lo guardado sigue ahí y se continúa por el siguiente pendiente.
    await page.goto("/entrenamiento");
    await page.getByRole("link", { name: `Evaluar el grupo ${g.nombre}` }).click();
    await expect(visible(page, "Evaluados hoy: 2 de 3")).toBeVisible();
    await expect(page.getByRole("heading", { name: carla.nombre })).toBeVisible();
    await puntuar(page, { "Golpes de fondo": 3 });
    await expect(visible(page, /Propuesta provisional/).first()).toBeVisible();
    await expect(page.getByLabel(/^Fortalezas/)).toHaveValue(""); // no se inventan fortalezas con 1 nota
    await guardar(page).click();
    await page.getByRole("button", { name: "Terminar el grupo" }).click();
    await expect(page.getByRole("heading", { name: "Grupo evaluado" })).toBeVisible();
    await expect(visible(page, "Evaluados hoy: 3 de 3")).toBeVisible();

    // Base de datos: una evaluación por jugador, con su grupo, su redacción y la propuesta mostrada.
    const { data: evs } = await g.sb
      .from("evaluaciones")
      .select("id, jugador_id, tipo, fortalezas, interpretacion, observaciones, evaluacion_objetivos(descripcion), evaluacion_redacciones(version, propuesta)")
      .eq("grupo_id", g.id);
    expect(evs).toHaveLength(3);
    const de = (id: string) => evs!.find((e) => e.jugador_id === id)!;
    expect(de(ana.id).tipo).toBe("completa");
    expect(de(carla.id).tipo).toBe("rapida");
    expect(de(ana.id).interpretacion).toMatch(/Revisado por el entrenador\.$/);
    expect(de(ana.id).observaciones).toBe("Buena sesión sintética en Golpes de fondo.");
    expect(de(ana.id).evaluacion_objetivos).toEqual([{ descripcion: "Juego en la red: diez voleas seguidas" }]);
    expect(de(ana.id).fortalezas).not.toBe(de(bea.id).fortalezas);
    expect(de(ana.id).evaluacion_redacciones).toHaveLength(1);
    expect((de(ana.id).evaluacion_redacciones as { propuesta: { interpretacion: string } }[])[0].propuesta.interpretacion).not.toMatch(/Revisado por el entrenador/);

    // Informe y PDF: fortalezas, aspectos a mejorar, interpretación, objetivo y observaciones, con su origen.
    await page.goto(`/evaluaciones/${de(ana.id).id}`);
    for (const t of ["Fortalezas", "Aspectos a mejorar", "Interpretación técnica", "Revisado por el entrenador.", "Juego en la red: diez voleas seguidas"]) {
      await expect(visible(page, t).first()).toBeVisible();
    }
    await expect(visible(page, /propuestos automáticamente a partir de las puntuaciones y revisados por el entrenador\/a/)).toBeVisible();
    const { texto } = await leerPdf(await (await page.request.get(`/evaluaciones/${de(ana.id).id}/pdf`)).body());
    const seguido = texto.replace(/\s+/g, " ");
    for (const t of ["INTERPRETACIÓN TÉCNICA", "ASPECTOS A MEJORAR", "Revisado por el entrenador.", "Buena sesión sintética en Golpes de fondo."]) expect(seguido).toContain(t);
  });

  test("sin duplicados: doble pulsación, error de red con reintento y respuesta perdida", async ({ page }) => {
    test.info().annotations.push({ type: "error-consola-esperado", description: "Failed to fetch" });
    test.info().annotations.push({ type: "error-consola-esperado", description: "net::ERR_FAILED" });
    test.setTimeout(90_000);
    const g = await grupo("DIRECTOR_A", ["Dani", "Eva", "Fran"]);
    const [dani, eva, fran] = g.jugadores;
    await entrar(page, "DIRECTOR_A");
    const cuenta = async (jugadorId: string) =>
      (await g.sb.from("evaluaciones").select("id", { count: "exact", head: true }).eq("jugador_id", jugadorId)).count;

    // Doble pulsación: una sola evaluación.
    await page.goto(`/entrenamiento/evaluar/${g.id}`);
    await puntuar(page, todas([3, 3, 4, 2, 3, 3]));
    await guardar(page).dblclick();
    await expect(page.getByRole("heading", { name: "✓ Guardada" })).toBeVisible();
    expect(await cuenta(dani.id)).toBe(1);

    // Error de red antes de llegar al servidor: los datos siguen y «Reintentar» guarda una vez.
    await page.goto(`/entrenamiento/evaluar/${g.id}?jugador=${eva.id}`);
    await puntuar(page, todas([4, 4, 4, 4, 4, 4]));
    await page.getByLabel("Observaciones del entrenador/a").fill("Texto que no se pierde");
    let cortar = true;
    await page.route(`**/entrenamiento/evaluar/${g.id}**`, async (r) => {
      if (r.request().method() === "POST" && cortar) {
        cortar = false;
        return r.abort("failed");
      }
      return r.continue();
    });
    await guardar(page).click();
    await expect(visible(page, /No se ha podido conectar\. La evaluación todavía no se ha guardado/)).toBeVisible();
    await expect(page.getByLabel("Observaciones del entrenador/a")).toHaveValue("Texto que no se pierde");
    expect(await cuenta(eva.id)).toBe(0);
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByRole("heading", { name: "✓ Guardada" })).toBeVisible();
    expect(await cuenta(eva.id)).toBe(1);
    await page.unrouteAll({ behavior: "wait" });

    // Respuesta perdida (el servidor SÍ guardó): el reintento usa el mismo envío y no duplica.
    await page.goto(`/entrenamiento/evaluar/${g.id}?jugador=${fran.id}`);
    await puntuar(page, todas([2, 3, 3, 3, 3, 3]));
    let perder = true;
    await page.route(`**/entrenamiento/evaluar/${g.id}**`, async (r) => {
      if (r.request().method() === "POST" && perder) {
        perder = false;
        await r.fetch(); // llega al servidor
        return r.abort("failed"); // pero la respuesta no vuelve
      }
      return r.continue();
    });
    await guardar(page).click();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    expect(await cuenta(fran.id)).toBe(1);
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByRole("heading", { name: "✓ Guardada" })).toBeVisible();
    expect(await cuenta(fran.id)).toBe(1);
    await page.unrouteAll({ behavior: "wait" });

    // Volver a un jugador ya evaluado: se muestra la evaluación, sin formulario para duplicarla.
    await page.goto(`/entrenamiento/evaluar/${g.id}?jugador=${dani.id}`);
    await expect(visible(page, /Ya tiene una evaluación de hoy en este grupo/)).toBeVisible();
    await expect(guardar(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Editar evaluación" })).toBeVisible();
    expect(await cuenta(dani.id)).toBe(1);
  });

  test("si otra persona ya lo evaluó hoy, no se sobrescribe: se ofrece verla", async ({ page }) => {
    const g = await grupo("DIRECTOR_A", ["Gala"]);
    const [gala] = g.jugadores;
    await entrar(page, "ENTRENADOR_A");
    await page.goto(`/entrenamiento/evaluar/${g.id}`);
    await puntuar(page, todas([3, 3, 3, 3, 3, 3]));
    // Mientras tanto, la dirección guarda otra evaluación de hoy para el mismo jugador y grupo.
    const { data: comps } = await g.sb.from("competencias").select("id").eq("activa", true).limit(1);
    const { error } = await g.sb.rpc("guardar_evaluacion", {
      p_escuela: g.escuela, p_id: null, p_clave_envio: crypto.randomUUID(), p_jugador: gala.id, p_grupo: g.id, p_tipo: "rapida",
      p_fecha: new Date().toISOString().slice(0, 10), p_titulo: null, p_fortalezas: "De la dirección", p_mejoras: null,
      p_observaciones: null, p_puntuaciones: [{ competencia: comps![0].id, puntuacion: 4 }], p_objetivos: [],
    });
    expect(error).toBeNull();
    await guardar(page).click();
    await expect(visible(page, "Este jugador ya tiene una evaluación de hoy en este grupo.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver la evaluación de hoy" })).toBeVisible();
    const { data } = await g.sb.from("evaluaciones").select("fortalezas").eq("jugador_id", gala.id);
    expect(data).toEqual([{ fortalezas: "De la dirección" }]);

    // Al recargar, el entrenador la ve pero no puede editar la de la dirección.
    await page.goto(`/entrenamiento/evaluar/${g.id}`);
    await expect(page.getByRole("heading", { name: "Grupo evaluado" })).toBeVisible();
    await page.goto(`/entrenamiento/evaluar/${g.id}?jugador=${gala.id}`);
    await expect(page.getByRole("link", { name: "Ver evaluación" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar evaluación" })).toHaveCount(0);
  });

  test("editar conserva la redacción anterior: el informe no cambia en silencio", async ({ page }) => {
    const g = await grupo("DIRECTOR_A", ["Hugo"]);
    await entrar(page, "DIRECTOR_A");
    await page.goto(`/entrenamiento/evaluar/${g.id}`);
    await puntuar(page, todas([4, 2, 3, 3, 3, 3]));
    const original = await page.getByLabel(/^Fortalezas/).inputValue();
    await guardar(page).click();
    await page.getByRole("link", { name: "Ver evaluación e informe" }).click();
    await page.getByRole("link", { name: "Editar evaluación" }).click();
    // Al editar, lo guardado se respeta (no se regenera solo).
    await expect(page.getByLabel(/^Fortalezas/)).toHaveValue(original);
    await page.getByLabel(/^Fortalezas/).fill("Fortaleza corregida al revisar.");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(aviso(page)).toHaveText("Evaluación actualizada.");
    await expect(visible(page, "Fortaleza corregida al revisar.").first()).toBeVisible();
    await page.getByRole("heading", { name: "Versiones anteriores de la redacción" }).waitFor();
    await page.getByText("Versión 1").click();
    await expect(visible(page, original.split("\n")[1])).toBeVisible();
    const { data } = await g.sb.from("evaluacion_redacciones").select("version, fortalezas").order("version").eq("evaluacion_id", page.url().split("/").pop()!);
    expect(data!.map((v) => v.version)).toEqual([1, 2]);
    expect(data![0].fortalezas).toBe(original);
  });

  test("otra escuela no abre el grupo y un grupo inexistente da 404", async ({ page }) => {
    const g = await grupo("DIRECTOR_A", ["Iris"]);
    await entrar(page, "DIRECTOR_B");
    await page.goto(`/entrenamiento/evaluar/${g.id}`);
    await expect(page.getByRole("heading", { name: "Grupo no encontrado" })).toBeVisible();
    await expect(visible(page, g.jugadores[0].nombre)).toHaveCount(0);
    test.info().annotations.push({ type: "error-consola-esperado", description: "status of 404" });
    const r = await page.goto("/entrenamiento/evaluar/no-es-un-grupo");
    expect(r?.status()).toBe(404);
  });
});

test.describe("Evaluación en cadena con una metodología importada", () => {
  test("usa las competencias, la escala y las descripciones de la metodología activa", async ({ page }) => {
    // Escuela E (solo estas pruebas): metodología sintética activada por la API de la dirección.
    const sb = await clienteComo("DIRECTOR_E");
    const { data: esc } = await sb.from("escuelas").select("id").single();
    const version = `${Date.now() % 100000}.${Math.floor(Math.random() * 1000)}`;
    const contenido = {
      textos: [], fases: [], principios: [], fichas: [],
      escala: [
        { valor: 1, nombre: "Inicial", descripcion: "Necesita ayuda constante." },
        { valor: 2, nombre: "En desarrollo", descripcion: "Puede ejecutarla parcialmente, pero es irregular." },
        { valor: 3, nombre: "Funcional", descripcion: "La utiliza correctamente en situaciones conocidas." },
        { valor: 4, nombre: "Avanzado", descripcion: "La utiliza con autonomía." },
        { valor: 5, nombre: "Dominio", descripcion: "La utiliza de forma automática." },
      ],
      competencias: [
        { nombre: "Técnica", grupo: "Criterios", descripcion: "Estabilidad sintética de la ejecución.", puntuable: true, evaluable: true, origen: "tabla", pagina: 4 },
        { nombre: "Paciencia", grupo: "Criterios", descripcion: "Saber esperar en la prueba.", puntuable: true, evaluable: true, origen: "tabla", pagina: 4 },
        { nombre: "Defensa", grupo: "Criterios", descripcion: "Controlar el punto en la prueba.", puntuable: true, evaluable: true, origen: "tabla", pagina: 4 },
        { nombre: "Posición de espera", grupo: "Desplazamiento", descripcion: "", puntuable: false, evaluable: false, origen: "Ficha 02", pagina: 6 },
      ],
    };
    const m = await sb.from("metodologias").insert({ escuela_id: esc!.id, nombre: "Método Sintético", version, contenido }).select("id").single();
    expect(m.error).toBeNull();
    expect((await sb.from("metodologias").update({ estado: "activa" }).eq("id", m.data!.id)).error).toBeNull();
    const g = await grupo("DIRECTOR_E", ["Julia"]);

    await entrar(page, "DIRECTOR_E");
    await page.goto(`/entrenamiento/evaluar/${g.id}`);
    await expect(visible(page, `Método Sintético · v${version}`)).toBeVisible();
    // Solo las competencias evaluables (el indicador sin escala no se puntúa).
    await expect(page.getByRole("radiogroup")).toHaveCount(3);
    await expect(page.getByRole("radiogroup", { name: "Posición de espera" })).toHaveCount(0);
    await puntuar(page, { "Técnica": 4, "Paciencia": 2, "Defensa": 3 });
    await expect(page.getByRole("radio", { name: "Paciencia: 2 (En desarrollo)" })).toBeChecked();
    await expect(page.getByLabel(/^Fortalezas/)).toHaveValue(/• Técnica \(4 · Avanzado\): la utiliza con autonomía\./);
    await expect(page.getByLabel(/^Aspectos a mejorar/)).toHaveValue(
      /• Paciencia \(2 · En desarrollo\): puede ejecutarla parcialmente, pero es irregular\. Criterio de la metodología: Saber esperar en la prueba\./,
    );
    await guardar(page).click();
    await expect(page.getByRole("heading", { name: "✓ Guardada" })).toBeVisible();
    const { data } = await g.sb.from("evaluaciones").select("metodologia_id, tipo").eq("grupo_id", g.id).single();
    expect(data).toEqual({ metodologia_id: m.data!.id, tipo: "completa" });
  });
});
