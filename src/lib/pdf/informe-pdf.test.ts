import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import type { InformeEvaluacion } from "../informe.ts";
import { cargarFuentes } from "./fuentes.ts";
import { envolver, generarPdfInforme, MARGEN, PAGINA, type Traza } from "./informe-pdf.ts";

// Datos SINTÉTICOS (ningún dato real).
const base: InformeEvaluacion = {
  escuela: "Escuela Sintética de Pádel",
  jugador: { nombre: "Jugadora Sintética", nivel: "intermedio" },
  grupo: "Grupo Prueba",
  entrenador: "Entrenadora Prueba",
  tipo: "completa",
  titulo: "Evaluación de otoño",
  fecha: "2026-10-01",
  puntuaciones: [
    { competenciaId: "a", nombre: "Golpes de fondo", area: "tecnica", orden: 1, puntuacion: 4 },
    { competenciaId: "b", nombre: "Lectura táctica", area: "tactica", orden: 2, puntuacion: 2 },
  ],
  media: 3,
  fortalezas: "Constancia en los entrenamientos.",
  mejoras: "Volea de revés.",
  observaciones: "Buena actitud.",
  objetivos: [{ descripcion: "Mejorar la bandeja", plazo: "2026-12-01" }],
  comparacion: {
    fechaAnterior: "2026-06-01",
    filas: [{ competenciaId: "a", nombre: "Golpes de fondo", anterior: 3, actual: 4, diferencia: 1 }],
    mediaAnterior: 3,
    mediaActual: 4,
    sinComparar: 1,
  },
  hayAnterior: true,
  emitido: "2026-10-12",
};

/** GUARDAR_PDF=/carpeta guarda los PDF generados para revisarlos a ojo. */
function guardar(nombre: string, bytes: Uint8Array) {
  if (process.env.GUARDAR_PDF) writeFileSync(join(process.env.GUARDAR_PDF, nombre), bytes);
}

const textos = (trazas: Traza[]) => trazas.map((t) => t.texto).join("\n");

/** Ningún texto fuera de la página o invadiendo cabecera/pie, y ningún solape entre textos del cuerpo. */
function comprobarGeometria(trazas: Traza[]) {
  for (const t of trazas) {
    assert.ok(t.x >= MARGEN.x - 0.01, `«${t.texto}» empieza fuera del margen (${t.x})`);
    assert.ok(t.x + t.ancho <= PAGINA.ancho - MARGEN.x + 0.01, `«${t.texto}» se sale por la derecha (${t.x + t.ancho})`);
    if (t.zona === "cuerpo") {
      assert.ok(t.y >= MARGEN.inferior - 0.01, `«${t.texto}» invade el pie (y=${t.y}, página ${t.pagina})`);
      const techo = t.pagina === 1 ? PAGINA.alto - 108 : PAGINA.alto - 34;
      assert.ok(t.y + t.alto <= techo, `«${t.texto}» invade la cabecera (página ${t.pagina})`);
    }
  }
  const caja = (t: Traza) => ({ x0: t.x, x1: t.x + t.ancho, y0: t.y - t.alto * 0.22, y1: t.y + t.alto * 0.72 });
  const porPagina = Map.groupBy(trazas, (t) => t.pagina);
  for (const [pagina, lista] of porPagina) {
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = caja(lista[i]);
        const b = caja(lista[j]);
        const solapan = a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
        assert.equal(solapan, false, `página ${pagina}: «${lista[i].texto}» se superpone con «${lista[j].texto}»`);
      }
    }
  }
}

test("informe básico: una página, contenido real y sin solapes", async () => {
  const r = await generarPdfInforme(base, await cargarFuentes());
  guardar("informe-basico.pdf", r.bytes);
  assert.equal(new TextDecoder().decode(r.bytes.slice(0, 5)), "%PDF-");
  assert.equal(r.paginas, 1);
  const t = textos(r.trazas);
  for (const esperado of [
    "Jugadora Sintética",
    "Escuela Sintética de Pádel",
    "Grupo Prueba",
    "Entrenadora Prueba",
    "Evaluación completa · 1 oct 2026 · Evaluación de otoño",
    "Media 3,0 / 5 · 2 competencias evaluadas",
    "Golpes de fondo",
    "4 · Avanzado",
    "2 · En desarrollo",
    "Constancia en los entrenamientos.",
    "Volea de revés.",
    "Mejorar la bandeja",
    "Plazo: 1 dic 2026",
    "Buena actitud.",
    "+1",
    "Media de las competencias comparadas: de 3,0 a 4,0.",
    "Observa. Mide. Haz crecer.",
    "Emitido el 12 oct 2026",
  ]) {
    assert.ok(t.includes(esperado), `falta «${esperado}»`);
  }
  // Con una sola página no se numeran páginas.
  assert.ok(!t.includes("Página 1 de"));
  comprobarGeometria(r.trazas);
  const pdf = await PDFDocument.load(r.bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.match(pdf.getTitle() ?? "", /Jugadora Sintética/);
});

test("observaciones muy largas y muchas competencias: varias páginas numeradas, sin cortes ni solapes", async () => {
  const largo = Array.from({ length: 26 }, (_, i) => `Párrafo ${i + 1}: observación detallada del trabajo en pista con varias frases seguidas para ocupar espacio.`).join("\n");
  const r = await generarPdfInforme(
    {
      ...base,
      jugador: { nombre: "Jugadora con un nombre extraordinariamente largo para comprobar el ajuste de líneas del título", nivel: null },
      escuela: "Escuela Deportiva Sintética con un nombre larguísimo que no cabe en una sola línea de la cabecera del informe",
      puntuaciones: Array.from({ length: 25 }, (_, i) => ({
        competenciaId: `c${i}`,
        nombre: i === 3 ? "Competencia con un nombre bastante largo que necesita dos líneas en la tabla" : `Competencia ${i + 1}`,
        area: "fisica" as const,
        orden: i,
        puntuacion: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
      })),
      fortalezas: largo.slice(0, 1500),
      mejoras: "Supercalifragilisticoespialidosoextraordinariamentelargapalabrasinespaciosquenocabeenunalinea".repeat(3),
      observaciones: largo.slice(0, 3000),
      objetivos: Array.from({ length: 5 }, (_, i) => ({ descripcion: `Objetivo ${i + 1}: ${"detalle ".repeat(20)}`.trim(), plazo: i % 2 ? null : "2027-01-15" })),
      comparacion: {
        ...base.comparacion!,
        filas: Array.from({ length: 25 }, (_, i) => ({ competenciaId: `c${i}`, nombre: `Competencia ${i + 1}`, anterior: 3 as const, actual: 2 as const, diferencia: -1 })),
      },
    },
    await cargarFuentes(),
  );
  guardar("informe-largo.pdf", r.bytes);
  assert.ok(r.paginas >= 3, `se esperaban varias páginas, hay ${r.paginas}`);
  const t = textos(r.trazas);
  for (let n = 1; n <= r.paginas; n++) assert.ok(t.includes(`Página ${n} de ${r.paginas}`), `falta la numeración de la página ${n}`);
  assert.ok(t.includes("Párrafo 26"), "las observaciones no se truncan");
  assert.ok(t.includes("−1"));
  comprobarGeometria(r.trazas);
  // La cabecera de continuación repite el jugador en cada página.
  assert.equal(r.trazas.filter((x) => x.zona === "cabecera" && x.texto.startsWith("Jugadora con un nombre")).length, r.paginas - 1);
});

test("campos opcionales vacíos: no se inventan secciones ni comparaciones", async () => {
  const r = await generarPdfInforme(
    {
      ...base,
      tipo: "rapida",
      titulo: null,
      grupo: null,
      entrenador: null,
      jugador: { nombre: "Jugador Mínimo", nivel: null },
      fortalezas: null,
      mejoras: null,
      observaciones: null,
      objetivos: [],
      comparacion: null,
      hayAnterior: false,
      puntuaciones: [base.puntuaciones[0]],
      media: 4,
    },
    await cargarFuentes(),
  );
  const t = textos(r.trazas);
  for (const ausente of ["FORTALEZAS", "ÁREAS PRIORITARIAS", "OBJETIVOS DE MEJORA", "OBSERVACIONES", "Anterior"]) {
    assert.ok(!t.includes(ausente), `no debería aparecer «${ausente}»`);
  }
  assert.ok(t.includes("Sin grupo"));
  assert.ok(t.includes("Equipo técnico de la escuela"));
  assert.ok(t.includes("Todavía no hay historial suficiente"));
  assert.ok(t.includes("Media 4,0 / 5 · 1 competencia evaluada"));
  comprobarGeometria(r.trazas);
});

test("caracteres de otros alfabetos latinos y sin glifo: no rompen el PDF", async () => {
  const r = await generarPdfInforme(
    { ...base, jugador: { nombre: "Łukasz Ștefan Ödön Ñúñez", nivel: null }, observaciones: "Emoji 🎾 y símbolo ☃ sin glifo." },
    await cargarFuentes(),
  );
  const t = textos(r.trazas);
  assert.ok(t.includes("Łukasz Ștefan Ödön Ñúñez"));
  assert.ok(t.includes("Emoji ? y símbolo ? sin glifo."), "los caracteres sin glifo se sustituyen por «?»");
  await PDFDocument.load(r.bytes);
});

test("envolver: respeta saltos de línea y parte palabras imposibles", () => {
  const medir = (s: string) => s.length;
  assert.deepEqual(envolver("uno dos tres", medir, 7), ["uno dos", "tres"]);
  assert.deepEqual(envolver("a\n\nb", medir, 10), ["a", "", "b"]);
  assert.deepEqual(envolver("abcdefghij", medir, 4), ["abcd", "efgh", "ij"]);
});

test("interpretación técnica y origen de la redacción: en su orden y solo si existen", async () => {
  const r = await generarPdfInforme(
    {
      ...base,
      interpretacion: "Interpretación sintética del perfil.",
      redaccion: { version: 2, guardada: "2026-10-02T10:00:00Z", origen: "revisada" },
    },
    await cargarFuentes(),
  );
  guardar("informe-interpretacion.pdf", r.bytes);
  comprobarGeometria(r.trazas);
  const t = textos(r.trazas);
  const pos = (s: string) => t.indexOf(s);
  for (const s of ["FORTALEZAS", "ASPECTOS A MEJORAR", "INTERPRETACIÓN TÉCNICA", "Interpretación sintética del perfil.", "OBJETIVOS DE MEJORA", "OBSERVACIONES DEL ENTRENADOR/A"]) {
    assert.ok(pos(s) >= 0, `falta «${s}» en:\n${t}`);
  }
  assert.ok(pos("ASPECTOS A MEJORAR") < pos("INTERPRETACIÓN TÉCNICA") && pos("INTERPRETACIÓN TÉCNICA") < pos("OBJETIVOS DE MEJORA"));
  const seguido = t.replace(/\n/g, " "); // el párrafo se reparte en varias líneas
  assert.match(seguido, /propuestos automáticamente a partir de las puntuaciones y revisados por el entrenador\/a/);
  assert.match(seguido, /versión 2/);

  // Evaluación anterior a las versiones (sin interpretación ni redacción guardada): nada nuevo.
  const antiguo = textos((await generarPdfInforme(base, await cargarFuentes())).trazas);
  assert.doesNotMatch(antiguo, /INTERPRETACIÓN TÉCNICA|automáticamente/);
});
