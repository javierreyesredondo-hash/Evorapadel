#!/usr/bin/env node
// Pruebas de mutación de la migración: introduce a propósito fallos de
// seguridad (uno cada vez) en una copia temporal y comprueba que las pruebas
// de aislamiento FALLAN. Si alguna mutación pasa, las pruebas tienen un hueco.
// Usa el PostgreSQL local de scripts/probar-migracion.sh. Nunca toca Supabase.
// Uso: npm run test:db:mutaciones
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const raiz = new URL("..", import.meta.url).pathname;
const dirMig = join(raiz, "supabase/migrations");
const archivo = readdirSync(dirMig).filter((f) => f.endsWith(".sql")).sort().at(-1);
const original = readFileSync(join(dirMig, archivo), "utf8");

/** [nombre, texto original, texto mutado, SQL extra al final (opcional)] */
const mutaciones = [
  ["no se retiran los permisos por defecto",
    "revoke all on public.escuelas, public.perfiles, public.membresias,\n              public.jugadores, public.grupos, public.grupo_jugadores\n  from anon, authenticated;", ""],
  ["RLS desactivado en grupos", "alter table public.grupos          enable row level security;", ""],
  ["lectura de jugadores abierta",
    "create policy jugadores_leer on public.jugadores\n  for select to authenticated\n  using ((select privado.es_miembro(escuela_id)));",
    "create policy jugadores_leer on public.jugadores\n  for select to authenticated\n  using (true);"],
  ["lectura de perfiles abierta",
    "using (id = (select auth.uid()) or (select privado.comparte_escuela(id)));", "using (true);"],
  ["lectura de membresías abierta",
    "using (usuario_id = (select auth.uid()) or (select privado.es_miembro(escuela_id)));", "using (true);"],
  ["cualquier miembro renombra la escuela",
    "using ((select privado.tiene_rol(id, array['director']::public.rol_escuela[])))\n  with check ((select privado.tiene_rol(id, array['director']::public.rol_escuela[])));",
    "using ((select privado.es_miembro(id)))\n  with check ((select privado.es_miembro(id)));"],
  ["el entrenador puede borrar jugadores",
    "create policy jugadores_borrar_director on public.jugadores\n  for delete to authenticated\n  using ((select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[])));",
    "create policy jugadores_borrar_director on public.jugadores\n  for delete to authenticated\n  using ((select privado.tiene_rol(escuela_id, array['director', 'entrenador']::public.rol_escuela[])));"],
  ["FK simple (sin escuela) entre asignación y jugador",
    "foreign key (escuela_id, jugador_id) references public.jugadores (escuela_id, id) on delete cascade",
    "foreign key (jugador_id) references public.jugadores (id) on delete cascade",
    // Con su índice, para que la detecte una prueba de aislamiento y no solo la de índices.
    "create index mutacion_idx on public.grupo_jugadores (jugador_id);"],
  ["entrenador de grupo de cualquier escuela",
    "  foreign key (escuela_id, entrenador_id)\n    references public.membresias (escuela_id, usuario_id)\n    on delete set null (entrenador_id)",
    "  foreign key (entrenador_id) references public.perfiles (id) on delete set null",
    "create index mutacion_idx on public.grupos (entrenador_id);"],
  ["escuela_id editable por el cliente",
    "grant update (nombre, fecha_nacimiento, mano, nivel, posicion, foco, activo)",
    "grant update (escuela_id, nombre, fecha_nacimiento, mano, nivel, posicion, foco, activo)"],
  ["sin trigger que impide cambiar de escuela",
    "create trigger impedir_cambio_escuela before update on public.jugadores\n  for each row execute function privado.impedir_cambio_escuela();", ""],
  ["función auxiliar sin search_path fijo",
    "create function privado.comparte_escuela(p_usuario uuid)\nreturns boolean\nlanguage sql stable security definer set search_path = ''",
    "create function privado.comparte_escuela(p_usuario uuid)\nreturns boolean\nlanguage sql stable security definer"],
  ["funciones privadas ejecutables por anon",
    "grant execute on function privado.es_miembro(uuid)                     to authenticated;",
    "grant execute on function privado.es_miembro(uuid)                     to authenticated, anon;\ngrant usage on schema privado to anon;"],
  ["política aplicada también a anon (to public)",
    "create policy grupos_leer on public.grupos\n  for select to authenticated", "create policy grupos_leer on public.grupos\n  for select to public"],
  ["FK sin índice",
    "create index grupo_jugadores_grupo_idx     on public.grupo_jugadores (escuela_id, grupo_id);\n", ""],
];

let huecos = 0;
for (const [nombre, de, a, extra = ""] of mutaciones) {
  if (!original.includes(de)) {
    console.error(`✗ La mutación «${nombre}» ya no encaja con la migración: actualízala.`);
    process.exitCode = 1;
    huecos++;
    continue;
  }
  const dir = mkdtempSync(join(tmpdir(), "mutacion-"));
  writeFileSync(join(dir, archivo), `${original.replace(de, a)}\n${extra}\n`);
  chmodSync(dir, 0o755);
  chmodSync(join(dir, archivo), 0o644);
  const r = spawnSync("bash", [join(raiz, "scripts/probar-migracion.sh")], {
    env: { ...process.env, MIGRACIONES: dir },
    encoding: "utf8",
  });
  rmSync(dir, { recursive: true, force: true });
  const salida = `${r.stdout}${r.stderr}`;
  const motivo = (salida.match(/(FALLO: [^\n]*|ERROR: [^\n]*)/) ?? ["(sin mensaje)"])[0].slice(0, 120);
  if (r.status === 0) {
    console.log(`✗ NO DETECTADA: ${nombre}`);
    huecos++;
  } else {
    console.log(`✓ detectada: ${nombre}\n    → ${motivo}`);
  }
}
console.log(`\n${mutaciones.length - huecos}/${mutaciones.length} mutaciones detectadas`);
if (huecos > 0) process.exitCode = 1;
