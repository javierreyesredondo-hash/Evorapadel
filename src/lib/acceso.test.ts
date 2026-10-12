import { test } from "node:test";
import assert from "node:assert/strict";
import {
  destinoTrasAcceso,
  esErrorDeEsquema,
  esRutaPublica,
  mensajeErrorAuth,
  normalizarMembresias,
  validarConfigSupabase,
  validarCredenciales,
} from "./acceso.ts";

const jwt = (payload: object) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.firma`;

// ------------------------------------------------------------- Configuración

test("config: acepta URL https y clave pública", () => {
  const r = validarConfigSupabase("https://abc.supabase.co/", "sb_publishable_123");
  assert.ok(r.ok);
  assert.equal(r.config.url, "https://abc.supabase.co");
  assert.ok(validarConfigSupabase("https://abc.supabase.co", jwt({ role: "anon" })).ok);
  assert.ok(validarConfigSupabase("http://127.0.0.1:54321", jwt({ role: "anon" })).ok, "http solo en local");
});

test("config: rechaza claves secretas o service_role (no deben llegar a la web)", () => {
  assert.equal(validarConfigSupabase("https://abc.supabase.co", "sb_secret_abc").ok, false);
  assert.equal(validarConfigSupabase("https://abc.supabase.co", jwt({ role: "service_role" })).ok, false);
});

test("config: rechaza variables ausentes, URL inválida o http fuera de local", () => {
  assert.equal(validarConfigSupabase(undefined, "x").ok, false);
  assert.equal(validarConfigSupabase("https://abc.supabase.co", "").ok, false);
  assert.equal(validarConfigSupabase("no es url", "x").ok, false);
  assert.equal(validarConfigSupabase("http://abc.supabase.co", "x").ok, false);
});

// ------------------------------------------------------------- Formulario

test("credenciales válidas: email normalizado (minúsculas, sin espacios)", () => {
  const r = validarCredenciales("  Ana@Ejemplo.COM ", "secreta");
  assert.ok(r.ok);
  assert.deepEqual(r.valor, { email: "ana@ejemplo.com", contrasena: "secreta" });
});

test("credenciales: errores en español por campo", () => {
  const vacio = validarCredenciales("", "");
  assert.equal(vacio.ok, false);
  if (!vacio.ok) {
    assert.equal(vacio.errores.email, "Escribe tu correo electrónico.");
    assert.equal(vacio.errores.contrasena, "Escribe tu contraseña.");
  }
  for (const malo of ["ana", "ana@", "@ejemplo.com", "ana @ejemplo.com", `${"a".repeat(250)}@x.es`]) {
    const r = validarCredenciales(malo, "x");
    assert.equal(r.ok, false, malo);
    if (!r.ok) assert.equal(r.errores.email, "Escribe un correo electrónico válido.");
  }
  const larga = validarCredenciales("ana@ejemplo.com", "ñ".repeat(37)); // 74 bytes
  assert.equal(larga.ok, false);
  assert.equal(validarCredenciales(null, undefined).ok, false);
});

test("errores de Supabase traducidos sin revelar si la cuenta existe", () => {
  assert.equal(mensajeErrorAuth({ code: "invalid_credentials", status: 400 }), "Correo o contraseña incorrectos.");
  assert.equal(mensajeErrorAuth({ code: "user_not_found" }), "Correo o contraseña incorrectos.");
  assert.match(mensajeErrorAuth({ code: "email_not_confirmed" }), /confirmar tu correo/);
  assert.match(mensajeErrorAuth({ code: "user_banned" }), /desactivada/);
  assert.match(mensajeErrorAuth({ status: 429 }), /Demasiados intentos/);
  assert.match(mensajeErrorAuth({ name: "AuthRetryableFetchError" }), /No se ha podido iniciar sesión/);
});

// ------------------------------------------------------------- Rutas

test("rutas públicas: solo /acceso", () => {
  assert.ok(esRutaPublica("/acceso"));
  assert.equal(esRutaPublica("/"), false);
  assert.equal(esRutaPublica("/accesos"), false);
  assert.equal(esRutaPublica("/jugadores"), false);
});

test("destino tras el acceso: solo rutas internas (sin redirección abierta)", () => {
  assert.equal(destinoTrasAcceso("/jugadores/j1"), "/jugadores/j1");
  assert.equal(destinoTrasAcceso("/evaluaciones/nueva?pendiente=e1"), "/evaluaciones/nueva?pendiente=e1");
  for (const malo of [null, "", "jugadores", "//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)",
    "/%0d%0aLocation: x", "\\\\evil.com", "/acceso", "/acceso?siguiente=/x", "/a\u0000b", "/" + "x".repeat(600)]) {
    const d = destinoTrasAcceso(malo);
    assert.ok(d === "/" || (d.startsWith("/") && !d.startsWith("//")), `${String(malo)} → ${d}`);
    assert.ok(!d.includes("evil"), `${String(malo)} → ${d}`);
  }
  assert.equal(destinoTrasAcceso("/acceso"), "/");
  assert.equal(destinoTrasAcceso("//evil.com"), "/");
});

// ------------------------------------------------------------- Membresías

test("membresías: normaliza la respuesta de PostgREST y descarta filas inválidas", () => {
  const filas = [
    { rol: "entrenador", escuela: { id: "b", nombre: "Escuela B" } },
    { rol: "director", escuela: [{ id: "a", nombre: "Escuela A" }] },
    { rol: "admin", escuela: { id: "c", nombre: "Escuela C" } },
    { rol: "director", escuela: null },
    { rol: "director", escuela: { id: 5, nombre: "X" } },
    null,
    "basura",
  ];
  assert.deepEqual(normalizarMembresias(filas), [
    { escuelaId: "a", escuelaNombre: "Escuela A", rol: "director" },
    { escuelaId: "b", escuelaNombre: "Escuela B", rol: "entrenador" },
  ]);
  assert.deepEqual(normalizarMembresias(null), []);
  assert.deepEqual(normalizarMembresias({}), []);
});

test("detecta errores de esquema (tabla o columna inexistente)", () => {
  assert.ok(esErrorDeEsquema({ code: "PGRST205" }));
  assert.ok(esErrorDeEsquema({ code: "42P01" }));
  assert.equal(esErrorDeEsquema({ code: "42501" }), false);
  assert.equal(esErrorDeEsquema(null), false);
});
