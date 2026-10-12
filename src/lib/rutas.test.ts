import { test } from "node:test";
import assert from "node:assert/strict";
import { esFichaExistente, idJugadorDeRuta } from "./rutas.ts";

test("idJugadorDeRuta extrae y decodifica el identificador", () => {
  assert.equal(idJugadorDeRuta("/jugadores/j1"), "j1");
  assert.equal(idJugadorDeRuta("/jugadores/j1%20"), "j1 ");
  assert.equal(idJugadorDeRuta("/jugadores/"), null);
  assert.equal(idJugadorDeRuta("/jugadores/j1/extra"), null);
  assert.equal(idJugadorDeRuta("/objetivos/j1"), null);
});

test("idJugadorDeRuta no lanza con codificación inválida (regresión: daba 500)", () => {
  assert.equal(idJugadorDeRuta("/jugadores/%E0%A4%A"), null);
  assert.equal(idJugadorDeRuta("/jugadores/%"), null);
});

test("esFichaExistente solo acepta los jugadores de la demo, tal cual", () => {
  for (const id of ["j1", "j2", "j3", "j4", "j5", "j6"]) assert.ok(esFichaExistente(`/jugadores/${id}`), id);
  for (const ruta of ["/jugadores/no-existe", "/jugadores/J1", "/jugadores/j1%20", "/jugadores/j7", "/jugadores/%E0%A4%A"]) {
    assert.equal(esFichaExistente(ruta), false, ruta);
  }
});
