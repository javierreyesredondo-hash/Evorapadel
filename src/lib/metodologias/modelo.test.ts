import { test } from "node:test";
import assert from "node:assert/strict";
import { competenciasEvaluables, LIMITES_IMPORTACION, validarPropuesta, type Propuesta } from "./modelo.ts";

// Validación en el servidor de la propuesta REVISADA (lo que envía el navegador).

const base = (): Propuesta => ({
  nombre: "Método Sintético",
  version: "1.0",
  descripcion: "Para pruebas.",
  textos: [{ titulo: "La idea", texto: "Introducción.", pagina: 2, incluir: true }],
  fases: [
    { numero: 2, nombre: "Medir", descripcion: "", pagina: 2, incluir: true },
    { numero: 1, nombre: "Observar", descripcion: "Mirar.", pagina: 2, incluir: true },
  ],
  principios: [{ nombre: "Regla de oro", descripcion: "Lo que más limita.", pagina: 3, incluir: true }],
  escala: [1, 2, 3, 4, 5].map((valor) => ({ valor: valor as 1, nombre: `Nivel ${valor}`, descripcion: "" })),
  competencias: [
    { nombre: "Técnica", grupo: "Criterios específicos", descripcion: "Control.", puntuable: true, evaluable: true, origen: "tabla", pagina: 4, incluir: true },
    { nombre: "Globo", grupo: "Técnica", descripcion: "", puntuable: true, evaluable: false, origen: "Ficha 02", pagina: 6, incluir: true },
    { nombre: "Globo", grupo: "Defensa", descripcion: "", puntuable: true, evaluable: false, origen: "Ficha 02", pagina: 6, incluir: true },
    { nombre: "Posición de espera", grupo: "Desplazamiento", descripcion: "", puntuable: false, evaluable: false, origen: "Ficha 02", pagina: 6, incluir: true },
  ],
  fichas: [
    {
      numero: 1,
      titulo: "Alta y contexto",
      descripcion: "",
      pagina: 5,
      incluir: true,
      secciones: [
        {
          titulo: "Datos",
          categoria: null,
          incluir: true,
          campos: [
            { tipo: "texto", etiqueta: "Nombre", lineas: 1, incluir: true },
            { tipo: "opciones", etiqueta: "Objetivo", opciones: ["Diversión", "Competir"], incluir: true },
            { tipo: "tabla", etiqueta: "Técnica", columnas: [{ titulo: "1–5", tipo: "escala" }], filas: ["Derecha"], incluir: true },
          ],
        },
      ],
    },
  ],
  noInterpretado: [{ pagina: 3, motivo: "Imagen", texto: "" }],
});
const DOC = { nombre: "metodo.pdf", bytes: 1000, paginas: 10, sha256: "a".repeat(64) };

test("propuesta válida: se normaliza y solo se guarda lo revisado", () => {
  const r = validarPropuesta(base(), DOC);
  assert.ok(r.ok);
  const { contenido, documento } = r.valor;
  assert.deepEqual(contenido.fases.map((f) => f.nombre), ["Observar", "Medir"]); // ordenadas por número
  assert.equal(competenciasEvaluables(contenido).length, 1);
  assert.equal(contenido.competencias.length, 4); // «Globo» en dos grupos distintos es válido
  assert.equal("incluir" in contenido.fichas[0].secciones[0].campos[0], false);
  assert.equal("noInterpretado" in contenido, false);
  assert.deepEqual(documento, DOC);
});

test("la revisión corrige y descarta: lo no incluido no se guarda", () => {
  const p = base();
  p.nombre = "  Método   corregido ";
  p.fases.push({ numero: 3, nombre: "Reajustar", descripcion: "Añadida a mano en la revisión.", pagina: null, incluir: true });
  p.principios[0].incluir = false;
  p.competencias[3].incluir = false;
  p.fichas[0].secciones[0].campos[1].incluir = false;
  const r = validarPropuesta(p, DOC);
  assert.ok(r.ok);
  assert.equal(r.valor.nombre, "Método corregido");
  assert.deepEqual(r.valor.contenido.fases.map((f) => f.nombre), ["Observar", "Medir", "Reajustar"]);
  assert.equal(r.valor.contenido.principios.length, 0);
  assert.equal(r.valor.contenido.competencias.length, 3);
  assert.deepEqual(r.valor.contenido.fichas[0].secciones[0].campos.map((c) => c.tipo), ["texto", "tabla"]);
});

test("duplicados y competencias evaluables sin escala o sin grupo se rechazan", () => {
  const p = base();
  p.competencias.push({ ...p.competencias[1], nombre: " globo " });
  p.competencias[3].evaluable = true;
  p.competencias[0].grupo = "";
  const r = validarPropuesta(p, DOC);
  assert.equal(r.ok, false);
  const errores = (r as { errores: string[] }).errores.join("\n");
  assert.match(errores, /«globo» aparece dos veces en «Técnica»/);
  assert.match(errores, /«Posición de espera» no tiene escala 1–5/);
  assert.match(errores, /«Técnica» necesita un grupo/);
});

test("escala: o los cinco niveles o ninguno (se usa la de ÉVORA)", () => {
  const p = base();
  p.escala = p.escala.slice(0, 3);
  assert.equal(validarPropuesta(p, DOC).ok, false);
  p.escala = [];
  assert.equal(validarPropuesta(p, DOC).ok, true);
});

test("datos que faltan, manipulados o demasiado grandes", () => {
  assert.equal(validarPropuesta(null, DOC).ok, false);
  assert.equal(validarPropuesta({ ...base(), nombre: "" }, DOC).ok, false);
  assert.equal(validarPropuesta({ ...base(), version: "" }, DOC).ok, false);
  assert.equal(validarPropuesta({ ...base(), fases: "no es una lista" }, DOC).ok, false);
  assert.equal(validarPropuesta(base(), { ...DOC, sha256: "no-es-un-hash" }).ok, false);
  assert.equal(validarPropuesta(base(), { ...DOC, bytes: LIMITES_IMPORTACION.pdfBytes + 1 }).ok, false);
  const campoRaro = base();
  (campoRaro.fichas[0].secciones[0].campos[0] as { tipo: string }).tipo = "script";
  assert.equal(validarPropuesta(campoRaro, DOC).ok, false);
  // 30 fichas × 10 apartados × 10 campos × 200 caracteres ≈ 600 KB (> 350 KB).
  const enorme = base();
  const campo = { tipo: "texto" as const, etiqueta: "e".repeat(200), lineas: 1, incluir: true };
  const seccion = { titulo: "Apartado", categoria: null, incluir: true, campos: Array.from({ length: 10 }, () => ({ ...campo })) };
  enorme.fichas = Array.from({ length: 30 }, (_, i) => ({ ...base().fichas[0], titulo: `Ficha ${i}`, secciones: Array.from({ length: 10 }, () => ({ ...seccion })) }));
  const r = validarPropuesta(enorme, DOC);
  assert.equal(r.ok, false);
  assert.match((r as { errores: string[] }).errores.join(" "), /demasiado grande/);
});

test("quita caracteres de control y sin documento también es válida", () => {
  const p = base();
  p.descripcion = "Hola\u0000\u0007 mundo";
  const r = validarPropuesta(p, null);
  assert.ok(r.ok);
  assert.equal(r.valor.descripcion, "Hola mundo");
  assert.equal(r.valor.documento, null);
});
