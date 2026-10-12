#!/usr/bin/env node
// Lanza las pruebas E2E contra el Supabase LOCAL (npm run supabase:local).
// Carga .env.e2e.local, compila la app con esas variables y ejecuta Playwright.
// Sin ese archivo se detiene: no se «saltan» pruebas en silencio.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = new URL("..", import.meta.url).pathname;
const archivo = join(raiz, ".env.e2e.local");
if (!existsSync(archivo)) {
  console.error("Falta .env.e2e.local. Arranca antes el Supabase local:  npm run supabase:local");
  process.exit(1);
}
for (const linea of readFileSync(archivo, "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(linea.trim());
  if (m) process.env[m[1]] = m[2];
}
const ejecutar = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: raiz, env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
ejecutar("npx", ["next", "build"]);
ejecutar("npx", ["playwright", "test", ...process.argv.slice(2)]);
