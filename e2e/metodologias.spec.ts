import type { Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "./fixtures";
import { clienteComo, credenciales, unico, type UsuarioPrueba } from "./credenciales";
import { metodologiaSintetica, pdfDePrueba } from "../src/lib/metodologias/pdf-de-prueba";

// Importación de metodologías desde PDF contra el Supabase local, con PDF
// SINTÉTICOS generados en la prueba («Método Sintético»; nunca documentos
// reales). Activar una metodología cambia las competencias de la escuela: por
// eso estas pruebas usan la «Escuela Demo D», que ninguna otra prueba toca, y
// una versión única por ejecución (se pueden repetir sobre la misma base).

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
const ANALIZAR = "/metodologia/importar/analizar";
const pdf = (nombre: string, buffer: Buffer | Uint8Array, mimeType = "application/pdf") => ({ name: nombre, mimeType, buffer: Buffer.from(buffer) });

/** Versión única por ejecución (cambia el PDF y su huella). */
const versionUnica = () => `${Date.now() % 100000}.${Math.floor(Math.random() * 1000)}`;

async function subir(page: Page, archivo: ReturnType<typeof pdf>) {
  await page.goto("/metodologia/importar");
  await page.getByLabel("Documento de la metodología (PDF)").setInputFiles(archivo);
  await page.getByRole("button", { name: "Analizar PDF" }).click();
}

/** Jugador con grupo en la escuela D y una evaluación rápida (competencias activas en ese momento). */
async function evaluacionRapida(sb: SupabaseClient, nota = 3) {
  const s = unico();
  const { data: esc } = await sb.from("escuelas").select("id").single();
  const escuela = esc!.id as string;
  const jugador = await sb.from("jugadores").insert({ escuela_id: escuela, nombre: `Jugador Met ${s}`, nivel: "avanzado" }).select("id").single();
  const grupo = await sb.from("grupos").insert({ escuela_id: escuela, nombre: `Grupo Met ${s}` }).select("id").single();
  await sb.from("grupo_jugadores").insert({ escuela_id: escuela, grupo_id: grupo.data!.id, jugador_id: jugador.data!.id });
  const { data: comps } = await sb.from("competencias").select("id, nombre").eq("activa", true).order("orden").limit(1);
  const { data: id, error } = await sb.rpc("guardar_evaluacion", {
    p_escuela: escuela,
    p_id: null,
    p_clave_envio: crypto.randomUUID(),
    p_jugador: jugador.data!.id,
    p_grupo: grupo.data!.id,
    p_tipo: "rapida",
    p_fecha: new Date().toISOString().slice(0, 10),
    p_titulo: null,
    p_fortalezas: null,
    p_mejoras: null,
    p_observaciones: null,
    p_puntuaciones: [{ competencia: comps![0].id, puntuacion: nota }],
    p_objetivos: [],
  });
  expect(error).toBeNull();
  return { id: id as string, jugador: jugador.data!.id as string, competencia: comps![0].nombre as string };
}

test.describe("Importar metodología desde PDF", () => {
  test("la dirección analiza, revisa, guarda un borrador y lo activa sin alterar las evaluaciones anteriores", async ({ page }) => {
    test.setTimeout(90_000);
    const sb = await clienteComo("DIRECTOR_D");
    const { data: previa } = await sb.from("metodologias").select("id, version").eq("estado", "activa").maybeSingle();
    const antigua = await evaluacionRapida(sb, 3);
    const version = versionUnica();
    const bytes = await metodologiaSintetica(version);

    await entrar(page, "DIRECTOR_D");
    await page.goto("/metodologia");
    await page.getByRole("link", { name: "Importar metodología desde PDF" }).click();
    await expect(page).toHaveURL(/\/metodologia\/importar$/);
    await page.getByLabel("Documento de la metodología (PDF)").setInputFiles(pdf("metodo-sintetico.pdf", bytes));
    await page.getByRole("button", { name: "Analizar PDF" }).click();

    // Revisión: lo encontrado, agrupado, y lo que no se ha podido interpretar.
    await expect(page.getByRole("heading", { name: "Datos generales" })).toBeVisible();
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Método Sintético");
    await expect(page.getByLabel("Versión")).toHaveValue(version);
    const noInterpretado = page.getByRole("region", { name: "No interpretado" });
    await expect(noInterpretado).toContainText("Página 5");
    await expect(noInterpretado).toContainText("Mapa del método");
    await expect(page.getByLabel("Nivel 3", { exact: true })).toHaveValue("Funcional");
    await expect(page.getByRole("group", { name: "Defensa" }).first()).toBeVisible();

    // Correcciones: añadir una fase que estaba en la imagen, descartar un principio
    // y evaluar también un indicador de la ficha.
    await page.getByRole("button", { name: "Añadir fase" }).click();
    await page.getByLabel("Fase", { exact: true }).last().fill("Reajustar");
    await page.getByRole("checkbox", { name: "Incluir principio Con intención" }).uncheck();
    await page.getByRole("checkbox", { name: "Evaluar Pared (Defensa) en ÉVORA de 1 a 5" }).check();
    // Un indicador sin escala en el documento no se puede evaluar de 1 a 5.
    await expect(page.getByRole("checkbox", { name: /Evaluar Posición de espera/ })).toHaveCount(0);

    // Guardar NO activa.
    await page.getByRole("button", { name: "Guardar como borrador" }).click();
    await expect(page).toHaveURL(/\/metodologia\/importadas\/[0-9a-f-]{36}$/);
    const id = page.url().split("/").pop()!;
    await expect(visible(page, /^Borrador$/)).toBeVisible();
    await expect(visible(page, "Reajustar")).toBeVisible();
    await expect(visible(page, "Con intención")).toHaveCount(0);
    const { data: guardada } = await sb.from("metodologias").select("estado, documento_nombre, documento_sha256").eq("id", id).single();
    expect(guardada).toMatchObject({ estado: "borrador", documento_nombre: "metodo-sintetico.pdf" });
    expect(guardada!.documento_sha256).toMatch(/^[0-9a-f]{64}$/);
    const { data: activas } = await sb.from("competencias").select("nombre").eq("activa", true);
    expect(activas!.map((c) => c.nombre)).toContain(antigua.competencia); // nada ha cambiado aún

    // Activar (con confirmación que explica los efectos).
    page.once("dialog", (d) => {
      expect(d.message()).toContain("Las evaluaciones anteriores no cambian");
      void d.accept();
    });
    await page.getByRole("button", { name: "Activar metodología" }).click();
    await expect(aviso(page)).toHaveText("Metodología activada. Las evaluaciones nuevas usarán sus competencias y su escala.");
    await expect(visible(page, /Es la metodología activa/)).toBeVisible();
    const { data: nuevas } = await sb.from("competencias").select("nombre, grupo").eq("activa", true).order("orden");
    expect(nuevas).toEqual([
      { nombre: "Técnica", grupo: "Criterios específicos" },
      { nombre: "Paciencia", grupo: "Criterios específicos" },
      { nombre: "Pared", grupo: "Defensa" },
    ]);

    // Evaluación nueva: competencias y escala de la metodología activada.
    await page.goto(`/evaluaciones/nueva?jugador=${antigua.jugador}&tipo=completa`);
    await expect(page.getByRole("radio", { name: "Pared: 3 (Funcional)" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /^Técnica: 5 \(Dominio\)/ })).toBeVisible();
    // La competencia anterior ya no se pide (si una versión anterior del mismo método la llamaba igual, sí sigue).
    if (!nuevas!.some((c) => c.nombre === antigua.competencia))
      await expect(page.getByRole("radiogroup", { name: antigua.competencia })).toHaveCount(0);

    // La evaluación anterior conserva sus notas, su competencia y su escala.
    await page.goto(`/evaluaciones/${antigua.id}`);
    await expect(visible(page, antigua.competencia).first()).toBeVisible();
    if (previa) await expect(visible(page, `v${previa.version}`).first()).toBeVisible();
    else await expect(visible(page, "3 · Competente").first()).toBeVisible();
    const { data: ev } = await sb.from("evaluaciones").select("metodologia_id").eq("id", antigua.id).single();
    expect(ev!.metodologia_id).toBe(previa?.id ?? null);

    // Mismo PDF otra vez: se avisa y no se puede guardar dos veces.
    await subir(page, pdf("copia.pdf", bytes));
    await expect(visible(page, /Este PDF ya está importado/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar como borrador" })).toBeDisabled();

    // Otra escuela no la ve (RLS y la misma respuesta que si no existiera).
    const otra = await clienteComo("DIRECTOR_B");
    const { data: ajena } = await otra.from("metodologias").select("id").eq("id", id);
    expect(ajena).toEqual([]);
  });

  test("otra escuela no puede abrir una metodología importada ajena", async ({ page }) => {
    // Borrador de la escuela D creado con la sesión de su dirección (RLS lo permite).
    const sb = await clienteComo("DIRECTOR_D");
    const { data: esc } = await sb.from("escuelas").select("id").single();
    const { data, error } = await sb
      .from("metodologias")
      .insert({ escuela_id: esc!.id, nombre: "Método Ajeno", version: versionUnica(), contenido: {} })
      .select("id")
      .single();
    expect(error).toBeNull();
    await entrar(page, "DIRECTOR_B");
    await page.goto(`/metodologia/importadas/${data!.id}`);
    await expect(page.getByRole("heading", { name: "Metodología no encontrada" })).toBeVisible();
    await page.goto("/metodologia");
    await expect(visible(page, "Método Ajeno")).toHaveCount(0);
  });

  test("archivos no válidos: mensajes claros y nada se guarda", async ({ page }) => {
    // El navegador registra como error de consola las respuestas 4xx del análisis.
    test.info().annotations.push({ type: "error-consola-esperado", description: "the server responded with a status of 4" });
    await entrar(page, "DIRECTOR_A");
    const { count: antes } = await (await clienteComo("DIRECTOR_A")).from("metodologias").select("id", { count: "exact", head: true });

    await page.goto("/metodologia/importar");
    await page.getByRole("button", { name: "Analizar PDF" }).click();
    await expect(visible(page, "Elige un archivo PDF.")).toBeVisible();

    await subir(page, pdf("no-es-pdf.pdf", Buffer.from("Hola, no soy un PDF")));
    await expect(visible(page, /no es un PDF/)).toBeVisible();

    await subir(page, pdf("danado.pdf", Buffer.from("%PDF-1.7\nbasura sin estructura")));
    await expect(visible(page, /dañado/)).toBeVisible();

    await subir(page, pdf("escaneado.pdf", await pdfDePrueba([{ textos: [], imagenCompleta: true }])));
    await expect(visible(page, /no tiene texto/)).toBeVisible();

    await subir(page, pdf("notas.txt", Buffer.from("texto"), "text/plain"));
    await expect(visible(page, "Elige un archivo PDF.")).toBeVisible();

    // Directamente contra el servidor: vacío, demasiado grande, sin archivo.
    const vacio = await page.request.post(ANALIZAR, { multipart: { archivo: pdf("vacio.pdf", Buffer.alloc(0)) } });
    expect(vacio.status()).toBe(400);
    const grande = Buffer.alloc(4 * 1024 * 1024 + 1);
    grande.write("%PDF-1.7");
    const r413 = await page.request.post(ANALIZAR, { multipart: { archivo: pdf("grande.pdf", grande) } });
    expect(r413.status()).toBe(413);
    const sinArchivo = await page.request.post(ANALIZAR, { multipart: { otro: "x" } });
    expect(sinArchivo.status()).toBe(400);
    expect(r413.headers()["cache-control"]).toContain("no-store");

    const { count: despues } = await (await clienteComo("DIRECTOR_A")).from("metodologias").select("id", { count: "exact", head: true });
    expect(despues).toBe(antes);
  });

  test("el entrenador no puede importar ni activar metodologías", async ({ page }) => {
    await entrar(page, "ENTRENADOR_A");
    await page.goto("/metodologia");
    await expect(page.getByRole("link", { name: "Importar metodología desde PDF" })).toHaveCount(0);
    await page.goto("/metodologia/importar");
    await expect(visible(page, "Solo la dirección de la escuela puede importar metodologías.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Analizar PDF" })).toHaveCount(0);
    const r = await page.request.post(ANALIZAR, { multipart: { archivo: pdf("m.pdf", await metodologiaSintetica("0.1")) } });
    expect(r.status()).toBe(403);
    // Ni por la API con su propia sesión (RLS).
    const sb = await clienteComo("ENTRENADOR_A");
    const { data: esc } = await sb.from("escuelas").select("id").single();
    const { error } = await sb.from("metodologias").insert({ escuela_id: esc!.id, nombre: "Intento", version: "1.0", contenido: {} });
    expect(error).not.toBeNull();
  });

  test("sin sesión no se puede analizar ni ver nada", async ({ request }) => {
    const r = await request.post(ANALIZAR, { multipart: { archivo: pdf("m.pdf", Buffer.from("%PDF-1.7")) }, maxRedirects: 0 });
    expect(r.status()).toBe(307);
    expect(r.headers().location).toContain("/acceso");
  });

  test("una petición desde otro origen se rechaza", async ({ page }) => {
    await entrar(page, "DIRECTOR_A");
    const r = await page.request.post(ANALIZAR, {
      headers: { origin: "https://atacante.example" },
      multipart: { archivo: pdf("m.pdf", Buffer.from("%PDF-1.7")) },
    });
    expect(r.status()).toBe(403);
    const nulo = await page.request.post(ANALIZAR, { headers: { origin: "null" }, multipart: { archivo: pdf("m.pdf", Buffer.from("%PDF-1.7")) } });
    expect(nulo.status()).toBe(403);
  });
});
