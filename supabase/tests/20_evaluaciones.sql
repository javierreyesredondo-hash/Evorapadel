-- =============================================================================
-- Pruebas de la migración 3 (competencias y evaluaciones).
-- SOLO EN UN POSTGRESQL LOCAL DESECHABLE (scripts/probar-migracion.sh), después
-- de 10_aislamiento.sql (reutiliza sus funciones del esquema «prueba»).
-- Datos sintéticos, sin datos personales. El primer fallo detiene el script.
-- =============================================================================

\set ON_ERROR_STOP on
set client_min_messages = notice;

\set esc_e   '''0000000e-0000-4000-8000-000000000000'''
\set esc_f   '''0000000f-0000-4000-8000-000000000000'''
\set dir_e   '''000000e1-0000-4000-8000-000000000000'''
\set ent_e   '''000000e2-0000-4000-8000-000000000000'''
\set ent_e2  '''000000e3-0000-4000-8000-000000000000'''
\set dir_f   '''000000f1-0000-4000-8000-000000000000'''
\set jug_e1  '''0000e001-0000-4000-8000-000000000000'''
\set jug_e2  '''0000e002-0000-4000-8000-000000000000'''
\set jug_f1  '''0000f001-0000-4000-8000-000000000000'''
\set gru_e   '''000e0001-0000-4000-8000-000000000000'''
\set gru_f   '''000f0001-0000-4000-8000-000000000000'''
\set com_e1  '''00ce0001-0000-4000-8000-000000000000'''
\set com_e2  '''00ce0002-0000-4000-8000-000000000000'''
\set com_e3  '''00ce0003-0000-4000-8000-000000000000'''
\set com_f1  '''00cf0001-0000-4000-8000-000000000000'''
\set clave1  '''0c1a0001-0000-4000-8000-000000000000'''
\set clave2  '''0c1a0002-0000-4000-8000-000000000000'''
\set clave3  '''0c1a0003-0000-4000-8000-000000000000'''
\set clave4  '''0c1a0004-0000-4000-8000-000000000000'''
\set clave5  '''0c1a0005-0000-4000-8000-000000000000'''

-- Llamada a guardar_evaluacion con valores por defecto razonables.
create function prueba.guardar(
  p_escuela uuid, p_id uuid, p_clave uuid, p_jugador uuid, p_grupo uuid,
  p_notas jsonb, p_tipo text default 'rapida', p_fecha date default current_date,
  p_objetivos jsonb default '[]', p_observaciones text default null)
returns uuid language sql as $$
  select public.guardar_evaluacion(p_escuela, p_id, p_clave, p_jugador, p_grupo, p_tipo::public.tipo_evaluacion,
    p_fecha, null, 'Buena lectura del juego', 'Volea de revés', p_observaciones, p_notas, p_objetivos);
$$;
grant execute on function prueba.guardar to public;


-- ------------------------------------------------------- estructura y permisos
select prueba.ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.competencias'::regclass, 'public.evaluaciones'::regclass,
                 'public.evaluacion_puntuaciones'::regclass, 'public.evaluacion_objetivos'::regclass)),
  'RLS activado en competencias, evaluaciones, puntuaciones y objetivos');

select prueba.ok(
  (select count(*) from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE'
     and tablename in ('competencias', 'evaluaciones', 'evaluacion_puntuaciones', 'evaluacion_objetivos')) = 12,
  'existen exactamente las 12 políticas revisadas de la migración 3');

select prueba.ok(
  not exists (select 1 from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE'
              and tablename in ('competencias', 'evaluaciones') and cmd in ('DELETE', 'ALL')),
  'no hay políticas de borrado de competencias ni de evaluaciones');

select prueba.ok(
  not exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and grantee = 'authenticated'
                and table_name in ('competencias', 'evaluaciones') and privilege_type = 'DELETE'),
  'authenticated no puede borrar competencias ni evaluaciones');

select prueba.ok(
  not exists (select 1 from information_schema.column_privileges
              where table_schema = 'public' and grantee = 'authenticated'
                and table_name = 'evaluaciones' and privilege_type in ('INSERT', 'UPDATE')
                and column_name in ('id', 'entrenador_id', 'created_at', 'updated_at'))
  and not exists (select 1 from information_schema.column_privileges
              where table_schema = 'public' and grantee = 'authenticated'
                and table_name = 'evaluaciones' and privilege_type = 'UPDATE'
                and column_name in ('escuela_id', 'jugador_id', 'clave_envio')),
  'el autor (entrenador_id) no se puede elegir y escuela/jugador/clave no se pueden cambiar');

select prueba.ok(
  not has_function_privilege('anon', 'public.guardar_evaluacion(uuid, uuid, uuid, uuid, uuid, public.tipo_evaluacion, date, text, text, text, text, jsonb, jsonb, text, jsonb)', 'execute')
  and not exists (select 1 from pg_proc where proname = 'guardar_evaluacion' and prosecdef),
  'guardar_evaluacion: solo para usuarios autenticados y SECURITY INVOKER (respeta RLS)');

select prueba.ok(
  (select count(*) from public.competencias) + (select count(*) from public.evaluaciones) = 0,
  'la migración no crea competencias ni evaluaciones');


-- ----------------------------------------------------------------- preparación
set role supabase_auth_admin;
insert into auth.users (id) values (:dir_e), (:ent_e), (:ent_e2), (:dir_f);
reset role;

set role service_role;
insert into public.escuelas (id, nombre) values (:esc_e, 'Escuela E'), (:esc_f, 'Escuela F');
insert into public.membresias (escuela_id, usuario_id, rol) values
  (:esc_e, :dir_e, 'director'), (:esc_e, :ent_e, 'entrenador'), (:esc_e, :ent_e2, 'entrenador'),
  (:esc_f, :dir_f, 'director');
insert into public.jugadores (id, escuela_id, nombre) values
  (:jug_e1, :esc_e, 'Jugador E1'), (:jug_e2, :esc_e, 'Jugador E2'), (:jug_f1, :esc_f, 'Jugador F1');
insert into public.grupos (id, escuela_id, nombre) values (:gru_e, :esc_e, 'Grupo E'), (:gru_f, :esc_f, 'Grupo F');
insert into public.grupo_jugadores (escuela_id, grupo_id, jugador_id) values
  (:esc_e, :gru_e, :jug_e1), (:esc_f, :gru_f, :jug_f1);
reset role;


-- Competencias con id conocido (solo service_role puede fijar el id).
set role service_role;
insert into public.competencias (id, escuela_id, nombre, area, orden, activa) values
  (:com_e1, :esc_e, 'Golpes de fondo', 'tecnica', 1, true),
  (:com_e2, :esc_e, 'Lectura táctica', 'tactica', 2, true),
  (:com_e3, :esc_e, 'Competencia retirada', 'fisica', 3, false),
  (:com_f1, :esc_f, 'Competencia F', 'mental', 1, true);
reset role;


-- ------------------------------------------------------------------ anon
set role anon;
select prueba.error('select * from public.evaluaciones', '42501', 'anon no puede leer evaluaciones');
select prueba.error('select * from public.competencias', '42501', 'anon no puede leer competencias');
select prueba.error(format('select prueba.guardar(%L, null, %L, %L, null, %L)', :esc_e, :clave1, :jug_e1,
  format('[{"competencia": "%s", "puntuacion": 3}]', :com_e1)), '42501', 'anon no puede guardar evaluaciones');
reset role;


-- ------------------------------------------------- competencias: permisos
select set_config('request.jwt.claim.sub', :dir_e, false);
set role authenticated;
select prueba.ok(prueba.filas(format('insert into public.competencias (escuela_id, nombre, area, orden) values (%L, %L, %L, 4)',
  :esc_e, 'Fortaleza mental', 'mental')) = 1, 'director E: añade competencias a su metodología');
select prueba.ok(prueba.filas(format('update public.competencias set descripcion = %L where id = %L', 'Profundidad y control', :com_e1)) = 1,
  'director E: edita sus competencias');
select prueba.error(format('insert into public.competencias (escuela_id, nombre, area) values (%L, %L, %L)', :esc_e, '  golpes DE fondo ', 'tecnica'),
  '23505', 'nombres de competencia únicos por escuela (sin mayúsculas ni espacios)');
select prueba.error(format('insert into public.competencias (escuela_id, nombre, area) values (%L, %L, %L)', :esc_f, 'Intrusa', 'tecnica'),
  '42501', 'director E: no puede añadir competencias a F');
select prueba.ok(prueba.filas(format('update public.competencias set nombre = %L where id = %L', 'Hackeada', :com_f1)) = 0,
  'director E: no puede editar competencias de F');
select prueba.ok((select count(*) from public.competencias where escuela_id = :esc_f) = 0, 'director E: no ve competencias de F');
select prueba.error(format('delete from public.competencias where id = %L', :com_e1), '42501',
  'nadie borra competencias desde el cliente (se desactivan)');
reset role;

select set_config('request.jwt.claim.sub', :ent_e, false);
set role authenticated;
select prueba.ok((select count(*) from public.competencias) = 4, 'entrenador E: ve la metodología de su escuela');
select prueba.error(format('insert into public.competencias (escuela_id, nombre, area) values (%L, %L, %L)', :esc_e, 'Saque', 'tecnica'),
  '42501', 'entrenador E: no puede crear competencias (solo dirección)');
select prueba.ok(prueba.filas(format('update public.competencias set activa = false where id = %L', :com_e1)) = 0,
  'entrenador E: no puede editar ni desactivar competencias');


-- -------------------------------------------- evaluaciones: crear (entrenador)
select prueba.ok(
  prueba.guardar(:esc_e, null, :clave1, :jug_e1, :gru_e,
    format('[{"competencia": "%s", "puntuacion": 4}, {"competencia": "%s", "puntuacion": 3}]', :com_e1, :com_e2)::jsonb,
    'completa', current_date - 30,
    format('[{"descripcion": "  Mejorar la bandeja ", "plazo": "%s"}, {"descripcion": "Más voleas", "plazo": null}]', current_date)::jsonb)
  is not null,
  'entrenador E: crea una evaluación completa con notas y objetivos');
select prueba.ok(
  (select entrenador_id from public.evaluaciones where clave_envio = :clave1) = :ent_e::uuid,
  'el autor de la evaluación es siempre quien la crea');
select prueba.ok((select count(*) from public.evaluacion_puntuaciones) = 2
             and (select count(*) from public.evaluacion_objetivos) = 2
             and (select descripcion from public.evaluacion_objetivos where orden = 0) = 'Mejorar la bandeja',
  'notas y objetivos guardados con la evaluación (en orden y sin espacios sobrantes)');
select prueba.ok(
  prueba.guardar(:esc_e, null, :clave1, :jug_e1, :gru_e, format('[{"competencia": "%s", "puntuacion": 1}]', :com_e1)::jsonb)
    = (select id from public.evaluaciones where clave_envio = :clave1)
  and (select count(*) from public.evaluaciones) = 1
  and (select puntuacion from public.evaluacion_puntuaciones where competencia_id = :com_e1) = 4,
  'reenviar el mismo formulario no duplica ni modifica la evaluación');

-- Validaciones (cada error deshace todo: no quedan evaluaciones a medias)
select prueba.error(format('select prueba.guardar(%L, null, %L, %L, null, %L)', :esc_e, :clave2, :jug_e1, '[]'),
  '22023', 'exige al menos una puntuación');
select prueba.error(format('select prueba.guardar(%L, null, %L, %L, null, %L)', :esc_e, :clave2, :jug_e1,
  format('[{"competencia": "%s", "puntuacion": 6}]', :com_e1)), '23514', 'puntuación fuera de 1–5 (6)');
select prueba.error(format('select prueba.guardar(%L, null, %L, %L, null, %L)', :esc_e, :clave2, :jug_e1,
  format('[{"competencia": "%s", "puntuacion": 0}]', :com_e1)), '23514', 'puntuación fuera de 1–5 (0)');
select prueba.error(format('select prueba.guardar(%L, null, %L, %L, null, %L)', :esc_e, :clave2, :jug_e1,
  format('[{"competencia": "%s", "puntuacion": 3}, {"competencia": "%s", "puntuacion": 4}]', :com_e1, :com_e1)),
  '23505', 'una competencia solo se puntúa una vez por evaluación');
select prueba.error(format('select prueba.guardar(%L, null, %L, %L, null, %L)', :esc_e, :clave2, :jug_e1,
  format('[{"competencia": "%s", "puntuacion": 3}]', :com_e3)), '23503', 'no se puede puntuar una competencia desactivada');
select prueba.error(format('select prueba.guardar(%L, null, %L, %L, null, %L)', :esc_e, :clave2, :jug_e1,
  format('[{"competencia": "%s", "puntuacion": 3}]', :com_f1)), '23503', 'no se puede puntuar una competencia de otra escuela');
select prueba.error(format('select prueba.guardar(%L, null, %L, %L, null, %L, %L, %L)', :esc_e, :clave2, :jug_e1,
  format('[{"competencia": "%s", "puntuacion": 3}]', :com_e1), 'rapida', current_date + 5), '22023', 'la fecha no puede ser futura');
select prueba.error(format('select prueba.guardar(%L, null, %L, %L, null, %L, %L, %L, %L)', :esc_e, :clave2, :jug_e1,
  format('[{"competencia": "%s", "puntuacion": 3}]', :com_e1), 'rapida', current_date,
  format('[{"descripcion": "Antes", "plazo": "%s"}]', current_date - 1)), '22023', 'el plazo de un objetivo no es anterior a la evaluación');
select prueba.error(format('select prueba.guardar(%L, null, %L, %L, null, %L, %L, %L, %L)', :esc_e, :clave2, :jug_e1,
  format('[{"competencia": "%s", "puntuacion": 3}]', :com_e1), 'rapida', current_date,
  '[{"d":1},{"d":2},{"d":3},{"d":4},{"d":5},{"d":6}]'), '22023', 'como máximo 5 objetivos');
select prueba.error(format('select prueba.guardar(%L, null, %L, %L, %L, %L)', :esc_e, :clave2, :jug_e2, :gru_e,
  format('[{"competencia": "%s", "puntuacion": 3}]', :com_e1)), '23514', 'el jugador tiene que pertenecer al grupo indicado');
select prueba.error(format('select prueba.guardar(%L, null, %L, %L, null, %L, %L, %L, %L, %L)', :esc_e, :clave2, :jug_e1,
  format('[{"competencia": "%s", "puntuacion": 3}]', :com_e1), 'rapida', current_date, '[]', repeat('x', 3001)),
  '23514', 'observaciones con longitud máxima');
select prueba.ok((select count(*) from public.evaluaciones) = 1 and (select count(*) from public.evaluacion_puntuaciones) = 2,
  'ningún intento fallido deja evaluaciones ni notas a medias');

-- Manipular identificadores
select prueba.error(format('select prueba.guardar(%L, null, %L, %L, null, %L)', :esc_e, :clave2, :jug_f1,
  format('[{"competencia": "%s", "puntuacion": 3}]', :com_e1)), '23503', 'no se puede evaluar en E a un jugador de F (FK compuesta)');
select prueba.error(format('select prueba.guardar(%L, null, %L, %L, null, %L)', :esc_f, :clave2, :jug_f1,
  format('[{"competencia": "%s", "puntuacion": 3}]', :com_f1)), '42501', 'entrenador E: no puede crear evaluaciones en F');
select prueba.error(format('select prueba.guardar(%L, null, %L, %L, %L, %L)', :esc_f, :clave2, :jug_f1, :gru_f,
  format('[{"competencia": "%s", "puntuacion": 3}]', :com_f1)), '23514',
  'en F, con un grupo real de F, el error es el mismo que si no existiera (no revela asignaciones)');
select prueba.error(format(
  'insert into public.evaluaciones (escuela_id, jugador_id, tipo, fecha, entrenador_id) values (%L, %L, %L, current_date, %L)',
  :esc_e, :jug_e1, 'rapida', :dir_e), '42501', 'no se puede falsificar el autor de una evaluación');
select prueba.error(format('insert into public.evaluaciones (escuela_id, jugador_id, grupo_id, tipo, fecha) values (%L, %L, %L, %L, current_date)',
  :esc_e, :jug_e1, :gru_f, 'rapida'), '23514', 'el grupo de otra escuela no vale (ni insertando directamente)');
reset role;


-- ------------------------------------------- evaluaciones: editar (permisos)
-- Otro entrenador de la misma escuela: lee, pero no edita evaluaciones ajenas.
select set_config('request.jwt.claim.sub', :ent_e2, false);
set role authenticated;
select prueba.ok((select count(*) from public.evaluaciones) = 1 and (select count(*) from public.evaluacion_puntuaciones) = 2,
  'entrenador E2: ve las evaluaciones de su escuela');
select prueba.error(format('select prueba.guardar(%L, %L, null, null, null, %L)', :esc_e,
  (select id from public.evaluaciones where clave_envio = :clave1), format('[{"competencia": "%s", "puntuacion": 1}]', :com_e1)),
  'P0002', 'entrenador E2: no puede editar la evaluación de otro entrenador');
select prueba.ok(prueba.filas(format('update public.evaluaciones set observaciones = %L where clave_envio = %L', 'Cambiada', :clave1)) = 0,
  'entrenador E2: tampoco directamente (0 filas)');
select prueba.ok(prueba.filas('delete from public.evaluacion_puntuaciones') = 0
             and prueba.filas('delete from public.evaluacion_objetivos') = 0,
  'entrenador E2: no puede borrar notas ni objetivos de evaluaciones ajenas');
select prueba.error(format('insert into public.evaluacion_puntuaciones (escuela_id, evaluacion_id, competencia_id, puntuacion) values (%L, %L, %L, 5)',
  :esc_e, (select id from public.evaluaciones where clave_envio = :clave1), :com_e2), '42501',
  'entrenador E2: no puede añadir notas a evaluaciones ajenas');
select prueba.error(format('delete from public.evaluaciones where clave_envio = %L', :clave1), '42501', 'nadie borra evaluaciones desde el cliente');
select prueba.error(format('update public.evaluaciones set jugador_id = %L where clave_envio = %L', :jug_e2, :clave1), '42501',
  'no se puede cambiar el jugador de una evaluación');
select prueba.error(format('update public.evaluaciones set entrenador_id = %L where clave_envio = %L', :ent_e2, :clave1), '42501',
  'no se puede cambiar el autor de una evaluación');
reset role;

-- El autor edita la suya: cambia datos y reemplaza notas y objetivos.
select set_config('request.jwt.claim.sub', :ent_e, false);
set role authenticated;
select prueba.ok(
  prueba.guardar(:esc_e, (select id from public.evaluaciones where clave_envio = :clave1), null, null, :gru_e,
    format('[{"competencia": "%s", "puntuacion": 5}]', :com_e1)::jsonb, 'completa', current_date - 30, '[]', 'Corregida')
  = (select id from public.evaluaciones where clave_envio = :clave1),
  'entrenador E: edita su propia evaluación');
select prueba.ok((select count(*) from public.evaluacion_puntuaciones) = 1
             and (select puntuacion from public.evaluacion_puntuaciones) = 5
             and (select count(*) from public.evaluacion_objetivos) = 0
             and (select observaciones from public.evaluaciones where clave_envio = :clave1) = 'Corregida'
             and (select jugador_id from public.evaluaciones where clave_envio = :clave1) = :jug_e1::uuid,
  'al editar se reemplazan notas y objetivos; el jugador no cambia');
reset role;

-- La dirección edita cualquier evaluación de su escuela, también con una
-- competencia que ya tenía aunque después se desactive.
set role service_role;
update public.competencias set activa = false where id = :com_e1;
reset role;
select set_config('request.jwt.claim.sub', :dir_e, false);
set role authenticated;
select prueba.ok(
  prueba.guardar(:esc_e, (select id from public.evaluaciones where clave_envio = :clave1), null, null, :gru_e,
    format('[{"competencia": "%s", "puntuacion": 4}, {"competencia": "%s", "puntuacion": 2}]', :com_e1, :com_e2)::jsonb, 'completa', current_date - 30)
  is not null,
  'director E: edita la evaluación de su entrenador (conservando una competencia ya desactivada)');
select prueba.ok(prueba.guardar(:esc_e, null, :clave3, :jug_e2, null, format('[{"competencia": "%s", "puntuacion": 3}]', :com_e2)::jsonb) is not null,
  'director E: también crea evaluaciones');
select prueba.ok((select count(*) from public.evaluaciones) = 2, 'director E: ve todas las evaluaciones de E');
reset role;


-- ---------------------------------------------------------- director de F
select set_config('request.jwt.claim.sub', :dir_f, false);
set role authenticated;
select prueba.ok((select count(*) from public.evaluaciones) = 0
             and (select count(*) from public.evaluacion_puntuaciones) = 0
             and (select count(*) from public.evaluacion_objetivos) = 0
             and (select count(*) from public.competencias) = 1,
  'director F: no ve evaluaciones, notas, objetivos ni competencias de E');
select prueba.ok((select count(*) from public.evaluaciones where escuela_id = :esc_e) = 0,
  'director F: ni filtrando por la escuela E');
select prueba.error(format('select prueba.guardar(%L, %L, null, null, null, %L)', :esc_e,
  (select e.id from public.evaluaciones e where false), format('[{"competencia": "%s", "puntuacion": 1}]', :com_f1)),
  '22023', 'director F: sin id ni clave no se guarda nada');
reset role;
-- Con el id real de la evaluación de E (que F no puede leer): mismo error que si no existiera.
select set_config('request.jwt.claim.sub', :dir_f, false);
select set_config('prueba.eval_e', (select id::text from public.evaluaciones where clave_envio = :clave1), false);
set role authenticated;
select prueba.error(format('select prueba.guardar(%L, %L, null, null, null, %L)', :esc_e, current_setting('prueba.eval_e'),
  format('[{"competencia": "%s", "puntuacion": 1}]', :com_e2)), 'P0002', 'director F: no puede editar evaluaciones de E (no se revela si existen)');
select prueba.error(format('select prueba.guardar(%L, %L, null, null, null, %L)', :esc_f, current_setting('prueba.eval_e'),
  format('[{"competencia": "%s", "puntuacion": 1}]', :com_f1)), 'P0002', 'director F: tampoco cambiando la escuela del parámetro');
select prueba.error(format('insert into public.evaluacion_puntuaciones (escuela_id, evaluacion_id, competencia_id, puntuacion) values (%L, %L, %L, 1)',
  :esc_f, current_setting('prueba.eval_e'), :com_f1), '42501', 'director F: no puede colar notas en evaluaciones de E');
select prueba.ok(prueba.guardar(:esc_f, null, :clave4, :jug_f1, :gru_f, format('[{"competencia": "%s", "puntuacion": 2}]', :com_f1)::jsonb) is not null,
  'director F: evalúa a su propio jugador');
reset role;
select prueba.ok((select count(*) from public.evaluaciones where escuela_id = :esc_e) = 2
             and (select puntuacion from public.evaluacion_puntuaciones where competencia_id = :com_e1) = 4,
  'los intentos de F no modificaron nada de E');


-- ------------------------------------- el director también entrena (misma cuenta)
-- Un único usuario y una única membresía (rol director): entrenar es una tarea
-- (ser entrenador_id de un grupo, ser autor de evaluaciones), no un rol aparte.
select set_config('request.jwt.claim.sub', :dir_e, false);
set role authenticated;
select prueba.ok(prueba.filas(format('update public.grupos set entrenador_id = %L where id = %L', :dir_e, :gru_e)) = 1,
  'director E: se asigna como entrenador de un grupo con su misma cuenta');
select prueba.ok(prueba.filas(format('insert into public.grupo_jugadores (escuela_id, grupo_id, jugador_id) values (%L, %L, %L)', :esc_e, :gru_e, :jug_e2)) = 1,
  'director E: como entrenador, asigna jugadores a su grupo');
select prueba.ok(
  prueba.guardar(:esc_e, null, :clave5, :jug_e2, :gru_e, format('[{"competencia": "%s", "puntuacion": 4}]', :com_e2)::jsonb) is not null,
  'director E: evalúa a un jugador de su grupo');
select prueba.ok((select entrenador_id from public.evaluaciones where clave_envio = :clave5) = :dir_e::uuid,
  'director E: queda como autor (entrenador) de esa evaluación');
select prueba.ok(
  prueba.guardar(:esc_e, (select id from public.evaluaciones where clave_envio = :clave5), null, null, :gru_e,
    format('[{"competencia": "%s", "puntuacion": 5}]', :com_e2)::jsonb) is not null,
  'director E: edita su propia evaluación de entrenador');
select prueba.ok(prueba.filas(format('insert into public.competencias (escuela_id, nombre, area) values (%L, %L, %L)', :esc_e, 'Saque', 'tecnica')) = 1
             and prueba.filas(format('update public.grupos set nombre = %L where id = %L', 'Grupo E dirigido y entrenado', :gru_e)) = 1
             and prueba.filas(format('update public.escuelas set nombre = %L where id = %L', 'Escuela E', :esc_e)) = 1,
  'director E: tras entrenar conserva todos sus permisos de dirección (metodología, grupos, escuela)');
select prueba.ok((select count(*) from public.membresias where usuario_id = :dir_e) = 1,
  'dirigir y entrenar no duplica usuarios ni membresías');
reset role;


-- ------------------------------------------------- integridad y borrados
set role service_role;
select prueba.error(format('delete from public.competencias where id = %L', :com_e2), '23503',
  'una competencia con puntuaciones no se puede borrar (ni service_role): se desactiva');
delete from public.membresias where usuario_id = :ent_e;
select prueba.ok((select entrenador_id from public.evaluaciones where clave_envio = :clave1) is null
             and exists (select 1 from public.evaluaciones where clave_envio = :clave1),
  'al quitar la membresía del autor, la evaluación se conserva (sin autor)');
delete from public.grupo_jugadores where grupo_id = :gru_e and jugador_id = :jug_e1;
select prueba.ok((select grupo_id from public.evaluaciones where clave_envio = :clave1) = :gru_e::uuid,
  'si el jugador sale del grupo, la evaluación histórica conserva el grupo');
delete from public.grupos where id = :gru_e;
select prueba.ok((select grupo_id from public.evaluaciones where clave_envio = :clave1) is null,
  'si se borra el grupo, la evaluación se conserva sin grupo');
delete from public.jugadores where id = :jug_e1;
select prueba.ok(not exists (select 1 from public.evaluaciones where clave_envio = :clave1)
             and (select count(*) from public.evaluacion_puntuaciones where escuela_id = :esc_e) = 2,
  'borrar un jugador (solo director o service_role) borra sus evaluaciones y notas');
reset role;

select set_config('request.jwt.claim.sub', :ent_e, false);
set role authenticated;
select prueba.ok((select count(*) from public.evaluaciones) = 0, 'sin membresía, el exentrenador ya no ve evaluaciones');
reset role;

\warn 'TODAS LAS PRUEBAS DE EVALUACIONES HAN PASADO'
