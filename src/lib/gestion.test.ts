import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buscarHomonimo,
  claveNombre,
  edad,
  esUuid,
  filtrarJugadoresReales,
  mensajeErrorBD,
  nombreMiembro,
  normalizarGrupo,
  normalizarJugador,
  resumenJugadorReal,
  validarGrupo,
  textoFunciones,
  validarJugador,
  type JugadorReal,
} from "./gestion.ts";

const HOY = "2026-10-12";

test("validarJugador: datos mínimos y limpieza de espacios", () => {
  const r = validarJugador({ nombre: "  Ana   Pérez ", fecha_nacimiento: "", mano: "", nivel: "", posicion: "", foco: "  " }, HOY);
  assert.deepEqual(r, {
    ok: true,
    valor: { nombre: "Ana Pérez", fecha_nacimiento: null, mano: null, nivel: null, posicion: null, foco: null },
  });
});

test("validarJugador: todos los campos con valores del esquema", () => {
  const r = validarJugador(
    { nombre: "Ana", fecha_nacimiento: "2010-05-03", mano: "zurdo", nivel: "competicion", posicion: "reves", foco: "Bandeja" },
    HOY,
  );
  assert.ok(r.ok);
  assert.deepEqual(r.valor, {
    nombre: "Ana",
    fecha_nacimiento: "2010-05-03",
    mano: "zurdo",
    nivel: "competicion",
    posicion: "reves",
    foco: "Bandeja",
  });
});

test("validarJugador: errores en español por campo", () => {
  const r = validarJugador(
    { nombre: "A", fecha_nacimiento: "2026-02-30", mano: "ambidiestro", nivel: "pro", posicion: "centro", foco: "x".repeat(201) },
    HOY,
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(Object.keys(r.errores).sort(), ["fecha_nacimiento", "foco", "mano", "nivel", "nombre", "posicion"]);
  assert.match(r.errores.nombre, /al menos 2/);
  assert.match(r.errores.fecha_nacimiento, /válida/);
});

test("validarJugador: límites de fecha y de longitud", () => {
  assert.match((validarJugador({ nombre: "Ana", fecha_nacimiento: "2026-10-13" }, HOY) as { errores: Record<string, string> }).errores.fecha_nacimiento, /futura/);
  assert.equal(validarJugador({ nombre: "Ana", fecha_nacimiento: "2026-10-12" }, HOY).ok, true);
  assert.equal(validarJugador({ nombre: "Ana", fecha_nacimiento: "1899-12-31" }, HOY).ok, false);
  assert.equal(validarJugador({ nombre: "x".repeat(120) }, HOY).ok, true);
  assert.equal(validarJugador({ nombre: "x".repeat(121) }, HOY).ok, false);
  assert.equal(validarJugador({ nombre: "Ana", foco: "x".repeat(200) }, HOY).ok, true);
  // Valores no textuales (FormData manipulado) se tratan como vacíos.
  assert.equal(validarJugador({ nombre: 42 }, HOY).ok, false);
});

test("validarGrupo: nombre y entrenador de la propia escuela", () => {
  const miembros = new Set(["11111111-1111-4111-8111-111111111111"]);
  assert.deepEqual(validarGrupo({ nombre: " Sub-14 ", entrenador_id: "" }, miembros), {
    ok: true,
    valor: { nombre: "Sub-14", entrenador_id: null },
  });
  assert.equal(validarGrupo({ nombre: "Sub-14", entrenador_id: "11111111-1111-4111-8111-111111111111" }, miembros).ok, true);
  const ajeno = validarGrupo({ nombre: "Sub-14", entrenador_id: "22222222-2222-4222-8222-222222222222" }, miembros);
  assert.equal(ajeno.ok, false);
  assert.equal(validarGrupo({ nombre: "   " }, miembros).ok, false);
  assert.equal(validarGrupo({ nombre: "x".repeat(81) }, miembros).ok, false);
});

test("homónimos: sin tildes, mayúsculas ni espacios; excluye al propio jugador", () => {
  const lista = [{ id: "a", nombre: "Lucía Marván" }, { id: "b", nombre: "Diego" }];
  assert.equal(claveNombre("  LUCIA   marvan "), "lucia marvan");
  assert.equal(buscarHomonimo(lista, "lucia marvan")?.id, "a");
  assert.equal(buscarHomonimo(lista, "Lucía Marván", "a"), undefined);
  assert.equal(buscarHomonimo(lista, "Otra"), undefined);
});

test("edad y resumen", () => {
  assert.equal(edad("2010-10-12", HOY), 16);
  assert.equal(edad("2010-10-13", HOY), 15);
  assert.equal(edad(null, HOY), null);
  assert.equal(resumenJugadorReal({ nivel: "avanzado", posicion: "reves", fecha_nacimiento: "2025-10-01" }, HOY), "Avanzado · Revés · 1 año");
  assert.equal(resumenJugadorReal({ nivel: null, posicion: null, fecha_nacimiento: null }, HOY), "Sin datos deportivos");
});

test("esUuid", () => {
  assert.equal(esUuid("0b0f6f9e-3c55-4b61-9c51-7a3f6b1c2d3e"), true);
  assert.equal(esUuid("j1"), false);
  assert.equal(esUuid("0b0f6f9e-3c55-4b61-9c51-7a3f6b1c2d3e' or 1=1"), false);
});

test("mensajeErrorBD: códigos de PostgreSQL y PostgREST", () => {
  assert.match(mensajeErrorBD({ code: "42501" }), /permiso/);
  assert.equal(mensajeErrorBD({ code: "23505" }, { duplicado: "Ya existe un grupo con ese nombre." }), "Ya existe un grupo con ese nombre.");
  assert.match(mensajeErrorBD({ code: "23503" }), /otra escuela/);
  assert.match(mensajeErrorBD({ code: "23514" }), /no es válido/);
  assert.match(mensajeErrorBD({ code: "PGRST301" }), /sesión/);
  assert.match(mensajeErrorBD(null), /Inténtalo de nuevo/);
});

test("nombreMiembro", () => {
  assert.equal(nombreMiembro({ usuarioId: "u1", rol: "entrenador", nombre: "Marta" }), "Marta (Entrenador/a)");
  assert.equal(nombreMiembro({ usuarioId: "u1", rol: "director", nombre: null }, "u1"), "Director/a sin nombre visible · tú");
});

test("normalizar filas embebidas (objeto o lista)", () => {
  const j = normalizarJugador({
    id: "j", nombre: "Ana", fecha_nacimiento: null, mano: "diestro", nivel: null, posicion: "drive", foco: null, activo: true,
    grupo_jugadores: [{ grupo: { id: "g2", nombre: "Zeta" } }, { grupo: [{ id: "g1", nombre: "Alfa" }] }, { grupo: null }],
  });
  assert.deepEqual(j.grupos, [{ id: "g1", nombre: "Alfa" }, { id: "g2", nombre: "Zeta" }]);
  const g = normalizarGrupo({
    id: "g", nombre: "Alfa", entrenador_id: null,
    grupo_jugadores: [{ jugador: { id: "b", nombre: "Bea", activo: false } }, { jugador: { id: "a", nombre: "Ana", activo: true } }],
  });
  assert.deepEqual(g.jugadores.map((x) => x.nombre), ["Ana", "Bea"]);
  assert.equal(normalizarGrupo({ id: "g", nombre: "Vacío" }).jugadores.length, 0);
});

test("filtrarJugadoresReales: estado, nivel y texto (incluye grupos)", () => {
  const base: Omit<JugadorReal, "id" | "nombre" | "activo" | "nivel" | "grupos"> = {
    fecha_nacimiento: null, mano: null, posicion: null, foco: null,
  };
  const lista: JugadorReal[] = [
    { ...base, id: "1", nombre: "Lucía", activo: true, nivel: "avanzado", grupos: [{ id: "g", nombre: "Sub-14" }] },
    { ...base, id: "2", nombre: "Diego", activo: true, nivel: "intermedio", grupos: [] },
    { ...base, id: "3", nombre: "Noa", activo: false, nivel: "avanzado", grupos: [] },
  ];
  const ids = (f: Parameters<typeof filtrarJugadoresReales>[1]) => filtrarJugadoresReales(lista, f).map((j) => j.id);
  assert.deepEqual(ids({ texto: "", nivel: null, estado: "activos" }), ["1", "2"]);
  assert.deepEqual(ids({ texto: "", nivel: null, estado: "archivados" }), ["3"]);
  assert.deepEqual(ids({ texto: "lucia", nivel: null, estado: "activos" }), ["1"]);
  assert.deepEqual(ids({ texto: "sub-14", nivel: null, estado: "activos" }), ["1"]);
  assert.deepEqual(ids({ texto: "", nivel: "intermedio", estado: "activos" }), ["2"]);
});

test("textoFunciones: un director con grupos dirige y entrena", () => {
  assert.equal(textoFunciones("director", 0), "Dirección");
  assert.equal(textoFunciones("director", 1), "Dirección y entrenamiento · entrena 1 grupo");
  assert.equal(textoFunciones("director", 3), "Dirección y entrenamiento · entrena 3 grupos");
  assert.equal(textoFunciones("entrenador", 2), "Entrenamiento · 2 grupos");
  assert.equal(textoFunciones("entrenador", 0), "Entrenamiento · sin grupos asignados");
});
