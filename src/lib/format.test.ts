import { test } from "node:test";
import assert from "node:assert/strict";
import { hoyIso, iniciales, textoFecha } from "./format.ts";

test("iniciales", () => {
  assert.equal(iniciales("Lucía Marván"), "LM");
  assert.equal(iniciales("  noa   etxabe  extra "), "NE");
  assert.equal(iniciales(""), "");
});

test("textoFecha formatea en español con un formato fijo (igual en servidor y navegador)", () => {
  assert.equal(textoFecha("2026-09-18"), "18 sept 2026");
  assert.equal(textoFecha("2026-01-01"), "1 ene 2026");
  assert.equal(textoFecha("2026-12-31"), "31 dic 2026");
});

test("textoFecha no lanza errores con fechas inválidas (regresión)", () => {
  assert.equal(textoFecha("abc"), "abc");
  assert.equal(textoFecha("2026-13-01"), "2026-13-01");
});

test("hoyIso usa la fecha local con ceros", () => {
  assert.equal(hoyIso(new Date(2026, 2, 5, 23, 30)), "2026-03-05");
});
