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
// Todas las migraciones, en orden. Cada mutación se aplica al archivo que
// contiene el texto a cambiar; el resto se copia sin tocar.
const archivos = readdirSync(dirMig).filter((f) => f.endsWith(".sql")).sort();
const contenidos = new Map(archivos.map((f) => [f, readFileSync(join(dirMig, f), "utf8")]));

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
  // Migración 2
  ["sin relleno de perfiles de usuarios previos",
    "insert into public.perfiles (id)\nselect u.id from auth.users u\non conflict (id) do nothing;", ""],
  ["alta de escuelas ejecutable por usuarios autenticados",
    "revoke all on function privado.crear_escuela_con_director(text, text)\n  from public, anon, authenticated, service_role;",
    "revoke all on function privado.crear_escuela_con_director(text, text)\n  from public, anon, service_role;\ngrant execute on function privado.crear_escuela_con_director(text, text) to authenticated;\ngrant insert on public.escuelas, public.membresias, public.perfiles to authenticated;\ngrant select on auth.users to authenticated;"],
  ["alta de escuelas que acepta emails duplicados",
    "  if cardinality(v_usuarios) > 1 then", "  if false then"],
  // Migración 3 (evaluaciones)
  ["lectura de evaluaciones abierta",
    "create policy evaluaciones_leer on public.evaluaciones\n  for select to authenticated\n  using ((select privado.es_miembro(escuela_id)));",
    "create policy evaluaciones_leer on public.evaluaciones\n  for select to authenticated\n  using (true);"],
  ["lectura de puntuaciones abierta",
    "create policy evaluacion_puntuaciones_leer on public.evaluacion_puntuaciones\n  for select to authenticated\n  using ((select privado.es_miembro(escuela_id)));",
    "create policy evaluacion_puntuaciones_leer on public.evaluacion_puntuaciones\n  for select to authenticated\n  using (true);"],
  ["un entrenador edita evaluaciones ajenas",
    "        privado.tiene_rol(e.escuela_id, array['director']::public.rol_escuela[])\n        or (e.entrenador_id",
    "        privado.tiene_rol(e.escuela_id, array['director', 'entrenador']::public.rol_escuela[])\n        or (e.entrenador_id"],
  ["política de edición sin comprobar el autor",
    "create policy evaluaciones_editar on public.evaluaciones\n  for update to authenticated\n  using (\n    (select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[]))",
    "create policy evaluaciones_editar on public.evaluaciones\n  for update to authenticated\n  using (\n    (select privado.tiene_rol(escuela_id, array['director', 'entrenador']::public.rol_escuela[]))"],
  ["FK simple (sin escuela) entre evaluación y jugador",
    "foreign key (escuela_id, jugador_id) references public.jugadores (escuela_id, id) on delete cascade,\n  foreign key (escuela_id, grupo_id)",
    "foreign key (jugador_id) references public.jugadores (id) on delete cascade,\n  foreign key (escuela_id, grupo_id)",
    "create index mutacion_idx on public.evaluaciones (jugador_id);"],
  ["sin validar que el jugador está en el grupo",
    "create trigger validar_grupo before insert or update on public.evaluaciones\n  for each row execute function privado.validar_grupo_evaluacion();", ""],
  ["validación de grupo como SECURITY DEFINER (revela asignaciones de otras escuelas)",
    "language plpgsql security invoker set search_path = ''\nas $$\nbegin\n  if new.grupo_id is not null",
    "language plpgsql security definer set search_path = ''\nas $$\nbegin\n  if new.grupo_id is not null"],
  ["puntuaciones sin límite 1–5",
    "puntuacion      smallint not null check (puntuacion between 1 and 5),", "puntuacion      smallint not null,"],
  ["guardado de evaluaciones como SECURITY DEFINER",
    "  p_objetivos      jsonb\n)\nreturns uuid\nlanguage plpgsql\nsecurity invoker",
    "  p_objetivos      jsonb\n)\nreturns uuid\nlanguage plpgsql\nsecurity definer"],
  ["autor de la evaluación falsificable",
    "grant insert (escuela_id, jugador_id, grupo_id, tipo, fecha, titulo, fortalezas, mejoras, observaciones, clave_envio)",
    "grant insert (escuela_id, jugador_id, grupo_id, entrenador_id, tipo, fecha, titulo, fortalezas, mejoras, observaciones, clave_envio)"],
  ["sin protección frente a reenvíos (duplicados)",
    "    on conflict (escuela_id, clave_envio) do nothing\n", ""],
  ["acepta competencias desactivadas",
    "        and (c.activa or c.id = any (v_previas))", "        and true"],
  // El director también entrena (misma cuenta): no debe perder funciones de entrenador.
  ["solo el rol entrenador puede evaluar (el director no podría entrenar)",
    "create policy evaluaciones_crear on public.evaluaciones\n  for insert to authenticated\n  with check (\n    (select privado.tiene_rol(escuela_id, array['director', 'entrenador']::public.rol_escuela[]))",
    "create policy evaluaciones_crear on public.evaluaciones\n  for insert to authenticated\n  with check (\n    (select privado.tiene_rol(escuela_id, array['entrenador']::public.rol_escuela[]))"],
  ["solo el rol entrenador asigna jugadores a grupos",
    "create policy grupo_jugadores_crear on public.grupo_jugadores\n  for insert to authenticated\n  with check ((select privado.tiene_rol(escuela_id, array['director', 'entrenador']::public.rol_escuela[])));",
    "create policy grupo_jugadores_crear on public.grupo_jugadores\n  for insert to authenticated\n  with check ((select privado.tiene_rol(escuela_id, array['entrenador']::public.rol_escuela[])));"],
  ["el director pierde la edición de evaluaciones",
    "        privado.tiene_rol(e.escuela_id, array['director']::public.rol_escuela[])\n        or (e.entrenador_id",
    "        false\n        or (e.entrenador_id"],
  ["evaluaciones borrables por cualquier miembro",
    "grant select                    on public.evaluaciones to authenticated;",
    "grant select, delete            on public.evaluaciones to authenticated;\ncreate policy evaluaciones_borrar on public.evaluaciones for delete to authenticated using ((select privado.es_miembro(escuela_id)));"],
  // Migración 4: metodologías importadas.
  ["metodologías legibles por cualquier usuario",
    "create policy metodologias_leer on public.metodologias\n  for select to authenticated\n  using ((select privado.es_miembro(escuela_id)));",
    "create policy metodologias_leer on public.metodologias\n  for select to authenticated\n  using (true);"],
  ["un entrenador puede importar metodologías",
    "create policy metodologias_crear_director on public.metodologias\n  for insert to authenticated\n  with check ((select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[])));",
    "create policy metodologias_crear_director on public.metodologias\n  for insert to authenticated\n  with check ((select privado.tiene_rol(escuela_id, array['director', 'entrenador']::public.rol_escuela[])));"],
  ["un entrenador puede activar metodologías",
    "create policy metodologias_editar_director on public.metodologias\n  for update to authenticated\n  using ((select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[])))",
    "create policy metodologias_editar_director on public.metodologias\n  for update to authenticated\n  using ((select privado.tiene_rol(escuela_id, array['director', 'entrenador']::public.rol_escuela[])))"],
  ["una metodología activada se puede modificar",
    "  if old.estado <> 'borrador' and (\n       new.contenido is distinct from old.contenido",
    "  if false and (\n       new.contenido is distinct from old.contenido"],
  ["se activa una metodología sin competencias evaluables",
    "    if evaluables = 0 then", "    if false then"],
  ["al activar no se desactivan las competencias anteriores",
    "   where c.escuela_id = new.escuela_id and c.activa\n     and c.metodologia_id is distinct from new.id;",
    "   where false;"],
  ["editar una evaluación cambia su versión de metodología",
    "    new.metodologia_id := old.metodologia_id;",
    "    new.metodologia_id := (select m.id from public.metodologias m where m.escuela_id = new.escuela_id and m.estado = 'activa');"],
  ["las competencias de una metodología se pueden renombrar",
    "  if old.metodologia_id is not null and (\n       new.nombre is distinct from old.nombre",
    "  if false and (\n       new.nombre is distinct from old.nombre"],
  ["el cliente elige la metodología de una evaluación",
    "grant insert (metodologia_id, grupo) on public.competencias to authenticated;",
    "grant insert (metodologia_id, grupo) on public.competencias to authenticated;\ngrant insert (metodologia_id) on public.evaluaciones to authenticated;"],
  ["metodologías borrables por la dirección",
    "grant select on public.metodologias to authenticated;",
    "grant select, delete on public.metodologias to authenticated;\ncreate policy metodologias_borrar on public.metodologias for delete to authenticated using ((select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[])));"],
  ["se puede crear una metodología ya activa",
    "    if new.estado <> 'borrador' then\n      raise exception 'Una metodología se crea como borrador.'",
    "    if false then\n      raise exception 'Una metodología se crea como borrador.'",
    "grant insert (estado) on public.metodologias to authenticated;"],
];

let huecos = 0;
for (const [nombre, de, a, extra = ""] of mutaciones) {
  const archivo = archivos.find((f) => contenidos.get(f).includes(de));
  if (!archivo) {
    console.error(`✗ La mutación «${nombre}» ya no encaja con la migración: actualízala.`);
    process.exitCode = 1;
    huecos++;
    continue;
  }
  const dir = mkdtempSync(join(tmpdir(), "mutacion-"));
  chmodSync(dir, 0o755);
  for (const f of archivos) {
    const texto = f === archivo ? `${contenidos.get(f).replace(de, () => a)}\n${extra}\n` : contenidos.get(f);
    writeFileSync(join(dir, f), texto);
    chmodSync(join(dir, f), 0o644);
  }
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
