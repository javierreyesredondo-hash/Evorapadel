#!/usr/bin/env node
// Escuela de DEMOSTRACIÓN para las capturas del vídeo (solo Supabase LOCAL).
//
// Todos los datos son ficticios (nombres inventados, correos @evora.invalid).
// Requiere el Supabase local arrancado con `npm run supabase:local` en la raíz
// del repositorio. Nunca apunta a producción: lee .env.e2e.local y se niega a
// seguir si la URL no es 127.0.0.1.

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { METODOLOGIA_BASE, ESCALA_NOTAS, AREA_TEXTO } from "../../../src/lib/metodologia.ts";
import { generarRedaccion, escalaDescrita, VERSION_GENERADOR } from "../../../src/lib/redaccion.ts";

const raiz = new URL("../../../", import.meta.url).pathname;
const env = Object.fromEntries(
  readFileSync(join(raiz, ".env.e2e.local"), "utf8")
    .split("\n")
    .map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/127\.0\.0\.1:/.test(URL_SB)) throw new Error("Solo Supabase local (127.0.0.1).");

export const DEMO = {
  email: "demo-director@evora.invalid",
  contrasena: env.E2E_CONTRASENA,
  nombre: "Marta Vidal",
  escuela: "Altamar Pádel Club",
};

const psql = (sql) =>
  execFileSync("docker", ["exec", "-i", "evora-db", "psql", "-U", "postgres", "-d", "postgres", "-XAt", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
  }).trim();
const q = (s) => `'${String(s).replaceAll("'", "''")}'`;

// 1. Cuenta del director de demostración.
const admin = createClient(URL_SB, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const existe = psql(`select count(*) from auth.users where email = ${q(DEMO.email)}`) === "1";
if (!existe) {
  const { error } = await admin.auth.admin.createUser({ email: DEMO.email, password: DEMO.contrasena, email_confirm: true });
  if (error) throw error;
}
if (psql(`select count(*) from public.escuelas where nombre = ${q(DEMO.escuela)}`) === "0") {
  psql(`select privado.crear_escuela_con_director(${q(DEMO.escuela)}, ${q(DEMO.email)});`);
}
psql(`update public.perfiles set nombre_visible = ${q(DEMO.nombre)} where id = (select id from auth.users where email = ${q(DEMO.email)});`);
// El director de demostración NO es administrador (pantallas de un entrenador normal).

// Otras escuelas (ficticias) para que el panel del propietario tenga contenido.
for (const [nombre, correo] of [
  ["Club Pádel Brisamar", "direccion-brisamar@evora.invalid"],
  ["Escuela Pádel Los Robles", "direccion-robles@evora.invalid"],
  ["Pádel Indoor Valdecierzo", "direccion-valdecierzo@evora.invalid"],
]) {
  if (psql(`select count(*) from auth.users where email = ${q(correo)}`) === "0") {
    const { error } = await admin.auth.admin.createUser({ email: correo, password: DEMO.contrasena, email_confirm: true });
    if (error) throw error;
  }
  if (psql(`select count(*) from public.escuelas where nombre = ${q(nombre)}`) === "0") {
    psql(`select privado.crear_escuela_con_director(${q(nombre)}, ${q(correo)});`);
  }
}

const escuelaId = psql(`select id from public.escuelas where nombre = ${q(DEMO.escuela)}`);

// 2. Metodología: competencias base de ÉVORA.
if (psql(`select count(*) from public.competencias where escuela_id = ${q(escuelaId)}`) === "0") {
  const valores = METODOLOGIA_BASE.map((c, i) => `(${q(c.nombre)}, ${q(c.area)}, ${q(c.descripcion)}, ${i + 1})`).join(", ");
  psql(`insert into public.competencias (escuela_id, nombre, area, descripcion, orden)
        select ${q(escuelaId)}, v.nombre, v.area::public.area_competencia, v.descripcion, v.orden
        from (values ${valores}) as v (nombre, area, descripcion, orden);`);
}

// 3. Jugadores y grupos (nombres inventados).
const JUGADORES = [
  ["Lucía Martín", "2010-03-14", "diestro", "competicion", "reves", "Bandeja ofensiva y transición a la red"],
  ["Hugo Navarro", "2009-11-02", "diestro", "competicion", "drive", "Consistencia en el resto"],
  ["Carla Ibáñez", "2011-06-21", "zurdo", "avanzado", "reves", "Lectura de la pared de fondo"],
  ["Mateo Ruiz", "2012-01-30", "diestro", "intermedio", "drive", "Volea de revés"],
  ["Sofía Delgado", "2010-09-05", "diestro", "avanzado", "drive", "Globo defensivo"],
  ["Álvaro Prieto", "2011-04-17", "zurdo", "intermedio", "reves", "Gestión del error"],
  ["Martina Gil", "2013-02-08", "diestro", "iniciacion", "drive", "Posición en la red"],
  ["Daniel Ortega", "2012-12-12", "diestro", "intermedio", "reves", "Desplazamientos laterales"],
  ["Noa Herrera", "2013-07-26", "zurdo", "iniciacion", "reves", "Empuñadura continental"],
  ["Pablo Serrano", "2009-05-19", "diestro", "competicion", "drive", "Remate por tres"],
];
if (psql(`select count(*) from public.jugadores where escuela_id = ${q(escuelaId)}`) === "0") {
  const valores = JUGADORES.map(([n, f, m, ni, p, fo]) => `(${q(escuelaId)}, ${q(n)}, ${q(f)}, ${q(m)}, ${q(ni)}, ${q(p)}, ${q(fo)})`).join(", ");
  psql(`insert into public.jugadores (escuela_id, nombre, fecha_nacimiento, mano, nivel, posicion, foco)
        select v.e::uuid, v.n, v.f::date, v.m::public.mano_dominante, v.ni::public.nivel_jugador, v.p::public.posicion_jugador, v.fo
        from (values ${valores}) as v (e, n, f, m, ni, p, fo);`);
}
const GRUPOS = {
  "Competición Sub-16": ["Lucía Martín", "Hugo Navarro", "Carla Ibáñez", "Sofía Delgado", "Pablo Serrano"],
  "Perfeccionamiento": ["Mateo Ruiz", "Álvaro Prieto", "Daniel Ortega"],
  "Iniciación martes": ["Martina Gil", "Noa Herrera"],
};
const directorId = psql(`select id from auth.users where email = ${q(DEMO.email)}`);
for (const [grupo, miembros] of Object.entries(GRUPOS)) {
  if (psql(`select count(*) from public.grupos where escuela_id = ${q(escuelaId)} and nombre = ${q(grupo)}`) === "0") {
    psql(`insert into public.grupos (escuela_id, nombre, entrenador_id) values (${q(escuelaId)}, ${q(grupo)}, ${q(directorId)});`);
  }
  psql(`insert into public.grupo_jugadores (escuela_id, grupo_id, jugador_id)
        select g.escuela_id, g.id, j.id from public.grupos g join public.jugadores j on j.escuela_id = g.escuela_id
        where g.escuela_id = ${q(escuelaId)} and g.nombre = ${q(grupo)} and j.nombre in (${miembros.map(q).join(", ")})
        on conflict do nothing;`);
}

// 4. Evaluaciones con la app real: sesión del director + RPC guardar_evaluacion
//    y la redacción automática del generador de la app (src/lib/redaccion.ts).
const cliente = createClient(URL_SB, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: errorSesion } = await cliente.auth.signInWithPassword({ email: DEMO.email, password: DEMO.contrasena });
if (errorSesion) throw errorSesion;

const { data: competencias } = await cliente.from("competencias").select("id, nombre, area, descripcion, orden").eq("escuela_id", escuelaId).order("orden");
const { data: jugadores } = await cliente.from("jugadores").select("id, nombre").eq("escuela_id", escuelaId);
const { data: grupos } = await cliente.from("grupos").select("id, nombre").eq("escuela_id", escuelaId);
const idJugador = (n) => jugadores.find((j) => j.nombre === n).id;
const idGrupo = (n) => grupos.find((g) => g.nombre === n).id;
const escala = escalaDescrita(ESCALA_NOTAS);

const hoy = new Date();
const haceDias = (d) => new Date(hoy.getTime() - d * 86400000).toISOString().slice(0, 10);

// [jugador, grupo, días atrás, tipo, notas por competencia (orden base), objetivo, observaciones]
const EVALUACIONES = [
  ["Lucía Martín", "Competición Sub-16", 150, "completa", [3, 2, 2, 3, 3, 2], "Ganar la red tras el globo del rival", "Primer trimestre: buena base desde el fondo."],
  ["Lucía Martín", "Competición Sub-16", 100, "completa", [3, 3, 3, 3, 3, 3], "Bandeja con intención ofensiva", null],
  ["Lucía Martín", "Competición Sub-16", 55, "completa", [4, 3, 3, 4, 4, 3], "Bandeja con intención ofensiva", "Mejora clara en la toma de decisiones."],
  ["Lucía Martín", "Competición Sub-16", 6, "completa", [4, 4, 3, 5, 4, 4], "Variar la bandeja: cortada y plana", "Gran progresión en lectura táctica."],
  ["Hugo Navarro", "Competición Sub-16", 120, "completa", [3, 2, 3, 2, 4, 3], "Resto profundo al cristal", null],
  ["Hugo Navarro", "Competición Sub-16", 40, "completa", [4, 3, 3, 3, 4, 3], "Resto profundo al cristal", null],
  ["Hugo Navarro", "Competición Sub-16", 5, "rapida", [4, 3, 4, 3, 5, 4], null, null],
  ["Carla Ibáñez", "Competición Sub-16", 70, "completa", [3, 4, 2, 3, 3, 4], "Salida de pared de fondo", null],
  ["Carla Ibáñez", "Competición Sub-16", 8, "rapida", [4, 4, 3, 3, 3, 4], null, null],
  ["Sofía Delgado", "Competición Sub-16", 9, "rapida", [4, 3, 3, 4, 3, 3], null, null],
  ["Pablo Serrano", "Competición Sub-16", 12, "completa", [5, 4, 4, 4, 4, 3], "Remate por tres con dirección", null],
  ["Mateo Ruiz", "Perfeccionamiento", 15, "rapida", [3, 2, 2, 3, 3, 3], null, null],
  ["Álvaro Prieto", "Perfeccionamiento", 20, "completa", [3, 3, 2, 3, 3, 2], "Respirar entre puntos", null],
  ["Martina Gil", "Iniciación martes", 18, "rapida", [2, 2, 1, 2, 3, 3], null, null],
];

const ya = Number(psql(`select count(*) from public.evaluaciones where escuela_id = ${q(escuelaId)}`));
if (ya === 0) {
  for (const [jugador, grupo, dias, tipo, notas, objetivo, observaciones] of EVALUACIONES) {
    const puntuadas = competencias.map((c, i) => ({
      nombre: c.nombre,
      grupo: AREA_TEXTO[c.area],
      descripcion: c.descripcion,
      orden: c.orden,
      puntuacion: notas[i],
    }));
    const r = generarRedaccion({ notas: puntuadas, totalCompetencias: competencias.length, escala, observaciones, objetivo });
    const { error } = await cliente.rpc("guardar_evaluacion", {
      p_escuela: escuelaId,
      p_id: null,
      p_clave_envio: randomUUID(),
      p_jugador: idJugador(jugador),
      p_grupo: idGrupo(grupo),
      p_tipo: tipo,
      p_fecha: haceDias(dias),
      p_titulo: tipo === "completa" ? "Evaluación trimestral" : null,
      p_fortalezas: r.fortalezas || null,
      p_mejoras: r.mejoras || null,
      p_observaciones: observaciones,
      p_puntuaciones: competencias.map((c, i) => ({ competencia: c.id, puntuacion: notas[i] })),
      p_objetivos: objetivo ? [{ descripcion: objetivo, plazo: haceDias(dias - 60) }] : [],
      p_interpretacion: r.interpretacion || null,
      p_propuesta: { version: VERSION_GENERADOR, fortalezas: r.fortalezas, mejoras: r.mejoras, interpretacion: r.interpretacion, provisional: r.provisional },
    });
    if (error) throw new Error(`${jugador}: ${error.code} ${error.message}`);
  }
}

console.log(JSON.stringify({ escuelaId, jugadores: jugadores.length, grupos: grupos.length, evaluaciones: psql(`select count(*) from public.evaluaciones where escuela_id = ${q(escuelaId)}`) }));
