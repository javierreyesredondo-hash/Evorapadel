import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoCadena, siguientePendiente } from "./cadena.ts";

const J = ["Ana", "Bea", "Carla", "Dani"].map((nombre, i) => ({ id: `j${i}`, nombre }));
const ev = (jugadorId: string, id = `e-${jugadorId}`) => ({ id, jugadorId, entrenadorId: "u1", numeroNotas: 3 });

test("progreso del grupo y jugadores evaluados hoy", () => {
  const e = estadoCadena(J, [ev("j1"), ev("j1", "otra"), ev("x-no-del-grupo")]);
  assert.equal(e.total, 4);
  assert.equal(e.evaluados, 1);
  assert.equal(e.completado, false);
  assert.equal(e.jugadores[1].evaluacion?.id, "e-j1"); // la primera si hubiera varias
  assert.equal(estadoCadena(J, J.map((j) => ev(j.id))).completado, true);
  assert.equal(estadoCadena([], []).completado, false);
});

test("siguiente pendiente: después del actual, vuelve al principio y salta los evaluados", () => {
  const e = estadoCadena(J, [ev("j1")]);
  assert.equal(siguientePendiente(e, null)?.nombre, "Ana");
  assert.equal(siguientePendiente(e, "j0")?.nombre, "Carla"); // Bea ya está evaluada
  assert.equal(siguientePendiente(e, "j3")?.nombre, "Ana"); // vuelve al principio
  assert.equal(siguientePendiente(e, "j2", ["j2", "j3"])?.nombre, "Ana"); // recién guardados en esta sesión
  assert.equal(siguientePendiente(e, "j0", ["j0", "j2", "j3"]), null);
  assert.equal(siguientePendiente(estadoCadena(J, J.map((j) => ev(j.id))), "j0"), null);
});
