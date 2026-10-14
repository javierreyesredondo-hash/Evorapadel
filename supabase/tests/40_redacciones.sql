-- =============================================================================
-- Pruebas de la migración 5 (interpretación técnica e historial de la redacción).
-- SOLO EN UN POSTGRESQL LOCAL DESECHABLE (scripts/probar-migracion.sh), después
-- de 10_aislamiento.sql y 20_evaluaciones.sql (reutiliza sus funciones).
-- Datos sintéticos, sin datos personales. El primer fallo detiene el script.
-- =============================================================================

\set ON_ERROR_STOP on
set client_min_messages = notice;

\set esc_r   '''0000000c-0000-4000-8000-00000000000c'''
\set esc_s   '''0000000d-0000-4000-8000-00000000000d'''
\set dir_r   '''000000c1-0000-4000-8000-00000000000c'''
\set ent_r   '''000000c2-0000-4000-8000-00000000000c'''
\set ent_r2  '''000000c3-0000-4000-8000-00000000000c'''
\set dir_s   '''000000d1-0000-4000-8000-00000000000d'''
\set jug_r   '''0000c001-0000-4000-8000-00000000000c'''
\set jug_r2  '''0000c002-0000-4000-8000-00000000000c'''
\set com_r   '''00cc0001-0000-4000-8000-00000000000c'''
\set clave_1 '''0c1c0001-0000-4000-8000-00000000000c'''
\set clave_2 '''0c1c0002-0000-4000-8000-00000000000c'''
\set propuesta '''{"version":"redaccion-1","fortalezas":"Propuesta F","mejoras":"Propuesta M","interpretacion":"Propuesta I","provisional":false}'''

-- Guardado con los parámetros nuevos (interpretación y propuesta).
create function prueba.guardar_redaccion(
  p_escuela uuid, p_id uuid, p_clave uuid, p_jugador uuid, p_notas jsonb,
  p_fortalezas text, p_mejoras text, p_interpretacion text, p_observaciones text,
  p_objetivos jsonb, p_propuesta jsonb)
returns uuid language sql as $$
  select public.guardar_evaluacion(p_escuela, p_id, p_clave, p_jugador, null, 'rapida', current_date, null,
    p_fortalezas, p_mejoras, p_observaciones, p_notas, p_objetivos, p_interpretacion, p_propuesta);
$$;
grant execute on function prueba.guardar_redaccion to public;


-- ------------------------------------------------------- estructura y permisos
select prueba.ok((select relrowsecurity from pg_class where oid = 'public.evaluacion_redacciones'::regclass),
  'RLS activado en evaluacion_redacciones');

select prueba.ok(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'evaluacion_redacciones') = 2
  and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'evaluacion_redacciones'
                  and cmd in ('UPDATE', 'DELETE', 'ALL')),
  'evaluacion_redacciones: solo leer y añadir (ninguna política de cambio ni borrado)');

select prueba.ok(
  not exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'evaluacion_redacciones'
                and grantee in ('anon', 'authenticated') and privilege_type in ('UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'))
  and not exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'evaluacion_redacciones' and grantee = 'anon')
  and not exists (select 1 from information_schema.column_privileges
              where table_schema = 'public' and table_name = 'evaluacion_redacciones' and grantee = 'authenticated'
                and privilege_type = 'INSERT' and column_name not in ('escuela_id', 'evaluacion_id', 'propuesta')),
  'versiones inmutables y el cliente no fija su texto, número, autor ni fecha');

select prueba.ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'privado' and p.proname = 'preparar_redaccion' and p.prosecdef)
  and not exists (select 1 from pg_proc where proname = 'guardar_evaluacion' and prosecdef)
  and (select count(*) from pg_proc where proname = 'guardar_evaluacion') = 1
  and not has_function_privilege('anon',
        'public.guardar_evaluacion(uuid, uuid, uuid, uuid, uuid, public.tipo_evaluacion, date, text, text, text, text, jsonb, jsonb, text, jsonb)', 'execute'),
  'guardar_evaluacion: una sola versión, SECURITY INVOKER y no ejecutable por anon; la copia también es INVOKER');


-- ----------------------------------------------------------------- preparación
set role supabase_auth_admin;
insert into auth.users (id) values (:dir_r), (:ent_r), (:ent_r2), (:dir_s);
reset role;

set role service_role;
insert into public.escuelas (id, nombre) values (:esc_r, 'Escuela R'), (:esc_s, 'Escuela S');
insert into public.membresias (escuela_id, usuario_id, rol) values
  (:esc_r, :dir_r, 'director'), (:esc_r, :ent_r, 'entrenador'), (:esc_r, :ent_r2, 'entrenador'), (:esc_s, :dir_s, 'director');
insert into public.jugadores (id, escuela_id, nombre) values (:jug_r, :esc_r, 'Jugador R'), (:jug_r2, :esc_r, 'Jugador R2');
insert into public.competencias (id, escuela_id, nombre, area, orden) values (:com_r, :esc_r, 'Técnica R', 'tecnica', 1);
reset role;


-- ------------------------------------------------------------------ anon
set role anon;
select prueba.error('select * from public.evaluacion_redacciones', '42501', 'anon no puede leer redacciones');
reset role;


-- ----------------------------------------------- crear: versión 1 con la redacción aprobada
select set_config('request.jwt.claim.sub', :ent_r, false);
set role authenticated;
select prueba.guardar_redaccion(:esc_r, null, :clave_1, :jug_r, format('[{"competencia": "%s", "puntuacion": 4}]', :com_r)::jsonb,
  'Fortaleza editada', 'Mejora aprobada', 'Interpretación aprobada', 'Observación del entrenador',
  '[{"descripcion": "Objetivo del entrenador", "plazo": null}]', :propuesta);
select prueba.ok((select interpretacion from public.evaluaciones where clave_envio = :clave_1) = 'Interpretación aprobada',
  'la evaluación guarda la interpretación técnica');
select prueba.ok(
  (select count(*) from public.evaluacion_redacciones r join public.evaluaciones e on e.id = r.evaluacion_id where e.clave_envio = :clave_1) = 1
  and exists (select 1 from public.evaluacion_redacciones r join public.evaluaciones e on e.id = r.evaluacion_id
               where e.clave_envio = :clave_1 and r.version = 1 and r.fortalezas = 'Fortaleza editada' and r.mejoras = 'Mejora aprobada'
                 and r.interpretacion = 'Interpretación aprobada' and r.observaciones = 'Observación del entrenador'
                 and r.objetivo = 'Objetivo del entrenador' and r.autor_id = :ent_r::uuid
                 and r.propuesta ->> 'fortalezas' = 'Propuesta F'),
  'al guardar se conserva la versión 1: lo aprobado (editado) y, aparte, la propuesta automática mostrada');

-- Reenvío del mismo formulario (reintento o doble pulsación): ni evaluación ni versión nuevas.
select prueba.guardar_redaccion(:esc_r, null, :clave_1, :jug_r, format('[{"competencia": "%s", "puntuacion": 1}]', :com_r)::jsonb,
  'Otra', 'Otra', 'Otra', null, '[]', null);
select prueba.ok((select count(*) from public.evaluaciones where clave_envio = :clave_1) = 1
             and (select count(*) from public.evaluacion_redacciones) = 1
             and (select fortalezas from public.evaluaciones where clave_envio = :clave_1) = 'Fortaleza editada',
  'un reenvío no duplica la evaluación ni la redacción ni la sobrescribe');

-- Llamada antigua (sin los parámetros nuevos): sigue funcionando y deja su versión.
select prueba.guardar(:esc_r, null, :clave_2, :jug_r2, null, format('[{"competencia": "%s", "puntuacion": 3}]', :com_r)::jsonb);
select prueba.ok(
  (select interpretacion from public.evaluaciones where clave_envio = :clave_2) is null
  and (select r.propuesta is null and r.version = 1 and r.fortalezas = 'Buena lectura del juego'
         from public.evaluacion_redacciones r join public.evaluaciones e on e.id = r.evaluacion_id where e.clave_envio = :clave_2),
  'guardar_evaluacion con los parámetros de antes sigue funcionando (compatible con la app anterior)');

-- El cliente no puede falsificar el contenido de una versión.
select prueba.error(format('insert into public.evaluacion_redacciones (escuela_id, evaluacion_id, fortalezas) select %L, id, %L from public.evaluaciones where clave_envio = %L',
  :esc_r, 'Texto inventado', :clave_1), '42501', 'el cliente no escribe el texto de una versión');
select prueba.error(format('insert into public.evaluacion_redacciones (escuela_id, evaluacion_id, version) select %L, id, 1 from public.evaluaciones where clave_envio = %L',
  :esc_r, :clave_1), '42501', 'el cliente no elige el número de versión');
select prueba.error('update public.evaluacion_redacciones set fortalezas = ''cambiado''', '42501', 'una versión no se modifica');
select prueba.error('delete from public.evaluacion_redacciones', '42501', 'una versión no se borra');
reset role;


-- --------------------------------------- editar: versión 2, la 1 queda intacta
select set_config('request.jwt.claim.sub', :ent_r, false);
set role authenticated;
select prueba.guardar_redaccion(:esc_r, (select id from public.evaluaciones where clave_envio = :clave_1), null, null,
  format('[{"competencia": "%s", "puntuacion": 5}]', :com_r)::jsonb,
  'Fortaleza nueva', 'Mejora nueva', 'Interpretación nueva', null, '[]', null);
select prueba.ok(
  (select array_agg(r.version || ':' || coalesce(r.fortalezas, '') || ':' || coalesce(r.interpretacion, '') || ':' || coalesce(r.objetivo, '-') order by r.version)
     from public.evaluacion_redacciones r join public.evaluaciones e on e.id = r.evaluacion_id where e.clave_envio = :clave_1)
  = array['1:Fortaleza editada:Interpretación aprobada:Objetivo del entrenador', '2:Fortaleza nueva:Interpretación nueva:-'],
  'editar añade la versión 2 y conserva la 1 tal como se aprobó (el informe histórico no cambia en silencio)');
reset role;


-- --------------------------------------------- permisos: otro entrenador y otra escuela
select set_config('request.jwt.claim.sub', :ent_r2, false);
set role authenticated;
select prueba.ok((select count(*) from public.evaluacion_redacciones where escuela_id = :esc_r) = 3,
  'otro entrenador de la escuela lee el historial (como las evaluaciones)');
select prueba.error(format('insert into public.evaluacion_redacciones (escuela_id, evaluacion_id) select %L, id from public.evaluaciones where clave_envio = %L',
  :esc_r, :clave_1), '42501', 'otro entrenador no añade versiones a una evaluación ajena');
select prueba.error(format('select prueba.guardar_redaccion(%L, (select id from public.evaluaciones where clave_envio = %L), null, null, %L::jsonb, %L, null, null, null, %L::jsonb, null)',
  :esc_r, :clave_1, format('[{"competencia": "%s", "puntuacion": 1}]', :com_r), 'Intrusa', '[]'), 'P0002',
  'otro entrenador no edita la redacción de una evaluación ajena');
reset role;

select id as ev_r from public.evaluaciones where clave_envio = :clave_1 \gset
select set_config('request.jwt.claim.sub', :dir_s, false);
set role authenticated;
select prueba.ok((select count(*) from public.evaluacion_redacciones where escuela_id = :esc_r) = 0,
  'director S: no ve las redacciones de R');
-- Mismo error que si la evaluación no existiera: no revela que existe.
select prueba.error(format('insert into public.evaluacion_redacciones (escuela_id, evaluacion_id) values (%L, %L)',
  :esc_r, :'ev_r'), 'P0002', 'director S: no añade versiones a una evaluación real de R');
select prueba.error(format('insert into public.evaluacion_redacciones (escuela_id, evaluacion_id) values (%L, %L)',
  :esc_s, :'ev_r'), 'P0002', 'director S: ni haciéndola pasar por su escuela');
reset role;

-- La dirección de R sí puede revisar y guardar (versión 3, con ella como autora).
select set_config('request.jwt.claim.sub', :dir_r, false);
set role authenticated;
select prueba.guardar_redaccion(:esc_r, (select id from public.evaluaciones where clave_envio = :clave_1), null, null,
  format('[{"competencia": "%s", "puntuacion": 5}]', :com_r)::jsonb,
  'Fortaleza dirección', null, null, null, '[]', null);
select prueba.ok(
  (select r.version = 3 and r.autor_id = :dir_r::uuid
     from public.evaluacion_redacciones r join public.evaluaciones e on e.id = r.evaluacion_id
    where e.clave_envio = :clave_1 order by r.version desc limit 1),
  'la dirección revisa la redacción: versión 3, con su autoría');

-- Suprimir un jugador (derecho de supresión) elimina también su historial de redacción.
-- (Dos sentencias: dentro de una misma sentencia, la comprobación vería el estado anterior.)
select prueba.ok(prueba.filas(format('delete from public.jugadores where id = %L', :jug_r)) = 1, 'la dirección suprime un jugador');
select prueba.ok((select count(*) from public.evaluacion_redacciones where escuela_id = :esc_r) = 1,
  'al suprimir un jugador desaparecen sus versiones (no quedan copias huérfanas)');
reset role;

\warn 'TODAS LAS PRUEBAS DE REDACCIÓN HAN PASADO'
