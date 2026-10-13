import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compararEvaluaciones,
  limpiarParrafo,
  media,
  nombreArchivoInforme,
  ordenarPuntuaciones,
  sumarDias,
  textoDiferencia,
  textoMediaEvaluacion,
  validarEvaluacion,
  type PuntuacionCompetencia,
} from "./evaluaciones.ts";

const HOY = "2026-10-12";
const C1 = "11111111-1111-4111-8111-111111111111";
const C2 = "22222222-2222-4222-8222-222222222222";
const C3 = "33333333-3333-4333-8333-333333333333"; // desactivada
const COMPETENCIAS = [
  { id: C1, activa: true },
  { id: C2, activa: true },
  { id: C3, activa: false },
];

const base = (cambios: Partial<Parameters<typeof validarEvaluacion>[0]> = {}) => ({
  tipo: "rapida",
  fecha: HOY,
  notas: { [C1]: "4" },
  objetivos: [],
  ...cambios,
});

test("evaluación rápida mínima: una nota basta", () => {
  const r = validarEvaluacion(base(), COMPETENCIAS, HOY);
  assert.ok(r.ok);
  assert.deepEqual(r.valor.puntuaciones, [{ competencia: C1, puntuacion: 4 }]);
  assert.equal(r.valor.grupoId, null);
  assert.equal(r.valor.observaciones, null);
});

test("evaluación rápida sin notas: error claro", () => {
  const r = validarEvaluacion(base({ notas: { [C1]: "", [C2]: "" } }), COMPETENCIAS, HOY);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.errores.notas, "Puntúa al menos una competencia.");
});

test("evaluación completa: exige todas las competencias ACTIVAS, no las desactivadas", () => {
  const falta = validarEvaluacion(base({ tipo: "completa", notas: { [C1]: "3" } }), COMPETENCIAS, HOY);
  assert.equal(falta.ok, false);
  if (!falta.ok) {
    assert.match(falta.errores[`nota_${C2}`], /completa/);
    assert.equal(falta.errores[`nota_${C3}`], undefined);
  }
  assert.ok(validarEvaluacion(base({ tipo: "completa", notas: { [C1]: "3", [C2]: "5" } }), COMPETENCIAS, HOY).ok);
});

test("notas: solo enteros del 1 al 5; competencias desconocidas se ignoran", () => {
  for (const mala of ["0", "6", "3.5", "x", "-1", "10"]) {
    const r = validarEvaluacion(base({ notas: { [C1]: mala } }), COMPETENCIAS, HOY);
    assert.equal(r.ok, false, mala);
  }
  const r = validarEvaluacion(base({ notas: { [C1]: "2", "otra-escuela": "5" } }), COMPETENCIAS, HOY);
  assert.ok(r.ok);
  assert.deepEqual(r.valor.puntuaciones, [{ competencia: C1, puntuacion: 2 }]);
});

test("tipo, fecha, grupo y título", () => {
  const e = (c: Partial<Parameters<typeof validarEvaluacion>[0]>) => {
    const r = validarEvaluacion(base(c), COMPETENCIAS, HOY);
    return r.ok ? {} : r.errores;
  };
  assert.ok(e({ tipo: "otra" }).tipo);
  assert.ok(e({ fecha: "2026-02-30" }).fecha);
  assert.ok(e({ fecha: "1999-12-31" }).fecha);
  assert.equal(e({ fecha: "2026-10-14" }).fecha, "La fecha no puede ser futura.");
  assert.equal(e({ fecha: "2026-10-13" }).fecha, undefined); // 1 día de margen por zona horaria
  assert.ok(e({ grupoId: "grupo-1" }).grupoId);
  assert.ok(e({ titulo: "x".repeat(81) }).titulo);
});

test("textos largos: límites del esquema y párrafos conservados", () => {
  const r = validarEvaluacion(base({ observaciones: "x".repeat(3001), fortalezas: "y".repeat(1501) }), COMPETENCIAS, HOY);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.errores.observaciones, /3000/);
    assert.match(r.errores.fortalezas, /1500/);
  }
  const ok = validarEvaluacion(base({ observaciones: "  Primera   línea \r\n\r\n\r\n\r\nSegunda  " }), COMPETENCIAS, HOY);
  assert.ok(ok.ok);
  assert.equal(ok.valor.observaciones, "Primera línea\n\nSegunda");
  assert.equal(limpiarParrafo(42), "");
});

test("objetivos: filas vacías se ignoran; descripción y plazo validados", () => {
  const r = validarEvaluacion(
    base({
      objetivos: [
        { descripcion: " Bandeja profunda ", plazo: "2026-12-01" },
        { descripcion: "", plazo: "" },
        { descripcion: "Volea", plazo: "" },
      ],
    }),
    COMPETENCIAS,
    HOY,
  );
  assert.ok(r.ok);
  assert.deepEqual(r.valor.objetivos, [
    { descripcion: "Bandeja profunda", plazo: "2026-12-01" },
    { descripcion: "Volea", plazo: null },
  ]);
  const malo = validarEvaluacion(
    base({ objetivos: [{ descripcion: "", plazo: "2026-12-01" }, { descripcion: "Antes", plazo: "2026-10-01" }] }),
    COMPETENCIAS,
    HOY,
  );
  assert.equal(malo.ok, false);
  if (!malo.ok) {
    assert.ok(malo.errores.objetivo_0);
    assert.match(malo.errores.plazo_1, /anterior/);
  }
  // Más de 5 filas: solo se tienen en cuenta 5.
  const muchos = validarEvaluacion(base({ objetivos: Array.from({ length: 8 }, (_, i) => ({ descripcion: `Objetivo ${i}` })) }), COMPETENCIAS, HOY);
  assert.ok(muchos.ok);
  assert.equal(muchos.valor.objetivos.length, 5);
});

const p = (id: string, nombre: string, puntuacion: 1 | 2 | 3 | 4 | 5, orden = 0): PuntuacionCompetencia => ({
  competenciaId: id,
  nombre,
  area: "tecnica",
  orden,
  puntuacion,
});

test("comparación: solo competencias comunes; sin anterior o sin comunes → null (no se inventa)", () => {
  const actual = [p(C1, "Fondo", 4), p(C2, "Red", 3)];
  assert.equal(compararEvaluaciones(actual, null), null);
  assert.equal(compararEvaluaciones(actual, { fecha: "2026-09-01", puntuaciones: [{ competenciaId: C3, puntuacion: 2 }] }), null);
  const c = compararEvaluaciones(actual, { fecha: "2026-09-01", puntuaciones: [{ competenciaId: C1, puntuacion: 2 }, { competenciaId: C3, puntuacion: 5 }] });
  assert.ok(c);
  assert.deepEqual(c.filas, [{ competenciaId: C1, nombre: "Fondo", anterior: 2, actual: 4, diferencia: 2 }]);
  assert.equal(c.mediaAnterior, 2);
  assert.equal(c.mediaActual, 4);
  assert.equal(c.sinComparar, 1);
  assert.equal(c.fechaAnterior, "2026-09-01");
});

test("medias, diferencias y textos", () => {
  assert.equal(media([]), null);
  assert.equal(media([{ puntuacion: 4 }, { puntuacion: 3 }, { puntuacion: 4 }]), 11 / 3);
  assert.equal(textoMediaEvaluacion(11 / 3), "3,7");
  assert.equal(textoMediaEvaluacion(null), "—");
  assert.equal(textoDiferencia(2), "+2");
  assert.equal(textoDiferencia(-1), "−1");
  assert.equal(textoDiferencia(0), "=");
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
});

test("nombre de archivo del informe: sin tildes ni caracteres raros", () => {
  assert.equal(nombreArchivoInforme("Lucía Marván O'Neil", "2026-10-12"), "informe-lucia-marvan-o-neil-2026-10-12.pdf");
  assert.equal(nombreArchivoInforme("../../etc", "x"), "informe-etc-evaluacion.pdf");
  assert.equal(nombreArchivoInforme("Ñ", "2026-10-12"), "informe-n-2026-10-12.pdf");
});

test("ordenarPuntuaciones sigue el orden de la metodología", () => {
  const r = ordenarPuntuaciones([p(C2, "B", 3, 2), p(C1, "Z", 3, 1), p(C3, "A", 3, 2)]);
  assert.deepEqual(r.map((x) => x.nombre), ["Z", "A", "B"]);
});

test("validarCompetencia", async () => {
  const { validarCompetencia } = await import("./evaluaciones.ts");
  assert.deepEqual(validarCompetencia({ nombre: " Saque ", area: "tecnica", descripcion: "", orden: "7" }), {
    ok: true,
    valor: { nombre: "Saque", area: "tecnica", descripcion: null, orden: 7, activa: true },
  });
  const malo = validarCompetencia({ nombre: "S", area: "magia", descripcion: "x".repeat(301), orden: "1000" });
  assert.equal(malo.ok, false);
  if (!malo.ok) assert.deepEqual(Object.keys(malo.errores).sort(), ["area", "descripcion", "nombre", "orden"]);
  assert.equal((validarCompetencia({ nombre: "Saque", area: "tecnica", activa: "no" }) as { valor: { activa: boolean } }).valor.activa, false);
});
