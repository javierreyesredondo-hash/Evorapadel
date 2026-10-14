import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirRuta, idDeRuta } from "./rutas.ts";

const UUID = "0b0f6f9e-3c55-4b61-9c51-7a3f6b1c2d3e";

test("idDeRuta extrae y decodifica el identificador", () => {
  assert.equal(idDeRuta("/jugadores/j1", "/jugadores/"), "j1");
  assert.equal(idDeRuta("/jugadores/j1%20", "/jugadores/"), "j1 ");
  assert.equal(idDeRuta("/jugadores/", "/jugadores/"), null);
  assert.equal(idDeRuta("/jugadores/j1/extra", "/jugadores/"), null);
  assert.equal(idDeRuta("/objetivos/j1", "/jugadores/"), null);
});

test("idDeRuta no lanza con codificación inválida (regresión: daba 500)", () => {
  assert.equal(idDeRuta("/jugadores/%E0%A4%A", "/jugadores/"), null);
  assert.equal(idDeRuta("/jugadores/%", "/jugadores/"), null);
});

test("la demostración ya no existe: sus antiguas fichas (/jugadores/j1) dan 404", () => {
  for (const id of ["j1", "j3", "j6"]) assert.deepEqual(decidirRuta(`/jugadores/${id}`), { tipo: "no-encontrado" }, id);
});

test("fichas reales: UUID o «nuevo»; lo demás es 404 sin consultar la base de datos", () => {
  for (const ruta of [`/jugadores/${UUID}`, "/jugadores/nuevo", `/grupos/${UUID}`, "/grupos/nuevo", `/evaluaciones/${UUID}`, "/evaluaciones/nueva", `/evaluaciones/${UUID}/pdf`, `/metodologia/importadas/${UUID}`, "/metodologia/importar", `/entrenamiento/evaluar/${UUID}`, `/jugadores/${UUID}/editar`, "/jugadores", "/grupos"]) {
    assert.deepEqual(decidirRuta(ruta), { tipo: "seguir" }, ruta);
  }
  for (const ruta of ["/jugadores/no-existe", "/jugadores/J1", "/grupos/abc", "/jugadores/x%27", "/jugadores/%E0%A4%A", "/grupos/%", "/evaluaciones/r1", "/evaluaciones/x%27", "/metodologia/importadas/abc", "/entrenamiento/evaluar/grupo-x"]) {
    assert.deepEqual(decidirRuta(ruta), { tipo: "no-encontrado" }, ruta);
  }
});
