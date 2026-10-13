#!/usr/bin/env node
// Supabase LOCAL y desechable para desarrollo y pruebas E2E (nunca el proyecto real).
//
//   npm run supabase:local         arranca, aplica las migraciones y crea datos sintéticos
//   npm run supabase:local:parar   lo detiene y borra todo
//
// Componentes (los mismos que usa Supabase):
//   - Postgres:  imagen oficial supabase/postgres (Docker)
//   - Auth:      supabase/gotrue (Docker), que crea el esquema auth completo
//   - API REST:  PostgREST (binario oficial de GitHub, verificado con SHA-256)
//   - Pasarela:  scripts/pasarela-local.mjs (/auth/v1 y /rest/v1, como Kong)
//
// Escribe .env.e2e.local (ignorado por git) con la URL, la clave PÚBLICA y las
// credenciales de usuarios sintéticos (@evora.invalid). La clave service_role
// local solo la usa este script para crear usuarios: no se escribe en ese
// archivo ni llega a la app.
import { createHmac, createHash, randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = new URL("..", import.meta.url).pathname;
const cache = join(raiz, ".cache/supabase-local");
const estadoArchivo = join(cache, "estado.json");
const envArchivo = join(raiz, ".env.e2e.local");

const RED = "evora-local";
const DB = "evora-db";
const AUTH = "evora-auth";
const IMAGEN_DB = process.env.IMAGEN_DB ?? "supabase/postgres:17.11.0.004";
const IMAGEN_AUTH = process.env.IMAGEN_AUTH ?? "supabase/gotrue:v2.197.0";
const POSTGREST = {
  version: "v14.1",
  sha256: "bdab6ab3389ca0d6c1f3b8363491674dbca71875c3f30261d92d8fecdde35277",
};
const PUERTO = { db: 54322, auth: 54329, rest: 54331, pasarela: 54321 };
const CLAVE_DB = "solo-local";
const URL_PUBLICA = `http://127.0.0.1:${PUERTO.pasarela}`;

const sh = (cmd, args, opciones = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...opciones });
const docker = (...args) => sh("docker", args);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const b64url = (x) => Buffer.from(x).toString("base64url");

function jwt(payload, secreto) {
  const cabecera = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const cuerpo = b64url(JSON.stringify(payload));
  const firma = createHmac("sha256", secreto).update(`${cabecera}.${cuerpo}`).digest("base64url");
  return `${cabecera}.${cuerpo}.${firma}`;
}

async function hasta(descripcion, comprobar, intentos = 60) {
  for (let i = 0; i < intentos; i++) {
    try {
      if (await comprobar()) return;
    } catch {
      /* reintentar */
    }
    await esperar(2000);
  }
  throw new Error(`Tiempo agotado esperando: ${descripcion}`);
}

function psql(sql, usuario = "supabase_admin") {
  return docker("exec", "-i", DB, "psql", "-U", usuario, "-d", "postgres", "-XAt", "-v", "ON_ERROR_STOP=1", "-c", sql).trim();
}

async function binarioPostgrest() {
  if (process.env.POSTGREST_BIN) return process.env.POSTGREST_BIN;
  const dir = join(cache, `postgrest-${POSTGREST.version}`);
  const bin = join(dir, "postgrest");
  if (existsSync(bin)) return bin;
  mkdirSync(dir, { recursive: true });
  const url = `https://github.com/PostgREST/postgrest/releases/download/${POSTGREST.version}/postgrest-${POSTGREST.version}-linux-static-x86-64.tar.xz`;
  console.log(`Descargando PostgREST ${POSTGREST.version}…`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo descargar PostgREST (${r.status}). Define POSTGREST_BIN.`);
  const datos = Buffer.from(await r.arrayBuffer());
  const suma = createHash("sha256").update(datos).digest("hex");
  if (suma !== POSTGREST.sha256) throw new Error(`Checksum de PostgREST inesperado: ${suma}`);
  const archivo = join(dir, "postgrest.tar.xz");
  writeFileSync(archivo, datos);
  sh("tar", ["-xJf", archivo, "-C", dir]);
  return bin;
}

function lanzarSegundoPlano(comando, args, env, log) {
  const hijo = spawn(comando, args, { env: { ...process.env, ...env }, detached: true, stdio: ["ignore", "ignore", "ignore"] });
  hijo.unref();
  writeFileSync(log, `${comando} pid ${hijo.pid}\n`);
  return hijo.pid;
}

async function arrancar() {
  parar({ silencioso: true });
  mkdirSync(cache, { recursive: true });
  const secreto = randomBytes(32).toString("base64url");
  const ahora = Math.floor(Date.now() / 1000);
  const anon = jwt({ role: "anon", iss: "supabase-local", iat: ahora, exp: ahora + 60 * 60 * 24 * 365 }, secreto);
  const servicio = jwt({ role: "service_role", iss: "supabase-local", iat: ahora, exp: ahora + 60 * 60 * 24 * 365 }, secreto);

  console.log("Postgres…");
  try { docker("network", "create", RED); } catch { /* ya existe */ }
  docker("run", "-d", "--name", DB, "--network", RED, "--network-alias", "db", "-e", `POSTGRES_PASSWORD=${CLAVE_DB}`,
    "-p", `127.0.0.1:${PUERTO.db}:5432`, IMAGEN_DB);
  await hasta("roles de Supabase", () => psql("select 1 from pg_roles where rolname = 'authenticator'") === "1");
  // Contraseñas de los roles internos: solo en este contenedor local.
  psql(`alter role supabase_auth_admin with password '${CLAVE_DB}'; alter role authenticator with password '${CLAVE_DB}';`);

  console.log("Auth (GoTrue)…");
  docker("run", "-d", "--name", AUTH, "--network", RED, "-p", `127.0.0.1:${PUERTO.auth}:9999`,
    "-e", "GOTRUE_API_HOST=0.0.0.0", "-e", "GOTRUE_API_PORT=9999",
    "-e", `API_EXTERNAL_URL=${URL_PUBLICA}/auth/v1`, "-e", "GOTRUE_SITE_URL=http://localhost:3100",
    "-e", "GOTRUE_DB_DRIVER=postgres", "-e", `GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:${CLAVE_DB}@db:5432/postgres`,
    "-e", "GOTRUE_DISABLE_SIGNUP=true", "-e", "GOTRUE_EXTERNAL_EMAIL_ENABLED=true", "-e", "GOTRUE_MAILER_AUTOCONFIRM=true",
    "-e", `GOTRUE_JWT_SECRET=${secreto}`, "-e", "GOTRUE_JWT_EXP=3600", "-e", "GOTRUE_JWT_AUD=authenticated",
    "-e", "GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated", "-e", "GOTRUE_JWT_ADMIN_ROLES=service_role",
    IMAGEN_AUTH);
  await hasta("GoTrue", async () => (await fetch(`http://127.0.0.1:${PUERTO.auth}/health`)).ok);

  console.log("Migraciones (como postgres, igual que la CLI de Supabase)…");
  docker("exec", DB, "mkdir", "-p", "/tmp/migraciones");
  docker("cp", `${join(raiz, "supabase/migrations")}/.`, `${DB}:/tmp/migraciones/`);
  for (const m of readdirSync(join(raiz, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    docker("exec", "-i", DB, "psql", "-U", "postgres", "-d", "postgres", "-Xq", "-v", "ON_ERROR_STOP=1",
      "--single-transaction", "-f", `/tmp/migraciones/${m}`);
    console.log(`  ✓ ${m}`);
  }

  console.log("API REST (PostgREST) y pasarela…");
  const pids = [];
  pids.push(lanzarSegundoPlano(await binarioPostgrest(), [], {
    PGRST_DB_URI: `postgres://authenticator:${CLAVE_DB}@127.0.0.1:${PUERTO.db}/postgres`,
    PGRST_DB_SCHEMAS: "public", PGRST_DB_ANON_ROLE: "anon", PGRST_JWT_SECRET: secreto,
    PGRST_SERVER_HOST: "127.0.0.1", PGRST_SERVER_PORT: String(PUERTO.rest),
    // Sin caché de JWT: si PostgREST rechaza un token recién emitido
    // («JWT issued at future», reloj interno con hasta 1 s de retraso), el
    // reintento de la app vuelve a validarlo en lugar de repetir el error guardado.
    PGRST_JWT_CACHE_MAX_ENTRIES: "0",
  }, join(cache, "postgrest.log")));
  pids.push(lanzarSegundoPlano(process.execPath, [join(raiz, "scripts/pasarela-local.mjs")], {
    PASARELA_PUERTO: String(PUERTO.pasarela), PASARELA_AUTH: `http://127.0.0.1:${PUERTO.auth}`,
    PASARELA_REST: `http://127.0.0.1:${PUERTO.rest}`,
  }, join(cache, "pasarela.log")));
  writeFileSync(estadoArchivo, JSON.stringify({ pids }));
  await hasta("pasarela y PostgREST", async () => (await fetch(`${URL_PUBLICA}/rest/v1/`, { headers: { apikey: anon } })).ok);

  console.log("Datos sintéticos…");
  const contrasena = randomBytes(18).toString("base64url");
  const usuarios = {
    DIRECTOR_A: "director-a@evora.invalid",
    ENTRENADOR_A: "entrenador-a@evora.invalid",
    DIRECTOR_B: "director-b@evora.invalid",
    DIRECTOR_C: "director-c@evora.invalid",
    SIN_ESCUELA: "sin-escuela@evora.invalid",
  };
  for (const email of Object.values(usuarios)) {
    const r = await fetch(`${URL_PUBLICA}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: servicio, authorization: `Bearer ${servicio}`, "content-type": "application/json" },
      body: JSON.stringify({ email, password: contrasena, email_confirm: true }),
    });
    if (!r.ok) throw new Error(`No se pudo crear ${email}: ${r.status} ${await r.text()}`);
  }
  // Escuelas con el procedimiento seguro de la migración 2 (como postgres = SQL Editor).
  psql(`select privado.crear_escuela_con_director('Escuela Demo A', '${usuarios.DIRECTOR_A}');`, "postgres");
  psql(`select privado.crear_escuela_con_director('Escuela Demo B', '${usuarios.DIRECTOR_B}');`, "postgres");
  psql(`insert into public.membresias (escuela_id, usuario_id, rol)
        select e.id, u.id, 'entrenador' from public.escuelas e, auth.users u
        where e.nombre = 'Escuela Demo A' and u.email = '${usuarios.ENTRENADOR_A}';`, "postgres");
  // Escuela C: sin metodología, para probar la carga de la metodología base.
  psql(`select privado.crear_escuela_con_director('Escuela Demo C', '${usuarios.DIRECTOR_C}');`, "postgres");
  // Metodología de A y B: la base de la app (src/lib/metodologia.ts).
  const { METODOLOGIA_BASE } = await import("../src/lib/metodologia.ts");
  const valores = METODOLOGIA_BASE.map((c, i) =>
    `('${c.nombre.replaceAll("'", "''")}', '${c.area}', '${c.descripcion.replaceAll("'", "''")}', ${i + 1})`).join(", ");
  psql(`insert into public.competencias (escuela_id, nombre, area, descripcion, orden)
        select e.id, v.nombre, v.area::public.area_competencia, v.descripcion, v.orden
        from public.escuelas e, (values ${valores}) as v (nombre, area, descripcion, orden)
        where e.nombre in ('Escuela Demo A', 'Escuela Demo B');`, "postgres");

  const lineas = [
    "# Generado por scripts/supabase-local.mjs — Supabase LOCAL, datos sintéticos. No subir.",
    `NEXT_PUBLIC_SUPABASE_URL=${URL_PUBLICA}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${anon}`,
    `E2E_CONTRASENA=${contrasena}`,
    ...Object.entries(usuarios).map(([k, v]) => `E2E_EMAIL_${k}=${v}`),
  ];
  writeFileSync(envArchivo, `${lineas.join("\n")}\n`);
  console.log(`\nListo: ${URL_PUBLICA} · variables en .env.e2e.local`);
}

function parar({ silencioso = false } = {}) {
  if (existsSync(estadoArchivo)) {
    const { pids = [] } = JSON.parse(readFileSync(estadoArchivo, "utf8"));
    for (const pid of pids) {
      try { process.kill(pid); } catch { /* ya terminado */ }
    }
    rmSync(estadoArchivo);
  }
  for (const c of [AUTH, DB]) {
    try { docker("rm", "-f", c); } catch { /* no existe */ }
  }
  try { docker("network", "rm", RED); } catch { /* no existe */ }
  if (existsSync(envArchivo)) rmSync(envArchivo);
  if (!silencioso) console.log("Supabase local detenido y borrado.");
}

/**
 * Deja la «Escuela Demo C» sin metodología (local): las pruebas E2E comprueban
 * la carga de la metodología base y deben poder repetirse.
 */
function restablecer() {
  psql(`delete from public.competencias
        where escuela_id = (select id from public.escuelas where nombre = 'Escuela Demo C')
          and not exists (select 1 from public.evaluacion_puntuaciones p where p.competencia_id = competencias.id);`, "postgres");
}

const orden = process.argv[2] ?? "arrancar";
if (orden === "parar") parar();
else if (orden === "restablecer") restablecer();
else arrancar().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exitCode = 1;
});
