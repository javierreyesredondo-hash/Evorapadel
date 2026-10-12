import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLAVE_ALMACEN,
  deserializarEstado,
  esFechaIso,
  estadoInicial,
  MAX_REGISTROS,
  validarEstadoGuardado,
  type Estado,
} from "./dominio.ts";

// Regresión: antes solo se comprobaban algunos campos y, por ejemplo,
// `pendientes: [null]` o una fecha "abc" llegaban a la interfaz y la rompían.

const valido = (): Estado => estadoInicial();
const json = (v: unknown) => JSON.stringify(v);

/** Aplica un cambio a una copia del estado inicial y comprueba que se descarta. */
function rechaza(cambio: (e: Record<string, unknown[]>) => void, motivo: string) {
  const e = structuredClone(valido()) as unknown as Record<string, unknown[]>;
  cambio(e);
  assert.equal(deserializarEstado(json(e)), null, `debería rechazar: ${motivo}`);
}

const ev = (e: Record<string, unknown[]>, i = 0) => e.evaluaciones![i] as Record<string, unknown>;
const ob = (e: Record<string, unknown[]>, i = 0) => e.objetivos![i] as Record<string, unknown>;
const pe = (e: Record<string, unknown[]>, i = 0) => e.pendientes![i] as Record<string, unknown>;

test("acepta el estado inicial completo y devuelve una copia equivalente", () => {
  const estado = valido();
  assert.deepEqual(deserializarEstado(json(estado)), estado);
  assert.equal(CLAVE_ALMACEN, "evora-padel-demo-v1");
});

test("acepta colecciones vacías (todo evaluado, sin objetivos)", () => {
  assert.deepEqual(deserializarEstado(json({ pendientes: [], evaluaciones: [], objetivos: [] })), {
    pendientes: [],
    evaluaciones: [],
    objetivos: [],
  });
});

test("rechaza ausencia, JSON inválido y raíces que no son objetos", () => {
  for (const texto of [null, "", "{roto", "null", "42", '"texto"', "[]", "true"]) {
    assert.equal(deserializarEstado(texto), null, `texto: ${String(texto)}`);
  }
});

test("rechaza colecciones que faltan o no son listas", () => {
  rechaza((e) => delete e.pendientes, "sin pendientes");
  rechaza((e) => delete e.evaluaciones, "sin evaluaciones");
  rechaza((e) => delete e.objetivos, "sin objetivos");
  rechaza((e) => ((e as Record<string, unknown>).objetivos = {}), "objetivos como objeto");
  rechaza((e) => ((e as Record<string, unknown>).pendientes = "x"), "pendientes como texto");
});

test("rechaza colecciones desmesuradas", () => {
  const base = valido().objetivos[0]!;
  const muchos = Array.from({ length: MAX_REGISTROS + 1 }, (_, i) => ({ ...base, id: `o${i}` }));
  assert.equal(deserializarEstado(json({ ...valido(), objetivos: muchos })), null);
});

test("pendientes: registros nulos, campos que faltan, tipos y rangos", () => {
  rechaza((e) => (e.pendientes![0] = null), "pendiente nula");
  rechaza((e) => (e.pendientes![0] = [1, 2]), "pendiente como lista");
  rechaza((e) => delete pe(e).id, "sin id");
  rechaza((e) => (pe(e).id = ""), "id vacío");
  rechaza((e) => (pe(e).id = 7), "id numérico");
  rechaza((e) => (pe(e).jugadorId = "j999"), "jugador inexistente");
  rechaza((e) => (pe(e).tipo = "Inventado"), "tipo fuera de la lista");
  rechaza((e) => delete pe(e).venceEnDias, "sin vencimiento");
  rechaza((e) => (pe(e).venceEnDias = 1.5), "vencimiento decimal");
  rechaza((e) => (pe(e).venceEnDias = "2"), "vencimiento como texto");
  rechaza((e) => (pe(e).venceEnDias = 99999), "vencimiento fuera de rango");
  rechaza((e) => (pe(e, 1).id = pe(e, 0).id), "ids repetidos");
});

test("evaluaciones: notas, fechas, tipo, comentario y jugador", () => {
  rechaza((e) => (e.evaluaciones![0] = "x"), "evaluación como texto");
  rechaza((e) => delete ev(e).notas, "sin notas");
  rechaza((e) => (ev(e).notas = [4, 4, 4, 4, 4, 4]), "notas como lista");
  rechaza((e) => delete (ev(e).notas as Record<string, unknown>).mental, "falta un criterio");
  for (const mala of [0, 6, 2.5, "3", null, -1]) {
    rechaza((e) => ((ev(e).notas as Record<string, unknown>).fondo = mala), `nota ${String(mala)}`);
  }
  rechaza((e) => (ev(e).fecha = "abc"), "fecha no ISO");
  rechaza((e) => (ev(e).fecha = "2026-02-30"), "fecha inexistente");
  rechaza((e) => (ev(e).fecha = "2026-9-1"), "fecha sin ceros");
  rechaza((e) => (ev(e).fecha = 20260918), "fecha numérica");
  rechaza((e) => (ev(e).tipo = ""), "tipo vacío");
  rechaza((e) => (ev(e).tipo = "Otra cosa"), "tipo fuera de la lista");
  rechaza((e) => delete ev(e).comentario, "sin comentario");
  rechaza((e) => (ev(e).comentario = null), "comentario nulo");
  rechaza((e) => (ev(e).comentario = "x".repeat(501)), "comentario demasiado largo");
  rechaza((e) => (ev(e).jugadorId = "zzz"), "jugador inexistente");
  rechaza((e) => (ev(e, 1).id = ev(e, 0).id), "ids repetidos");
});

test("objetivos: título, área, meta, progreso y jugador", () => {
  rechaza((e) => (e.objetivos![0] = 3), "objetivo numérico");
  rechaza((e) => (ob(e).titulo = "ab"), "título corto");
  rechaza((e) => (ob(e).titulo = "   a   "), "título de espacios");
  rechaza((e) => (ob(e).titulo = "x".repeat(81)), "título largo");
  rechaza((e) => (ob(e).titulo = 123), "título numérico");
  rechaza((e) => (ob(e).area = "Nutrición"), "área no permitida");
  rechaza((e) => delete ob(e).area, "sin área");
  rechaza((e) => (ob(e).meta = 0), "meta 0");
  rechaza((e) => (ob(e).meta = 1001), "meta mayor que el máximo");
  rechaza((e) => (ob(e).meta = 10.5), "meta decimal");
  rechaza((e) => (ob(e).progreso = -1), "progreso negativo");
  rechaza((e) => (ob(e).progreso = 11), "progreso mayor que la meta (10)");
  rechaza((e) => (ob(e).progreso = "7"), "progreso como texto");
  rechaza((e) => (ob(e).jugadorId = "j0"), "jugador inexistente");
  rechaza((e) => (ob(e, 1).id = ob(e, 0).id), "ids repetidos");
});

test("descarta campos desconocidos y normaliza el título", () => {
  const e = structuredClone(valido()) as unknown as Record<string, Record<string, unknown>[]>;
  e.objetivos![0]!.titulo = "  Remates   por 3  ";
  e.objetivos![0]!.extra = "<script>";
  e.evaluaciones![0]!.extra = 1;
  (e.evaluaciones![0]!.notas as Record<string, unknown>).inventado = 9;
  const r = deserializarEstado(json(e));
  assert.ok(r);
  assert.equal(r.objetivos[0]!.titulo, "Remates por 3");
  assert.equal("extra" in r.objetivos[0]!, false);
  assert.equal("extra" in r.evaluaciones[0]!, false);
  assert.equal("inventado" in r.evaluaciones[0]!.notas, false);
});

test("valida contra la lista de jugadores indicada", () => {
  // Con una lista sin j1, cualquier registro de j1 invalida el estado.
  const sinJ1 = [{ id: "j2" }, { id: "j3" }, { id: "j4" }, { id: "j5" }, { id: "j6" }] as never;
  assert.equal(validarEstadoGuardado(valido(), sinJ1), null);
});

test("esFechaIso solo acepta fechas reales AAAA-MM-DD", () => {
  for (const ok of ["2026-09-18", "2024-02-29", "2026-12-31"]) assert.ok(esFechaIso(ok), ok);
  for (const mal of ["2025-02-29", "2026-13-01", "2026-00-10", "18/09/2026", "2026-09-18T00:00", "", null]) {
    assert.equal(esFechaIso(mal), false, String(mal));
  }
});
