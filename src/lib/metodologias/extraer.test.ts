import { test } from "node:test";
import assert from "node:assert/strict";
import { analizarDocumento } from "./analizar.ts";
import { ErrorPdf, extraerPaginas, pareceUnPdf } from "./extraer.ts";
import { metodologiaSintetica, pdfDePrueba } from "./pdf-de-prueba.ts";

// Extracción real con pdf.js sobre PDF sintéticos generados en la prueba.

const rechaza = (promesa: Promise<unknown>, patron: RegExp) =>
  assert.rejects(promesa, (e: unknown) => e instanceof ErrorPdf && patron.test(e.message));

test("extrae y analiza una metodología sintética completa", async () => {
  const p = analizarDocumento(await extraerPaginas(await metodologiaSintetica()));
  assert.equal(p.nombre, "Método Sintético");
  assert.equal(p.version, "2.3");
  assert.equal(p.descripcion, "Un método inventado para las pruebas.");
  assert.deepEqual(p.fases.map((f) => [f.numero, f.nombre, f.descripcion]), [
    [1, "Observar", "Mirar con atención sintética."],
    [2, "Medir", "Contar lo que pasa."],
  ]);
  assert.deepEqual(p.principios.map((x) => [x.nombre, x.descripcion]), [
    ["Primero el jugador", "La clase se adapta."],
    ["Con intención", "Cada tarea responde a algo."],
  ]);
  assert.deepEqual(p.escala.map((n) => n.nombre), ["Inicial", "En desarrollo", "Funcional", "Avanzado", "Dominio"]);
  assert.equal(p.escala[4].descripcion, "Descripción sintética del nivel 5.");

  // Criterios: evaluables; indicadores de la ficha de evaluación: con su grupo, sin fusionar.
  const comp = p.competencias.map((c) => `${c.grupo}/${c.nombre}/${c.puntuable ? "1-5" : "obs"}/${c.evaluable ? "eval" : "-"}`);
  assert.deepEqual(comp, [
    "Criterios específicos/Técnica/1-5/eval",
    "Criterios específicos/Paciencia/1-5/eval",
    "Técnica/Derecha/1-5/-",
    "Técnica/Globo/1-5/-",
    "Defensa/Pared/1-5/-",
    "Defensa/Globo/1-5/-",
    "Desplazamiento/Posición de espera/obs/-",
    "Desplazamiento/Llegada a la bola/obs/-",
  ]);

  const [ficha] = p.fichas;
  assert.equal(ficha.titulo, "Evaluación inicial");
  assert.deepEqual(ficha.secciones.map((s) => s.titulo), ["Técnica", "Defensa", "Desplazamiento", "Diagnóstico", "Fortalezas"]);
  const tabla = ficha.secciones[0].campos[0];
  assert.equal(tabla.tipo, "tabla");
  assert.deepEqual(tabla.filas, ["Derecha", "Globo"]);
  assert.deepEqual(tabla.columnas, [{ titulo: "1–5", tipo: "escala" }, { titulo: "Observación", tipo: "texto" }]);
  assert.deepEqual(ficha.secciones[3].campos.map((c) => [c.tipo, c.etiqueta, c.opciones]), [
    ["texto", "Principal limitación", undefined],
    ["opciones", "Diagnóstico", ["Técnica", "Táctica", "Mixta"]],
  ]);
  assert.deepEqual(ficha.secciones[4].campos.map((c) => [c.tipo, c.elementos ?? null]), [["lista", 2], ["nota", null]]);

  // La página 5 es una imagen: se avisa en lugar de inventar su contenido.
  const aviso = p.noInterpretado.find((a) => a.pagina === 5);
  assert.ok(aviso && /imágenes/.test(aviso.motivo) && /Mapa del método/.test(aviso.texto));
});

test("PDF vacío, que no es PDF o dañado: mensajes comprensibles", async () => {
  await rechaza(extraerPaginas(new Uint8Array()), /vacío/);
  await rechaza(extraerPaginas(new TextEncoder().encode("Hola, no soy un PDF")), /no es un PDF/);
  await rechaza(extraerPaginas(new TextEncoder().encode("%PDF-1.7\nbasura sin estructura")), /dañado/);
  assert.equal(pareceUnPdf(new TextEncoder().encode("%PDF-1.4")), true);
  assert.equal(pareceUnPdf(new TextEncoder().encode("PK\u0003\u0004")), false);
});

test("PDF sin texto extraíble (solo imágenes): se explica que no hay OCR", async () => {
  const pdf = await pdfDePrueba([{ textos: [], imagenCompleta: true }, { textos: [], imagenCompleta: true }]);
  await rechaza(extraerPaginas(pdf), /no tiene texto[\s\S]*OCR/);
});

test("límites: tamaño y número de páginas", async () => {
  const grande = new Uint8Array(4 * 1024 * 1024 + 1);
  grande.set(new TextEncoder().encode("%PDF-1.7"));
  await rechaza(extraerPaginas(grande), /tamaño máximo/);
  const largo = await pdfDePrueba(Array.from({ length: 41 }, (_, i) => ({ textos: [{ t: `Página ${i + 1}`, x: 60, y: 100 }] })));
  await rechaza(extraerPaginas(largo), /41 páginas.*máximo es 40/);
});

test("mide la superficie de imágenes de cada página", async () => {
  const pdf = await pdfDePrueba([
    { textos: [{ t: "Con imagen", x: 60, y: 100 }], imagenCompleta: true },
    { textos: [{ t: "Sin imagen", x: 60, y: 100 }] },
  ]);
  const [a, b] = await extraerPaginas(pdf);
  assert.ok(a.fraccionImagen > 0.95);
  assert.equal(b.fraccionImagen, 0);
});
