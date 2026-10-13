import type { Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "./fixtures";
import { clienteComo, credenciales, unico, type UsuarioPrueba } from "./credenciales";
import { leerPdf } from "./pdf";

// Evaluaciones REALES e informes PDF contra el Supabase local (migraciones
// reales + RLS) con usuarios, escuelas y jugadores SINTÉTICOS. Nombres únicos:
// las pruebas corren en paralelo sobre la misma base de datos.
// Con Cache Components, Next conserva ocultas las pantallas visitadas: los
// textos se buscan entre lo visible.

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
const URL_EVALUACION = /\/evaluaciones\/[0-9a-f-]{36}$/;

type Escenario = {
  sb: SupabaseClient;
  escuela: string;
  jugador: { id: string; nombre: string };
  grupo: { id: string; nombre: string };
  competencias: { id: string; nombre: string }[];
};

/** Jugador con grupo en la escuela del director indicado, creado por la API (como haría la app). */
async function escenario(director: "DIRECTOR_A" | "DIRECTOR_B", prefijo = "Jugador Eval"): Promise<Escenario> {
  const sb = await clienteComo(director);
  const s = unico();
  const { data: esc } = await sb.from("escuelas").select("id").single();
  const escuela = esc!.id as string;
  const jugador = await sb.from("jugadores").insert({ escuela_id: escuela, nombre: `${prefijo} ${s}`, nivel: "avanzado" }).select("id, nombre").single();
  const grupo = await sb.from("grupos").insert({ escuela_id: escuela, nombre: `Grupo Eval ${s}` }).select("id, nombre").single();
  await sb.from("grupo_jugadores").insert({ escuela_id: escuela, grupo_id: grupo.data!.id, jugador_id: jugador.data!.id });
  const { data: comps } = await sb.from("competencias").select("id, nombre").eq("activa", true).order("orden");
  return { sb, escuela, jugador: jugador.data!, grupo: grupo.data!, competencias: comps ?? [] };
}

/** Evaluación guardada con la misma función que usa la app (guardar_evaluacion). */
async function evaluacionApi(
  sb: SupabaseClient,
  e: Escenario,
  notas: number[],
  extra: Partial<{ tipo: "rapida" | "completa"; fecha: string; observaciones: string; fortalezas: string; mejoras: string; objetivos: { descripcion: string; plazo: string | null }[] }> = {},
) {
  const { data, error } = await sb.rpc("guardar_evaluacion", {
    p_escuela: e.escuela,
    p_id: null,
    p_clave_envio: crypto.randomUUID(),
    p_jugador: e.jugador.id,
    p_grupo: e.grupo.id,
    p_tipo: extra.tipo ?? "completa",
    p_fecha: extra.fecha ?? new Date().toISOString().slice(0, 10),
    p_titulo: null,
    p_fortalezas: extra.fortalezas ?? null,
    p_mejoras: extra.mejoras ?? null,
    p_observaciones: extra.observaciones ?? null,
    p_puntuaciones: notas.map((n, i) => ({ competencia: e.competencias[i].id, puntuacion: n })),
    p_objetivos: extra.objetivos ?? [],
  });
  expect(error).toBeNull();
  return data as string;
}

const nota = (page: Page, competencia: string, n: number) => page.getByRole("radio", { name: new RegExp(`^${competencia}: ${n} `) });

test.describe("Evaluaciones reales", () => {
  test("entrenador: evaluación rápida desde la ficha, con validación, detalle e historial", async ({ page }) => {
    const e = await escenario("DIRECTOR_A");
    await entrar(page, "ENTRENADOR_A");
    await page.goto(`/jugadores/${e.jugador.id}`);
    await page.getByRole("link", { name: "Evaluación rápida" }).click();
    await expect(page).toHaveURL(/\/evaluaciones\/nueva\?jugador=.*tipo=rapida/);
    await expect(page.getByLabel("Jugador", { exact: true })).toHaveValue(e.jugador.id);
    await expect(page.getByLabel("Grupo", { exact: true })).toHaveValue(e.grupo.id);

    // Sin notas: error claro y no se guarda nada.
    await page.getByRole("button", { name: "Guardar evaluación" }).click();
    await expect(visible(page, "Puntúa al menos una competencia.")).toBeVisible();
    await expect(page).toHaveURL(/\/evaluaciones\/nueva/);

    await nota(page, "Golpes de fondo", 4).check();
    await nota(page, "Lectura táctica", 3).check();
    await page.getByLabel("Fortalezas detectadas (opcional)").fill("Buena lectura del juego en defensa.");
    await page.getByLabel("Áreas prioritarias de mejora (opcional)").fill("Volea de revés.");
    await page.getByLabel("Observaciones del entrenador/a (opcional)").fill("Sesión de prueba sintética.");
    await page.getByLabel("Objetivo 1").fill("Diez voleas seguidas sin error");
    await page.getByLabel("Plazo (opcional)").fill("2099-01-31");
    await page.getByRole("button", { name: "Guardar evaluación" }).click();

    await expect(page).toHaveURL(URL_EVALUACION);
    await expect(aviso(page)).toHaveText("Evaluación guardada.");
    await expect(page.getByRole("heading", { level: 1, name: e.jugador.nombre })).toBeVisible();
    for (const t of ["Media 3,5 / 5 · 2 competencias evaluadas", "4 · Avanzado", "3 · Competente", "Buena lectura del juego en defensa.", "Volea de revés.", "Diez voleas seguidas sin error", "Plazo: 31 ene 2099", "Sesión de prueba sintética.", e.grupo.nombre]) {
      await expect(visible(page, t).first()).toBeVisible();
    }
    await expect(visible(page, /Todavía no hay historial suficiente/)).toBeVisible();

    await page.getByRole("link", { name: new RegExp(`Ver la ficha y el historial de ${e.jugador.nombre}`) }).click();
    await expect(page.getByRole("list", { name: "Historial de evaluaciones" }).getByRole("link")).toHaveCount(1);
  });

  test("completa: exige todas las competencias y compara con la anterior sin inventar", async ({ page }) => {
    const e = await escenario("DIRECTOR_A");
    // Una completa anterior (junio) y una rápida que no debe usarse para comparar.
    await evaluacionApi(e.sb, e, [2, 2, 3, 3, 4, 4], { fecha: "2026-06-01" });
    await evaluacionApi(e.sb, e, [5], { tipo: "rapida", fecha: "2026-07-01" });

    await entrar(page, "DIRECTOR_A");
    await page.goto(`/evaluaciones/nueva?jugador=${e.jugador.id}&tipo=completa`);
    await nota(page, "Golpes de fondo", 3).check();
    await page.getByRole("button", { name: "Guardar evaluación" }).click();
    await expect(visible(page, "Puntúa esta competencia: la evaluación completa las incluye todas.").first()).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Juego en la red" })).toHaveAttribute("aria-invalid", "true");

    const nuevas = [3, 3, 3, 3, 4, 5];
    for (const [i, c] of e.competencias.entries()) await nota(page, c.nombre, nuevas[i]).check();
    await page.getByRole("button", { name: "Guardar evaluación" }).click();
    await expect(page).toHaveURL(URL_EVALUACION);
    await expect(visible(page, /Comparación con la evaluación anterior del mismo tipo \(1 jun 2026\)/)).toBeVisible();
    const tabla = page.getByRole("table", { name: "Evolución por competencia" });
    await expect(tabla.getByRole("row")).toHaveCount(7); // cabecera + 6
    await expect(tabla.getByRole("row", { name: /Golpes de fondo 2 3 \+1/ })).toBeVisible();
    await expect(tabla.getByRole("row", { name: /Condición física 4 4 =/ })).toBeVisible();
    await expect(visible(page, "Media de las competencias comparadas: de 3,0 a 3,5.")).toBeVisible();
  });

  test("editar según permisos: autor y dirección sí; otro rol no, ni manipulando el formulario", async ({ page, browser }) => {
    const e = await escenario("DIRECTOR_A");
    const entrenador = await clienteComo("ENTRENADOR_A");
    const propia = await evaluacionApi(entrenador, e, [3], { tipo: "rapida", observaciones: "Original del entrenador" });
    const deDireccion = await evaluacionApi(e.sb, e, [4], { tipo: "rapida", observaciones: "Original de la dirección" });

    // El entrenador edita la suya.
    await entrar(page, "ENTRENADOR_A");
    await page.goto(`/evaluaciones/${propia}`);
    await page.getByRole("link", { name: "Editar" }).click();
    await expect(page.getByLabel("Observaciones del entrenador/a (opcional)")).toHaveValue("Original del entrenador");
    await page.getByLabel("Observaciones del entrenador/a (opcional)").fill("Corregida por el entrenador");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page).toHaveURL(new RegExp(`/evaluaciones/${propia}$`));
    await expect(aviso(page)).toHaveText("Evaluación actualizada.");
    await expect(visible(page, "Corregida por el entrenador")).toBeVisible();

    // La de la dirección: sin botón, sin formulario y sin poder colarla cambiando el id oculto.
    await page.goto(`/evaluaciones/${deDireccion}`);
    await expect(page.getByRole("heading", { level: 1, name: e.jugador.nombre })).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
    await page.goto(`/evaluaciones/${deDireccion}/editar`);
    await expect(visible(page, "Solo quien hizo la evaluación o la dirección pueden editarla.")).toBeVisible();
    await page.goto(`/evaluaciones/${propia}/editar`);
    await page.getByLabel("Observaciones del entrenador/a (opcional)").fill("Intento de manipulación");
    // Justo antes de enviar (React restablece los campos al volver a pintar).
    await page.locator('input[name="id"]').evaluate((el: HTMLInputElement, id) => (el.value = id), deDireccion);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Solo quien hizo la evaluación o la dirección pueden editarla." })).toBeVisible();
    const { data } = await e.sb.from("evaluaciones").select("observaciones").eq("id", deDireccion).single();
    expect(data!.observaciones).toBe("Original de la dirección");

    // La dirección sí edita la del entrenador.
    const director = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const pd = await director.newPage();
    await entrar(pd, "DIRECTOR_A");
    await pd.goto(`/evaluaciones/${propia}/editar`);
    await pd.getByLabel("Observaciones del entrenador/a (opcional)").fill("Revisada por la dirección");
    await pd.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(aviso(pd)).toHaveText("Evaluación actualizada.");
    await director.close();
  });

  test("manipular identificadores al crear: jugador, notas y grupo ajenos; doble envío", async ({ page }) => {
    const a = await escenario("DIRECTOR_A");
    const b = await escenario("DIRECTOR_B", "Jugador Ajeno");
    await entrar(page, "DIRECTOR_A");

    // Jugador de otra escuela en el desplegable.
    await page.goto("/evaluaciones/nueva");
    await nota(page, "Golpes de fondo", 3).check();
    // Las manipulaciones, justo antes de enviar (React restablece los campos al volver a pintar).
    await page.getByLabel("Jugador", { exact: true }).evaluate((el: HTMLSelectElement, id) => {
      el.add(new Option("Colado", id));
      el.value = id;
    }, b.jugador.id);
    await page.getByRole("button", { name: "Guardar evaluación" }).click();
    await expect(visible(page, "Elige un jugador de tu escuela.")).toBeVisible();

    // Grupo al que el jugador no pertenece (el de B) y nota de una competencia de B.
    await page.goto(`/evaluaciones/nueva?jugador=${a.jugador.id}`);
    await nota(page, "Golpes de fondo", 3).check();
    await page.getByLabel("Grupo", { exact: true }).evaluate((el: HTMLSelectElement, id) => {
      el.add(new Option("Ajeno", id));
      el.value = id;
    }, b.grupo.id);
    await page.getByRole("button", { name: "Guardar evaluación" }).click();
    await expect(visible(page, "El jugador no pertenece a ese grupo.")).toBeVisible();

    await page.getByLabel("Grupo", { exact: true }).selectOption(a.grupo.id);
    const marca = `Doble envío ${unico()}`;
    await page.getByLabel("Observaciones del entrenador/a (opcional)").fill(marca);
    await page.locator("form").filter({ has: page.getByLabel("Grupo", { exact: true }) }).evaluate((form, id) => {
      const campo = document.createElement("input");
      campo.type = "hidden";
      campo.name = `nota_${id}`;
      campo.value = "5";
      form.appendChild(campo);
    }, b.competencias[0].id);
    await page.getByRole("button", { name: "Guardar evaluación" }).dblclick();
    await expect(page).toHaveURL(URL_EVALUACION);
    const { data } = await a.sb.from("evaluaciones").select("id, evaluacion_puntuaciones(competencia_id)").eq("observaciones", marca);
    expect(data).toHaveLength(1);
    expect(data![0].evaluacion_puntuaciones).toEqual([{ competencia_id: a.competencias[0].id }]);
  });
});

test.describe("Informes PDF", () => {
  test("PDF con los datos guardados, solo de la propia escuela", async ({ page }) => {
    const a = await escenario("DIRECTOR_A", "Jugadora Informe");
    const b = await escenario("DIRECTOR_B", "Jugador Secreto B");
    const idA = await evaluacionApi(a.sb, a, [4, 3, 5, 2, 3, 4], {
      fortalezas: "Fortaleza sintética A",
      mejoras: "Mejora sintética A",
      observaciones: "Observación sintética A",
      objetivos: [{ descripcion: "Objetivo sintético A", plazo: "2099-03-01" }],
    });
    const idB = await evaluacionApi(b.sb, b, [1], { tipo: "rapida", observaciones: "Observación secreta B" });

    await entrar(page, "DIRECTOR_A");
    const r = await page.request.get(`/evaluaciones/${idA}/pdf`);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toBe("application/pdf");
    expect(r.headers()["cache-control"]).toContain("no-store");
    expect(r.headers()["content-disposition"]).toMatch(/^inline; filename="informe-jugadora-informe-[a-z0-9-]+\.pdf"/);
    const { texto, paginas } = await leerPdf(await r.body());
    expect(paginas).toBeGreaterThanOrEqual(1);
    for (const t of [a.jugador.nombre, "Escuela Demo A", a.grupo.nombre, "Evaluación completa", "Media 3,5 / 5", "Golpes de fondo", "4 · Avanzado", "Fortaleza sintética A", "Mejora sintética A", "Objetivo sintético A", "Plazo: 1 mar 2099", "Observación sintética A", "Equipo técnico de la escuela", "Observa. Mide. Haz crecer."]) {
      expect(texto, `el PDF debe contener «${t}»`).toContain(t);
    }
    for (const ajeno of ["Escuela Demo B", b.jugador.nombre, "Observación secreta B", b.grupo.nombre]) {
      expect(texto, `el PDF no debe contener «${ajeno}»`).not.toContain(ajeno);
    }

    // La evaluación de B, pedida por A: 404, igual que si no existiera.
    expect((await page.request.get(`/evaluaciones/${idB}/pdf`)).status()).toBe(404);
    expect((await page.request.get(`/evaluaciones/${crypto.randomUUID()}/pdf`)).status()).toBe(404);
    for (const ruta of [`/evaluaciones/${idB}`, `/evaluaciones/${idB}/informe`, `/evaluaciones/${idB}/editar`]) {
      await page.goto(ruta);
      await expect(page.getByRole("heading", { level: 1, name: "Evaluación no encontrada" })).toBeVisible();
      await expect(page.getByText("Observación secreta B")).toHaveCount(0);
    }
  });

  test("sin sesión no hay informe", async ({ request }) => {
    const a = await escenario("DIRECTOR_A");
    const id = await evaluacionApi(a.sb, a, [3]);
    const r = await request.get(`/evaluaciones/${id}/pdf`, { maxRedirects: 0 });
    expect(r.status()).toBe(307);
    expect(r.headers()["location"]).toMatch(/^\/acceso\?siguiente=/);
    expect((await r.body()).toString("latin1")).not.toContain("%PDF");
  });

  test("textos largos y muchos objetivos: varias páginas numeradas sin perder contenido", async ({ page }) => {
    const a = await escenario("DIRECTOR_A", "Jugador Largo");
    const parrafo = (n: number) => `Párrafo ${n}: observación detallada del trabajo en pista durante la sesión.`;
    const observaciones = Array.from({ length: 38 }, (_, i) => parrafo(i + 1)).join("\n").slice(0, 3000);
    const id = await evaluacionApi(a.sb, a, [1, 2, 3, 4, 5, 3], {
      observaciones,
      fortalezas: "F".repeat(20) + " " + "fortaleza ".repeat(140).trim(),
      mejoras: "mejora ".repeat(200).trim(),
      objetivos: Array.from({ length: 5 }, (_, i) => ({ descripcion: `Objetivo largo ${i + 1} ${"detalle ".repeat(22)}`.trim(), plazo: null })),
    });
    await entrar(page, "DIRECTOR_A");
    const { texto, paginas } = await leerPdf(await (await page.request.get(`/evaluaciones/${id}/pdf`)).body());
    expect(paginas).toBeGreaterThanOrEqual(2);
    for (let n = 1; n <= paginas; n++) expect(texto).toContain(`Página ${n} de ${paginas}`);
    const ultimo = observaciones.split("\n").at(-1)!.split(":")[0];
    expect(texto).toContain(ultimo);
    expect(texto).toContain("Objetivo largo 5");
  });

  test("vista previa, descarga y compartir desde el móvil", async ({ page }) => {
    const a = await escenario("DIRECTOR_A", "Jugador Compartir");
    const id = await evaluacionApi(a.sb, a, [4, 4]);
    // Simula un móvil que puede compartir archivos (menú nativo: WhatsApp, etc.).
    await page.addInitScript(() => {
      const w = window as unknown as { __compartido?: { nombre: string; tipo: string; tamano: number; titulo?: string } };
      Object.defineProperty(navigator, "canShare", { configurable: true, value: (d: { files?: File[] }) => !!d.files?.length });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (d: { files: File[]; title?: string }) => {
          w.__compartido = { nombre: d.files[0].name, tipo: d.files[0].type, tamano: d.files[0].size, titulo: d.title };
        },
      });
    });
    await entrar(page, "DIRECTOR_A");
    await page.goto(`/evaluaciones/${id}`);
    await page.getByRole("link", { name: "Informe PDF" }).click();
    await expect(page).toHaveURL(new RegExp(`/evaluaciones/${id}/informe$`));
    await expect(visible(page, "PDF listo.")).toBeVisible();
    const vista = page.getByRole("article", { name: "Vista previa del informe" });
    await expect(vista).toContainText(a.jugador.nombre);
    await expect(vista).toContainText("Escuela Demo A");

    await page.getByRole("button", { name: "Compartir (WhatsApp…)" }).click();
    await expect(visible(page, "Informe compartido.")).toBeVisible();
    const compartido = await page.evaluate(() => (window as unknown as { __compartido: unknown }).__compartido);
    expect(compartido).toMatchObject({ tipo: "application/pdf", nombre: expect.stringMatching(/^informe-jugador-compartir-.+\.pdf$/) });

    const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar PDF" }).click()]);
    expect(descarga.suggestedFilename()).toMatch(/^informe-jugador-compartir-.+\.pdf$/);

    await page.getByRole("button", { name: "Volver a generar" }).click();
    await expect(visible(page, "PDF listo.")).toBeVisible();
  });

  test("sin compartir archivos, se ofrece la descarga", async ({ page }) => {
    const a = await escenario("DIRECTOR_A", "Jugador Descarga");
    const id = await evaluacionApi(a.sb, a, [3]);
    await page.addInitScript(() => Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false }));
    await entrar(page, "DIRECTOR_A");
    await page.goto(`/evaluaciones/${id}/informe`);
    await expect(visible(page, "PDF listo.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Compartir/ })).toHaveCount(0);
    await expect(visible(page, /Descarga el PDF y adjúntalo en WhatsApp/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Descargar PDF" })).toBeEnabled();
  });

  test("el nombre del perfil aparece como entrenador/a en el informe", async ({ page }) => {
    await entrar(page, "DIRECTOR_B");
    await page.goto("/perfil");
    await page.getByLabel("Tu nombre").fill("Dirección B Sintética");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(aviso(page)).toHaveText("Nombre guardado.");
    const b = await escenario("DIRECTOR_B", "Jugador Perfil");
    const id = await evaluacionApi(b.sb, b, [2]);
    const { texto } = await leerPdf(await (await page.request.get(`/evaluaciones/${id}/pdf`)).body());
    expect(texto).toContain("Dirección B Sintética");
  });
});

test.describe("Metodología", () => {
  test("la dirección carga la metodología base y la adapta; el entrenador solo la consulta", async ({ page }) => {
    await entrar(page, "DIRECTOR_C");
    await page.goto("/evaluaciones");
    await expect(visible(page, "Tu escuela todavía no tiene metodología.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Nueva evaluación" })).toHaveCount(0);

    await page.goto("/metodologia");
    await page.getByRole("button", { name: "Cargar metodología base ÉVORA" }).click();
    await expect(aviso(page)).toHaveText("Metodología base cargada. Puedes adaptarla a tu escuela.");
    const lista = page.getByRole("list", { name: "Competencias de tu escuela" });
    await expect(lista.getByRole("listitem")).toHaveCount(6);

    const nombre = `Saque E2E ${unico()}`;
    await page.getByLabel("Nombre de la competencia").last().fill(nombre);
    await page.getByLabel("Área").last().selectOption({ label: "Técnica" });
    await page.getByRole("button", { name: "Añadir competencia" }).click();
    await expect(aviso(page)).toHaveText("Competencia añadida.");
    await expect(lista.getByRole("listitem")).toHaveCount(7);
    await page.getByRole("button", { name: `Desactivar ${nombre}` }).click();
    await expect(aviso(page)).toHaveText("Competencia desactivada.");
    await expect(lista.getByRole("listitem").filter({ hasText: nombre })).toContainText("Desactivada");

    // Nombre repetido: error claro.
    await page.getByLabel("Nombre de la competencia").last().fill(nombre.toUpperCase());
    await page.getByLabel("Área").last().selectOption({ label: "Mental" });
    await page.getByRole("button", { name: "Añadir competencia" }).click();
    await expect(visible(page, "Ya existe una competencia con ese nombre en tu escuela.")).toBeVisible();
  });

  test("el entrenador ve la metodología pero no la cambia", async ({ page }) => {
    await entrar(page, "ENTRENADOR_A");
    await page.goto("/metodologia");
    await expect(visible(page, "Solo la dirección puede cambiar la metodología.")).toBeVisible();
    await expect(page.getByRole("list", { name: "Competencias de tu escuela" }).getByRole("listitem")).toHaveCount(6);
    await expect(page.getByRole("button", { name: /^Editar / })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Añadir competencia" })).toHaveCount(0);
  });
});

test.describe("Demostración separada", () => {
  test("la demo de evaluaciones sigue aislada de los datos reales", async ({ page }) => {
    await entrar(page, "DIRECTOR_A");
    await page.goto("/evaluaciones");
    await expect(visible(page, /^Datos reales de tu escuela\.$/)).toBeVisible();
    expect(await page.evaluate(() => window.localStorage.getItem("evora-padel-demo-v1"))).toBeNull();
    await page.goto("/demo/evaluaciones");
    await expect(visible(page, /Modo demostración/)).toBeVisible();
    await expect(visible(page, "Irene Solana").first()).toBeVisible();
    // Enlace antiguo de la demo: ahora abre el formulario real, sin romperse.
    await page.goto("/evaluaciones/nueva?pendiente=e1");
    await expect(page.getByRole("heading", { level: 1, name: "Nueva evaluación" })).toBeVisible();
  });
});
