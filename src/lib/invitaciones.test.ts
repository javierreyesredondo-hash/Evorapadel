import { test } from "node:test";
import assert from "node:assert/strict";
import {
  codigoErrorInvitacion,
  enlaceInvitacion,
  enmascararEmail,
  esTokenValido,
  generarToken,
  hashToken,
  mensajeInvitacion,
  validarAltaEscuela,
  validarContrasenaNueva,
  validarInvitacion,
} from "./invitaciones.ts";

test("token: aleatorio, 256 bits en base64url y distinto cada vez", () => {
  const tokens = new Set(Array.from({ length: 200 }, generarToken));
  assert.equal(tokens.size, 200);
  for (const t of tokens) assert.ok(esTokenValido(t), t);
  assert.equal(esTokenValido("corto"), false);
  assert.equal(esTokenValido(`${"a".repeat(42)}!`), false);
  assert.equal(esTokenValido(null), false);
});

test("hash: SHA-256 en hexadecimal (lo único que se guarda)", async () => {
  assert.equal(await hashToken("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  const t = generarToken();
  assert.match(await hashToken(t), /^[0-9a-f]{64}$/);
  assert.notEqual(await hashToken(t), t);
});

test("enlace: el token va en el fragmento (no llega al servidor ni a sus registros)", () => {
  assert.equal(enlaceInvitacion("https://app.evora.example/", "TOKEN"), "https://app.evora.example/invitacion#TOKEN");
  const u = new URL(enlaceInvitacion("https://app.evora.example", "TOKEN"));
  assert.equal(u.pathname + u.search, "/invitacion");
});

test("correo enmascarado: identifica sin mostrarlo entero", () => {
  assert.equal(enmascararEmail("nueva.directora@evora.invalid"), "n***a@evora.invalid");
  assert.equal(enmascararEmail("jo@x.es"), "j***@x.es");
  assert.equal(enmascararEmail("sin-arroba"), "***");
});

test("alta de escuela e invitación: validación", () => {
  const ok = validarAltaEscuela({ nombre: "  Escuela   Nueva ", email: " Dir@Evora.INVALID ", dias: "" });
  assert.deepEqual(ok, { ok: true, valor: { nombre: "Escuela Nueva", email: "dir@evora.invalid", dias: 7 } });
  const mal = validarAltaEscuela({ nombre: "X", email: "no-es-correo", dias: "45" });
  assert.equal(mal.ok, false);
  assert.deepEqual(Object.keys((mal as { errores: object }).errores).sort(), ["dias", "email", "nombre"]);
  assert.equal(validarInvitacion({ email: "a@b.es", dias: 30 }).ok, true);
  assert.equal(validarInvitacion({ email: "a@b.es", dias: 0 }).ok, false);
  assert.equal(validarInvitacion({ email: "a@b.es", dias: "2.5" }).ok, false);
});

test("contraseña de la cuenta nueva", () => {
  assert.deepEqual(validarContrasenaNueva("contraseña-larga", "contraseña-larga"), { ok: true, valor: "contraseña-larga" });
  assert.equal(validarContrasenaNueva("corta", "corta").ok, false);
  assert.equal(validarContrasenaNueva("contraseña-larga", "otra-distinta").ok, false);
  assert.equal(validarContrasenaNueva("x".repeat(73), "x".repeat(73)).ok, false);
});

test("mensajes de error: claros y sin datos internos", () => {
  assert.equal(codigoErrorInvitacion({ message: "INVITACION_CADUCADA" }), "INVITACION_CADUCADA");
  assert.equal(codigoErrorInvitacion({ message: "otra cosa" }), null);
  assert.match(mensajeInvitacion("INVITACION_OTRO_CORREO"), /otro correo/);
  assert.match(mensajeInvitacion("caducada"), /caducado/);
  assert.match(mensajeInvitacion("desconocido"), /no es válido/);
});
