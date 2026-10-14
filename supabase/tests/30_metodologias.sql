-- =============================================================================
-- Pruebas de la migración 4 (metodologías importadas y versiones).
-- SOLO EN UN POSTGRESQL LOCAL DESECHABLE (scripts/probar-migracion.sh), después
-- de 10_aislamiento.sql y 20_evaluaciones.sql (reutiliza sus funciones).
-- Datos sintéticos, sin datos personales. El primer fallo detiene el script.
-- =============================================================================

\set ON_ERROR_STOP on
set client_min_messages = notice;

\set esc_g   '''0000000a-0000-4000-8000-00000000000a'''
\set esc_h   '''0000000b-0000-4000-8000-00000000000b'''
\set dir_g   '''000000a1-0000-4000-8000-00000000000a'''
\set ent_g   '''000000a2-0000-4000-8000-00000000000a'''
\set dir_h   '''000000b1-0000-4000-8000-00000000000b'''
\set jug_g   '''0000a001-0000-4000-8000-00000000000a'''
\set com_g   '''00ca0001-0000-4000-8000-00000000000a'''
\set met_1   '''0e7a0001-0000-4000-8000-00000000000a'''
\set met_2   '''0e7a0002-0000-4000-8000-00000000000a'''
\set met_h   '''0e7b0001-0000-4000-8000-00000000000b'''
\set sha_1   '''aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'''
\set sha_2   '''bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'''
\set clave_a '''0c1b0001-0000-4000-8000-00000000000a'''
\set clave_b '''0c1b0002-0000-4000-8000-00000000000a'''
\set clave_c '''0c1b0003-0000-4000-8000-00000000000a'''

-- Contenido mínimo de una metodología: escala y competencias (dos «Globo» en
-- grupos distintos, como en el método de referencia).
\set contenido_v1 '''{"escala":[{"valor":1,"nombre":"Inicial"},{"valor":5,"nombre":"Dominio"}],"competencias":[{"nombre":"Globo","grupo":"Técnica","evaluable":true},{"nombre":"Globo","grupo":"Defensa","evaluable":true},{"nombre":"Posición de espera","grupo":"Desplazamiento","evaluable":false}]}'''
\set contenido_v2 '''{"escala":[{"valor":1,"nombre":"Inicial"}],"competencias":[{"nombre":"Paciencia","grupo":"Criterios específicos","evaluable":true}]}'''
\set sin_evaluables '''{"competencias":[{"nombre":"Observación","grupo":"Libre","evaluable":false}]}'''


-- ------------------------------------------------------- estructura y permisos
select prueba.ok((select relrowsecurity from pg_class where oid = 'public.metodologias'::regclass),
  'RLS activado en metodologias');

select prueba.ok(
  (select count(*) from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE' and tablename = 'metodologias') = 3
  and not exists (select 1 from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE' and tablename = 'metodologias' and cmd in ('DELETE', 'ALL')),
  'metodologias: exactamente 3 políticas (leer, crear y editar) y ninguna de borrado');

select prueba.ok(
  not exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'metodologias'
                and grantee in ('anon', 'authenticated') and privilege_type in ('DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'))
  and not exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'metodologias' and grantee = 'anon'),
  'nadie borra metodologías y anon no tiene ningún permiso');

select prueba.ok(
  not exists (select 1 from information_schema.column_privileges
              where table_schema = 'public' and grantee = 'authenticated' and table_name = 'metodologias'
                and privilege_type = 'INSERT' and column_name in ('id', 'estado', 'creado_por', 'activada_at', 'created_at', 'updated_at'))
  and not exists (select 1 from information_schema.column_privileges
              where table_schema = 'public' and grantee = 'authenticated' and table_name = 'metodologias'
                and privilege_type = 'UPDATE' and column_name not in ('nombre', 'version', 'descripcion', 'contenido', 'estado')),
  'metodologias: estado, autor y fechas no se fijan al crear; la escuela y el documento no se cambian');

select prueba.ok(
  not exists (select 1 from information_schema.column_privileges
              where table_schema = 'public' and grantee = 'authenticated' and table_name = 'evaluaciones'
                and privilege_type in ('INSERT', 'UPDATE') and column_name = 'metodologia_id')
  and not exists (select 1 from information_schema.column_privileges
              where table_schema = 'public' and grantee = 'authenticated' and table_name = 'competencias'
                and privilege_type = 'UPDATE' and column_name in ('metodologia_id', 'grupo')),
  'la metodología de una evaluación y el grupo de una competencia no los elige el cliente');

select prueba.ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'privado' and p.prosecdef
                and p.proname in ('validar_metodologia', 'activar_competencias_metodologia',
                                  'proteger_competencia_metodologia', 'fijar_metodologia_evaluacion')),
  'las funciones nuevas son SECURITY INVOKER (aplican la RLS de quien escribe)');

select prueba.ok((select count(*) from public.metodologias) = 0, 'la migración no crea metodologías');


-- ----------------------------------------------------------------- preparación
set role supabase_auth_admin;
insert into auth.users (id) values (:dir_g), (:ent_g), (:dir_h);
reset role;

set role service_role;
insert into public.escuelas (id, nombre) values (:esc_g, 'Escuela G'), (:esc_h, 'Escuela H');
insert into public.membresias (escuela_id, usuario_id, rol) values
  (:esc_g, :dir_g, 'director'), (:esc_g, :ent_g, 'entrenador'), (:esc_h, :dir_h, 'director');
insert into public.jugadores (id, escuela_id, nombre) values (:jug_g, :esc_g, 'Jugador G');
insert into public.competencias (id, escuela_id, nombre, area, orden) values (:com_g, :esc_g, 'Golpes de fondo', 'tecnica', 1);
insert into public.metodologias (id, escuela_id, nombre, version, contenido)
  values (:met_h, :esc_h, 'Método H', '1.0', :contenido_v2);
reset role;


-- ------------------------------------------------------------------ anon
set role anon;
select prueba.error('select * from public.metodologias', '42501', 'anon no puede leer metodologías');
reset role;


-- ------------------------------------------- evaluación anterior (sin metodología)
select set_config('request.jwt.claim.sub', :ent_g, false);
set role authenticated;
select prueba.guardar(:esc_g, null, :clave_a, :jug_g, null, format('[{"competencia": "%s", "puntuacion": 3}]', :com_g)::jsonb);
select prueba.ok((select metodologia_id from public.evaluaciones where clave_envio = :clave_a) is null,
  'una evaluación sin metodología activa queda sin metodología (la base de siempre)');
reset role;


-- ------------------------------------------------------- crear (solo dirección)
select set_config('request.jwt.claim.sub', :ent_g, false);
set role authenticated;
select prueba.error(format('insert into public.metodologias (escuela_id, nombre, version, contenido) values (%L, %L, %L, %L)',
  :esc_g, 'Método entrenador', '1.0', :contenido_v1), '42501', 'entrenador G: no puede importar metodologías (solo dirección)');
reset role;

select set_config('request.jwt.claim.sub', :dir_g, false);
set role authenticated;
select prueba.error(format('insert into public.metodologias (id, escuela_id, nombre, version, contenido) values (%L, %L, %L, %L, %L)',
  :met_1, :esc_g, 'Método G', '1.0', :contenido_v1), '42501', 'el cliente no fija el id de una metodología');
select prueba.ok(prueba.filas(format(
  'insert into public.metodologias (escuela_id, nombre, version, contenido, documento_nombre, documento_sha256, documento_bytes, documento_paginas)
   values (%L, %L, %L, %L, %L, %L, 1000, 10)', :esc_g, 'Método G', '1.0', :contenido_v1, 'metodo.pdf', :sha_1)) = 1,
  'director G: guarda una metodología importada');
select prueba.ok((select estado from public.metodologias where escuela_id = :esc_g) = 'borrador'
             and (select creado_por from public.metodologias where escuela_id = :esc_g) = :dir_g::uuid,
  'se guarda como borrador, con la dirección como autora (no se activa sola)');
select prueba.error(format('insert into public.metodologias (escuela_id, nombre, version, contenido, estado) values (%L, %L, %L, %L, %L)',
  :esc_g, 'Método activo', '1.0', :contenido_v1, 'activa'), '42501', 'no se puede crear directamente activa');
select prueba.error(format('insert into public.metodologias (escuela_id, nombre, version, contenido, documento_sha256) values (%L, %L, %L, %L, %L)',
  :esc_g, 'Otra', '9.9', :contenido_v1, :sha_1), '23505', 'duplicado: el mismo PDF no se importa dos veces en una escuela');
select prueba.error(format('insert into public.metodologias (escuela_id, nombre, version, contenido) values (%L, %L, %L, %L)',
  :esc_g, '  método g ', '1.0 ', :contenido_v1), '23505', 'duplicado: mismo nombre y versión (sin mayúsculas ni espacios)');
select prueba.error(format('insert into public.metodologias (escuela_id, nombre, version, contenido) values (%L, %L, %L, %L)',
  :esc_h, 'Intrusa', '1.0', :contenido_v1), '42501', 'director G: no puede crear metodologías en H');
select prueba.ok((select count(*) from public.metodologias) = 1, 'director G: no ve las metodologías de H');
select prueba.ok(prueba.filas(format('update public.metodologias set estado = %L where escuela_id = %L', 'activa', :esc_h)) = 0,
  'director G: no puede activar metodologías de H');

-- Borrador: se corrige; sin competencias evaluables no se activa.
select prueba.ok(prueba.filas(format('update public.metodologias set descripcion = %L where escuela_id = %L', 'Revisada', :esc_g)) = 1,
  'un borrador se puede corregir');
select prueba.ok(prueba.filas(format('insert into public.metodologias (escuela_id, nombre, version, contenido) values (%L, %L, %L, %L)',
  :esc_g, 'Sin evaluables', '1.0', :sin_evaluables)) = 1, 'preparación: metodología sin competencias evaluables');
select prueba.error(format('update public.metodologias set estado = %L where nombre = %L', 'activa', 'Sin evaluables'), '22023',
  'no se activa una metodología sin competencias evaluables');
select prueba.ok(prueba.filas(format('update public.metodologias set estado = %L where nombre = %L', 'archivada', 'Sin evaluables')) = 1,
  'un borrador que no se quiere se archiva (no se borra)');
select prueba.error(format('delete from public.metodologias where nombre = %L', 'Sin evaluables'), '42501',
  'nadie borra metodologías desde el cliente');
reset role;


-- ----------------------------------------------------------------- activar
select set_config('request.jwt.claim.sub', :ent_g, false);
set role authenticated;
select prueba.ok(prueba.filas(format('update public.metodologias set estado = %L where nombre = %L', 'activa', 'Método G')) = 0,
  'entrenador G: no puede activar metodologías');
select prueba.ok((select count(*) from public.metodologias) = 2, 'entrenador G: ve las metodologías de su escuela');
reset role;

select set_config('request.jwt.claim.sub', :dir_g, false);
set role authenticated;
select prueba.ok(prueba.filas(format('update public.metodologias set estado = %L where nombre = %L', 'activa', 'Método G')) = 1,
  'director G: activa la metodología');
select prueba.ok((select activada_at from public.metodologias where nombre = 'Método G') is not null,
  'queda registrada la fecha de activación');
select prueba.ok(
  (select count(*) from public.competencias where escuela_id = :esc_g and activa and metodologia_id is not null) = 2
  and (select count(*) from public.competencias where escuela_id = :esc_g and grupo = 'Técnica' and nombre = 'Globo') = 1
  and (select count(*) from public.competencias where escuela_id = :esc_g and grupo = 'Defensa' and nombre = 'Globo') = 1
  and not exists (select 1 from public.competencias where nombre = 'Posición de espera'),
  'al activar se crean solo las competencias evaluables, con su grupo original («Globo» en Técnica y en Defensa)');
select prueba.ok((select activa from public.competencias where id = :com_g) = false
             and exists (select 1 from public.competencias where id = :com_g),
  'las competencias anteriores se desactivan, no se borran');
select prueba.error(format('update public.metodologias set contenido = %L where nombre = %L', :contenido_v2, 'Método G'), '22023',
  'una metodología activa no se modifica (se importa una versión nueva)');
select prueba.error(format('update public.metodologias set estado = %L where nombre = %L', 'borrador', 'Método G'), '22023',
  'una metodología activa no vuelve a borrador');
select prueba.error(format('update public.competencias set nombre = %L where nombre = %L and grupo = %L', 'Lob', 'Globo', 'Técnica'), '22023',
  'las competencias de una metodología no se renombran');
select prueba.ok(prueba.filas(format('update public.competencias set activa = false where nombre = %L and grupo = %L', 'Globo', 'Defensa')) = 1
             and prueba.filas(format('update public.competencias set activa = true where nombre = %L and grupo = %L', 'Globo', 'Defensa')) = 1,
  'las competencias de una metodología se pueden desactivar y reactivar');
select prueba.error(format('update public.competencias set metodologia_id = %L where id = %L',
  (select id from public.metodologias where nombre = 'Método G'), :com_g), '42501', 'una competencia propia no se cuela en una metodología');
reset role;


-- ------------------------------------------- evaluaciones: versión empleada
select set_config('request.jwt.claim.sub', :ent_g, false);
set role authenticated;
select prueba.guardar(:esc_g, null, :clave_b, :jug_g, null,
  format('[{"competencia": "%s", "puntuacion": 4}]',
         (select id from public.competencias where nombre = 'Globo' and grupo = 'Técnica'))::jsonb);
select prueba.ok((select metodologia_id from public.evaluaciones where clave_envio = :clave_b)
                 = (select id from public.metodologias where nombre = 'Método G'),
  'la evaluación queda ligada a la metodología activa al crearla');
select prueba.error(format('select prueba.guardar(%L, null, %L, %L, null, %L)', :esc_g, :clave_c, :jug_g,
  format('[{"competencia": "%s", "puntuacion": 3}]', :com_g)), '23503',
  'con la metodología activa no se puntúan competencias desactivadas');
select prueba.error(format(
  'insert into public.evaluaciones (escuela_id, jugador_id, tipo, fecha, clave_envio, metodologia_id) values (%L, %L, %L, current_date, %L, %L)',
  :esc_g, :jug_g, 'rapida', :clave_c, (select id from public.metodologias where nombre = 'Método G')), '42501',
  'el cliente no elige la metodología de una evaluación');
reset role;


-- ----------------------------------------------------- versión nueva
select set_config('request.jwt.claim.sub', :dir_g, false);
set role authenticated;
select prueba.ok(prueba.filas(format(
  'insert into public.metodologias (escuela_id, nombre, version, contenido, documento_sha256) values (%L, %L, %L, %L, %L)',
  :esc_g, 'Método G', '1.1', :contenido_v2, :sha_2)) = 1, 'una versión nueva se importa aparte (no sobrescribe la anterior)');
select prueba.ok(prueba.filas(format('update public.metodologias set estado = %L where version = %L and nombre = %L', 'activa', '1.1', 'Método G')) = 1,
  'director G: activa la versión nueva');
select prueba.ok(
  (select count(*) from public.metodologias where escuela_id = :esc_g and estado = 'activa') = 1
  and (select estado from public.metodologias where nombre = 'Método G' and version = '1.0') = 'archivada'
  and (select estado from public.metodologias where nombre = 'Método G' and version = '1.1') = 'activa',
  'solo una activa: la anterior queda archivada');
select prueba.ok(
  (select count(*) from public.competencias where escuela_id = :esc_g and activa) = 1
  and (select nombre from public.competencias where escuela_id = :esc_g and activa) = 'Paciencia',
  'las competencias activas pasan a ser las de la versión nueva');
select prueba.ok(
  (select metodologia_id from public.evaluaciones where clave_envio = :clave_b)
    = (select id from public.metodologias where nombre = 'Método G' and version = '1.0')
  and (select count(*) from public.evaluacion_puntuaciones p join public.evaluaciones e on e.id = p.evaluacion_id
        where e.clave_envio = :clave_b) = 1
  and (select metodologia_id from public.evaluaciones where clave_envio = :clave_a) is null,
  'las evaluaciones anteriores conservan su versión y sus notas');
-- En dos sentencias: la comprobación debe ver el resultado de la edición.
select prueba.ok(prueba.filas(format('update public.evaluaciones set observaciones = %L where clave_envio = %L', 'Editada', :clave_b)) = 1,
  'la dirección edita una evaluación antigua');
select prueba.ok((select metodologia_id from public.evaluaciones where clave_envio = :clave_b)
                 = (select id from public.metodologias where nombre = 'Método G' and version = '1.0'),
  'editar una evaluación antigua no cambia su versión de metodología');
select prueba.error(format('update public.metodologias set descripcion = %L where version = %L', 'Cambiada', '1.0'), '22023',
  'una versión archivada no se modifica');

-- Volver a la versión anterior: reutiliza sus competencias (sin duplicarlas).
select prueba.ok(prueba.filas(format('update public.metodologias set estado = %L where version = %L and nombre = %L', 'activa', '1.0', 'Método G')) = 1,
  'se puede volver a activar una versión archivada');
select prueba.ok(
  (select count(*) from public.competencias where escuela_id = :esc_g and nombre = 'Globo') = 2
  and (select count(*) from public.competencias where escuela_id = :esc_g and activa) = 2
  and (select estado from public.metodologias where version = '1.1') = 'archivada',
  'al reactivarla vuelven sus competencias sin duplicarse y la otra se archiva');
reset role;

select set_config('request.jwt.claim.sub', :dir_h, false);
set role authenticated;
select prueba.ok((select count(*) from public.metodologias) = 1
             and (select count(*) from public.competencias where escuela_id = :esc_g) = 0,
  'director H: no ve nada de las metodologías ni competencias de G');
reset role;

\warn 'TODAS LAS PRUEBAS DE METODOLOGÍAS HAN PASADO'
