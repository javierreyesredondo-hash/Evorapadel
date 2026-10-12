import { test } from "node:test";
import assert from "node:assert/strict";
import { hoyIso, iniciales, porcentaje, textoFecha, textoVencimiento } from "./format.ts";

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

test("textoFecha formatea en español sin desfase horario", () => {
  assert.match(textoFecha("2026-09-18"), /^18 sept\.? 2026$/);
  assert.match(textoFecha("2026-01-01"), /^1 ene\.? 2026$/);
});

test("hoyIso usa la fecha local con ceros", () => {
  assert.equal(hoyIso(new Date(2026, 2, 5, 23, 30)), "2026-03-05");
});
