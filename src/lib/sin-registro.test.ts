import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Guardia: la app no ofrece registro público ni forma alguna de concederse
// permisos. Las cuentas las crea el propietario en Supabase o, con una
// invitación válida de un solo uso, el servidor (src/lib/supabase/administracion.ts,
// el ÚNICO archivo que puede usar la clave secreta). Membresías y escuelas solo
// se crean con funciones de la base de datos que comprueban quién llama.

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

const ADMINISTRACION = join("lib", "supabase", "administracion.ts");

test("la clave secreta y la API de administración de Auth solo en administracion.ts", () => {
  for (const { ruta, texto } of fuentes) {
    if (ruta === ADMINISTRACION) continue;
    assert.doesNotMatch(texto, /auth\.admin|SERVICE_ROLE|SUPABASE_SECRET/, ruta);
  }
});

test("administracion.ts: solo en el servidor, solo crea usuarios y la clave no es pública", () => {
  const texto = fuentes.find((f) => f.ruta === ADMINISTRACION)?.texto ?? "";
  assert.match(texto, /^import "server-only";/);
  assert.deepEqual([...texto.matchAll(/auth\.admin\.(\w+)/g)].map((m) => m[1]), ["createUser"]);
  assert.doesNotMatch(texto, /NEXT_PUBLIC_SUPABASE_SECRET|NEXT_PUBLIC_[A-Z_]*SERVICE/);
  // Solo lo importa la acción de invitaciones.
  const usos = fuentes.filter((f) => f.ruta !== ADMINISTRACION && /supabase\/administracion/.test(f.texto)).map((f) => f.ruta);
  assert.deepEqual(usos, ["app/acciones-invitaciones.ts"]);
});

test("la app no escribe membresías ni escuelas (las asigna la dirección por SQL)", () => {
  for (const { ruta, texto } of fuentes) {
    assert.doesNotMatch(texto, /from\("(membresias|escuelas)"\)\s*\.(insert|upsert|delete)/, ruta);
  }
});
