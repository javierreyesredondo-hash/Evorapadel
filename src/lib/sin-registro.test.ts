import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Guardia del piloto: la app no ofrece registro público ni forma alguna de
// concederse permisos. Solo entran usuarios creados a mano en Supabase, con una
// membresía que asigna la dirección por SQL (ver supabase/README.md).

const raiz = join(import.meta.dirname, "..");
const fuentes = readdirSync(raiz, { recursive: true, encoding: "utf8" })
  .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts"))
  .map((f) => ({ ruta: f, texto: readFileSync(join(raiz, f), "utf8") }));

test("hay código fuente que revisar", () => {
  assert.ok(fuentes.length > 20);
});

test("ningún registro público ni acceso por enlace mágico o invitación", () => {
  for (const { ruta, texto } of fuentes) {
    assert.doesNotMatch(texto, /\.signUp\(|signInWithOtp|signInWithOAuth|inviteUserByEmail/, ruta);
  }
});

test("ni API de administración de Auth ni clave secreta en la app", () => {
  for (const { ruta, texto } of fuentes) {
    assert.doesNotMatch(texto, /auth\.admin|SERVICE_ROLE|SUPABASE_SECRET/, ruta);
  }
});

test("la app no escribe membresías ni escuelas (las asigna la dirección por SQL)", () => {
  for (const { ruta, texto } of fuentes) {
    assert.doesNotMatch(texto, /from\("(membresias|escuelas)"\)\s*\.(insert|upsert|delete)/, ruta);
  }
});
