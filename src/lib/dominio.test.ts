import { test } from "node:test";
import assert from "node:assert/strict";
import { jugadores, type Nota } from "./demo-data.ts";
import {
  CLAVE_ALMACEN,
  deserializarEstado,
  enteroDeTexto,
  estadoInicial,
  evaluacionesDe,
  FILTROS_VACIOS,
  filtrarJugadores,
  mediaNotas,
  normalizar,
  puntuacionGlobal,
  reducir,
  resumenJugador,
  validarEvaluacion,
  validarObjetivo,
} from "./dominio.ts";

const nombres = (lista: { nombre: string }[]) => lista.map((j) => j.nombre).sort();

// ------------------------------------------------------------ Búsqueda

test("normalizar quita tildes y mayúsculas", () => {
  assert.equal(normalizar("  LUCÍA Marván "), "lucia marvan");
});

test("sin filtros devuelve todos los jugadores", () => {
  assert.equal(filtrarJugadores(jugadores, FILTROS_VACIOS).length, jugadores.length);
});

test("busca por nombre sin distinguir tildes ni mayúsculas", () => {
  assert.deepEqual(nombres(filtrarJugadores(jugadores, { ...FILTROS_VACIOS, texto: "lucia" })), ["Lucía Marván"]);
  assert.deepEqual(nombres(filtrarJugadores(jugadores, { ...FILTROS_VACIOS, texto: "ETXABE" })), ["Noa Etxabe"]);
});

test("busca también por grupo y foco, con varias palabras", () => {
  assert.deepEqual(
    nombres(filtrarJugadores(jugadores, { ...FILTROS_VACIOS, texto: "tecnificación" })),
    ["Bruno Celaya", "Lucía Marván", "Noa Etxabe"],
  );
  assert.deepEqual(
    nombres(filtrarJugadores(jugadores, { ...FILTROS_VACIOS, texto: "adultos irene" })),
    ["Irene Solana"],
  );
  assert.deepEqual(nombres(filtrarJugadores(jugadores, { ...FILTROS_VACIOS, texto: "vibora" })), ["Bruno Celaya"]);
});

test("filtra por nivel y posición, combinables con el texto", () => {
  assert.deepEqual(
    nombres(filtrarJugadores(jugadores, { ...FILTROS_VACIOS, nivel: "Intermedio" })),
    ["Diego Ferrán", "Irene Solana"],
  );
  assert.deepEqual(
    nombres(filtrarJugadores(jugadores, { texto: "", nivel: "Intermedio", posicion: "Revés" })),
    ["Irene Solana"],
  );
  assert.deepEqual(filtrarJugadores(jugadores, { texto: "noa", nivel: "Iniciación", posicion: null }), []);
});

// --------------------------------------------------------- Evaluaciones

const notasValidas = { fondo: 4, red: 3, aereo: 5, tactica: 4, fisico: 2, mental: 3 } as const;

test("puntuación global = media × 20 y media con un decimal", () => {
  assert.equal(puntuacionGlobal(notasValidas), 70);
  assert.equal(mediaNotas(notasValidas), 3.5);
  const unos = { fondo: 1, red: 1, aereo: 1, tactica: 1, fisico: 1, mental: 1 } as const;
  const cincos = { fondo: 5, red: 5, aereo: 5, tactica: 5, fisico: 5, mental: 5 } as const;
  assert.equal(puntuacionGlobal(unos), 20);
  assert.equal(puntuacionGlobal(cincos), 100);
});

test("validarEvaluacion acepta enteros de 1 a 5 en todos los criterios", () => {
  const r = validarEvaluacion(
    { jugadorId: "j1", tipo: "Seguimiento", notas: notasValidas, comentario: "  bien  " },
    { id: "x", fecha: "2026-10-01" },
  );
  assert.ok(r.ok);
  assert.equal(r.valor.comentario, "bien");
  assert.deepEqual(r.valor.notas, notasValidas);
});

test("validarEvaluacion rechaza notas fuera de rango, decimales, texto o vacías", () => {
  for (const malo of [0, 6, 2.5, "3", null, undefined, NaN]) {
    const r = validarEvaluacion(
      { jugadorId: "j1", tipo: "Seguimiento", notas: { ...notasValidas, red: malo }, comentario: "" },
      { id: "x", fecha: "2026-10-01" },
    );
    assert.equal(r.ok, false, `debería rechazar ${String(malo)}`);
    if (!r.ok) assert.deepEqual(Object.keys(r.errores), ["red"]);
  }
});

test("validarEvaluacion exige jugador existente y tipo", () => {
  const r = validarEvaluacion(
    { jugadorId: "no-existe", tipo: " ", notas: {}, comentario: "x".repeat(501) },
    { id: "x", fecha: "2026-10-01" },
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.errores.jugadorId && r.errores.tipo && r.errores.comentario);
    assert.equal(r.errores.fondo, "Puntúa de 1 a 5.");
  }
});

test("registrar una evaluación pendiente la quita de pendientes y actualiza el resumen", () => {
  let estado = estadoInicial();
  const antes = resumenJugador(estado, "j5");
  const r = validarEvaluacion(
    { jugadorId: "j5", tipo: "Evaluación técnica", notas: { fondo: 5, red: 5, aereo: 5, tactica: 5, fisico: 5, mental: 5 }, comentario: "" },
    { id: "nueva", fecha: "2026-10-12" },
  );
  assert.ok(r.ok);
  estado = reducir(estado, { tipo: "registrarEvaluacion", evaluacion: r.valor, pendienteId: "e1" });

  assert.equal(estado.pendientes.some((p) => p.id === "e1"), false);
  const despues = resumenJugador(estado, "j5");
  assert.equal(despues.puntuacion, 100);
  assert.equal(despues.tendencia, 100 - antes.puntuacion!);
  assert.equal(despues.total, antes.total + 1);
  assert.equal(despues.ultima?.id, "nueva");
});

test("evaluacionesDe ordena por fecha y, en empate, la última registrada primero", () => {
  const estado = estadoInicial();
  const base = estado.evaluaciones.find((e) => e.id === "r2")!;
  const mismaFecha = { ...base, id: "r2-bis" };
  const e2 = reducir(estado, { tipo: "registrarEvaluacion", evaluacion: mismaFecha });
  assert.deepEqual(evaluacionesDe(e2, "j1").map((e) => e.id), ["r2-bis", "r2", "r1"]);
});

test("un jugador sin evaluaciones tiene resumen vacío", () => {
  const estado = { ...estadoInicial(), evaluaciones: [] };
  assert.deepEqual(resumenJugador(estado, "j1"), { puntuacion: null, tendencia: null, ultima: null, total: 0 });
});

// ------------------------------------------------------------ Objetivos

test("enteroDeTexto solo acepta enteros no negativos escritos con dígitos", () => {
  assert.equal(enteroDeTexto(" 12 "), 12);
  assert.equal(enteroDeTexto("0"), 0);
  for (const malo of ["", "2,5", "2.5", "-1", "1e3", "abc"]) assert.equal(enteroDeTexto(malo), null);
});

test("validarObjetivo crea un objetivo válido con progreso 0 por defecto", () => {
  const r = validarObjetivo(
    { jugadorId: "j4", titulo: "  Globos   al fondo ", area: "Táctica", meta: "15", progreso: "" },
    { id: "o-nuevo" },
  );
  assert.ok(r.ok);
  assert.deepEqual(r.valor, { id: "o-nuevo", jugadorId: "j4", titulo: "Globos al fondo", area: "Táctica", meta: 15, progreso: 0 });
});

test("validarObjetivo informa de cada campo inválido", () => {
  const r = validarObjetivo({ jugadorId: "", titulo: "ab", area: "Nada", meta: "2,5", progreso: "x" }, { id: "o" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(Object.keys(r.errores).sort(), ["area", "jugadorId", "meta", "progreso", "titulo"]);

  const r2 = validarObjetivo({ jugadorId: "j1", titulo: "Objetivo", area: "Física", meta: "0", progreso: "0" }, { id: "o" });
  assert.equal(r2.ok, false);

  const r3 = validarObjetivo({ jugadorId: "j1", titulo: "Objetivo", area: "Física", meta: "5", progreso: "6" }, { id: "o" });
  assert.equal(r3.ok, false);
  if (!r3.ok) assert.equal(r3.errores.progreso, "El progreso no puede superar la meta.");
});

test("crear objetivo y actualizar su progreso, limitado entre 0 y la meta", () => {
  let estado = estadoInicial();
  const r = validarObjetivo({ jugadorId: "j6", titulo: "Víboras dentro", area: "Técnica", meta: "3", progreso: "1" }, { id: "o9" });
  assert.ok(r.ok);
  estado = reducir(estado, { tipo: "crearObjetivo", objetivo: r.valor });
  const progreso = () => estado.objetivos.find((o) => o.id === "o9")!.progreso;

  estado = reducir(estado, { tipo: "actualizarProgreso", objetivoId: "o9", progreso: 2 });
  assert.equal(progreso(), 2);
  estado = reducir(estado, { tipo: "actualizarProgreso", objetivoId: "o9", progreso: 99 });
  assert.equal(progreso(), 3);
  estado = reducir(estado, { tipo: "actualizarProgreso", objetivoId: "o9", progreso: -4 });
  assert.equal(progreso(), 0);
  // Los demás objetivos no cambian.
  assert.equal(estado.objetivos.find((o) => o.id === "o1")!.progreso, 7);
});

// --------------------------------------------------------- Persistencia

test("restablecer vuelve a los datos ficticios iniciales", () => {
  let estado = reducir(estadoInicial(), { tipo: "actualizarProgreso", objetivoId: "o1", progreso: 0 });
  estado = reducir(estado, { tipo: "restablecer" });
  assert.deepEqual(estado, estadoInicial());
});

test("estadoInicial no comparte referencias con los datos semilla", () => {
  const a = estadoInicial();
  a.objetivos[0]!.progreso = 0;
  assert.equal(estadoInicial().objetivos[0]!.progreso, 7);
});

test("deserializarEstado acepta un estado guardado y rechaza datos corruptos", () => {
  const estado = estadoInicial();
  assert.deepEqual(deserializarEstado(JSON.stringify(estado)), estado);
  assert.equal(deserializarEstado(null), null);
  assert.equal(deserializarEstado("{no es json"), null);
  assert.equal(deserializarEstado(JSON.stringify({ pendientes: [] })), null);
  const notaMala = structuredClone(estado);
  (notaMala.evaluaciones[0]!.notas as Record<string, unknown>).fondo = 9 as Nota;
  assert.equal(deserializarEstado(JSON.stringify(notaMala)), null);
  assert.equal(typeof CLAVE_ALMACEN, "string");
});
