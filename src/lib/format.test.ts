import { test } from "node:test";
import assert from "node:assert/strict";
import { iniciales, porcentaje, textoVencimiento } from "./format.ts";

test("porcentaje redondea y se limita a 0–100", () => {
  assert.equal(porcentaje(7, 10), 70);
  assert.equal(porcentaje(1, 3), 33);
  assert.equal(porcentaje(15, 10), 100);
  assert.equal(porcentaje(-1, 10), 0);
  assert.equal(porcentaje(5, 0), 0);
});

test("textoVencimiento", () => {
  assert.equal(textoVencimiento(-3), "Vencida hace 3 días");
  assert.equal(textoVencimiento(-1), "Vencida ayer");
  assert.equal(textoVencimiento(0), "Hoy");
  assert.equal(textoVencimiento(1), "Mañana");
  assert.equal(textoVencimiento(4), "En 4 días");
});

test("iniciales", () => {
  assert.equal(iniciales("Lucía Marván"), "LM");
  assert.equal(iniciales("  noa   etxabe  extra "), "NE");
  assert.equal(iniciales(""), "");
});
