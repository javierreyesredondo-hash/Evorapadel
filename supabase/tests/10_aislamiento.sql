-- =============================================================================
-- Pruebas de aislamiento y permisos de la migración de fundación.
-- SOLO EN UN POSTGRESQL LOCAL DESECHABLE (scripts/probar-migracion.sh).
-- Usa identificadores sintéticos sin datos personales. Todo se ejecuta en una
-- transacción que el script descarta al terminar.
-- Cada comprobación imprime «ok …»; el primer fallo detiene el script.
-- =============================================================================

\set ON_ERROR_STOP on
set client_min_messages = notice;

-- ---------------------------------------------------------------- utilidades
create schema prueba;
grant usage on schema prueba to public;

create function prueba.ok(condicion boolean, mensaje text) returns void
language plpgsql as $$
begin
  if condicion is not true then
    raise exception 'FALLO: %', mensaje;
  end if;
  raise notice 'ok  %', mensaje;
end $$;

-- Ejecuta la sentencia y exige que falle con el SQLSTATE indicado.
create function prueba.error(sentencia text, codigo text, mensaje text) returns void
language plpgsql as $$
begin
  begin
    execute sentencia;
  exception when others then
    if sqlstate = codigo then
      raise notice 'ok  % (%)', mensaje, codigo;
      return;
    end if;
    raise exception 'FALLO: % — se esperaba %, se obtuvo % (%)', mensaje, codigo, sqlstate, sqlerrm;
  end;
  raise exception 'FALLO: % — la sentencia no dio error', mensaje;
end $$;

-- Ejecuta la sentencia y devuelve cuántas filas afectó.
create function prueba.filas(sentencia text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute sentencia;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on all functions in schema prueba to public;

-- Identificadores sintéticos
\set esc_a   '''0000000a-0000-4000-8000-000000000000'''
\set esc_b   '''0000000b-0000-4000-8000-000000000000'''
\set dir_a   '''000000a1-0000-4000-8000-000000000000'''
\set ent_a   '''000000a2-0000-4000-8000-000000000000'''
\set dir_b   '''000000b1-0000-4000-8000-000000000000'''
\set sin     '''00000001-0000-4000-8000-000000000000'''
-- Registrado en Auth ANTES de aplicar las migraciones (tests/05_antes_de_migrar.sql)
\set previo  '''00000c01-0000-4000-8000-000000000000'''
\set jug_a1  '''0000a001-0000-4000-8000-000000000000'''
\set jug_a2  '''0000a002-0000-4000-8000-000000000000'''
\set jug_b1  '''0000b001-0000-4000-8000-000000000000'''
\set gru_a   '''000a0001-0000-4000-8000-000000000000'''
\set gru_b   '''000b0001-0000-4000-8000-000000000000'''


-- ------------------------------------------------------- estructura y permisos
select prueba.ok(
  (select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'),
  'RLS activado en todas las tablas de public');

select prueba.ok(
  (select count(*) from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon') = 0,
  'anon no tiene ningún permiso sobre tablas de public');

select prueba.ok(
  (select count(*) from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')) = 0,
  'authenticated no tiene TRUNCATE, REFERENCES ni TRIGGER');

select prueba.ok(
  not exists (select 1 from information_schema.column_privileges
              where table_schema = 'public' and grantee = 'authenticated'
                and privilege_type = 'UPDATE'
                and column_name in ('id', 'escuela_id', 'created_at', 'updated_at', 'creado_por', 'usuario_id', 'rol')),
  'authenticated no puede actualizar id, escuela_id, marcas de tiempo, creado_por, usuario_id ni rol');

select prueba.ok(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'privado' and p.prosecdef
     and not exists (select 1 from unnest(p.proconfig) cfg where cfg = 'search_path=""')) = 0,
  'las funciones SECURITY DEFINER fijan search_path vacío');

select prueba.ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.prosecdef),
  'no hay funciones SECURITY DEFINER en el esquema expuesto public');

select prueba.ok(
  not exists (
    -- Cada FK de public debe tener un índice cuyas primeras columnas sean las de la FK.
    select 1 from pg_constraint c
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
          and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey)),
  'todas las claves foráneas tienen un índice que las cubre');

select prueba.ok(
  not exists (select 1 from pg_policies where schemaname = 'public' and roles <> '{authenticated}'),
  'todas las políticas son solo para authenticated (ninguna para anon ni public)');

select prueba.ok(
  (select count(*) from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE'
     and tablename in ('escuelas', 'perfiles', 'membresias', 'jugadores', 'grupos', 'grupo_jugadores')) = 16,
  'existen exactamente las 16 políticas revisadas en las tablas de la migración 1');

select prueba.ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'privado'
                and (has_function_privilege('anon', p.oid, 'execute')
                     or has_function_privilege('public', p.oid, 'execute'))),
  'anon y public no pueden ejecutar ninguna función del esquema privado');

select prueba.ok(
  not has_schema_privilege('anon', 'privado', 'usage'),
  'anon no tiene acceso al esquema privado');

select prueba.ok(
  exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'crear_perfil_al_registrarse'),
  'existe el trigger de creación de perfiles sobre auth.users');

select prueba.ok(
  (select confdeltype = 'n'
          and confdelsetcols = array[(select attnum from pg_attribute
                                      where attrelid = 'public.grupos'::regclass and attname = 'entrenador_id')]::int2[]
   from pg_constraint
   where conrelid = 'public.grupos'::regclass and contype = 'f' and confrelid = 'public.membresias'::regclass),
  'la FK grupos→membresías usa ON DELETE SET NULL (entrenador_id) solo sobre esa columna');

select prueba.ok(
  (select count(*) from public.escuelas) + (select count(*) from public.membresias)
    + (select count(*) from public.jugadores) + (select count(*) from public.grupos) = 0,
  'las migraciones no crean escuelas, membresías, jugadores ni grupos');

select prueba.ok(
  exists (select 1 from public.perfiles where id = :previo)
  and (select count(*) from public.perfiles) = (select count(*) from auth.users)
  and (select count(*) from public.perfiles where nombre_visible is not null) = 0,
  'el usuario registrado antes de migrar recibe su perfil (solo el id, sin datos personales)');


-- ----------------------------------------------------------------- preparación
-- Alta de usuarios como lo hace Supabase Auth (rol supabase_auth_admin).
set role supabase_auth_admin;
insert into auth.users (id) values (:dir_a), (:ent_a), (:dir_b), (:sin);
reset role;

select prueba.ok((select count(*) from public.perfiles) = 5,
  'el trigger crea un perfil por usuario de Auth (aunque el rol de Auth no tenga EXECUTE)');
select prueba.ok((select count(*) from public.perfiles where nombre_visible is not null) = 0,
  'los perfiles nacen sin datos personales');

-- Escuelas, membresías y datos: solo service_role puede crearlos.
set role service_role;
insert into public.escuelas (id, nombre) values (:esc_a, 'Escuela A'), (:esc_b, 'Escuela B');
insert into public.membresias (escuela_id, usuario_id, rol) values
  (:esc_a, :dir_a, 'director'),
  (:esc_a, :ent_a, 'entrenador'),
  (:esc_b, :dir_b, 'director');
insert into public.jugadores (id, escuela_id, nombre) values
  (:jug_a1, :esc_a, 'Jugador A1'),
  (:jug_a2, :esc_a, 'Jugador A2'),
  (:jug_b1, :esc_b, 'Jugador B1');
insert into public.grupos (id, escuela_id, nombre, entrenador_id) values
  (:gru_a, :esc_a, 'Grupo A', :ent_a),
  (:gru_b, :esc_b, 'Grupo B', null);
insert into public.grupo_jugadores (escuela_id, grupo_id, jugador_id) values (:esc_a, :gru_a, :jug_a1);
select prueba.ok((select count(*) from public.jugadores) = 3, 'service_role ve y crea en todas las escuelas');
reset role;


-- -------------------------------------------------------------------- anon
set role anon;
select prueba.error('select * from public.jugadores', '42501', 'anon no puede leer jugadores');
select prueba.error('select * from public.escuelas', '42501', 'anon no puede leer escuelas');
select prueba.error('select privado.es_miembro(gen_random_uuid())', '42501', 'anon no puede usar las funciones privadas');
select prueba.error(format('insert into public.jugadores (escuela_id, nombre) values (%L, %L)', :esc_a, 'Anónimo'), '42501',
  'anon no puede crear jugadores');
reset role;


-- ------------------------------------------------- usuario sin ninguna escuela
select set_config('request.jwt.claim.sub', :sin, false);
set role authenticated;
select prueba.ok((select count(*) from public.escuelas) = 0, 'sin membresía: no ve escuelas');
select prueba.ok((select count(*) from public.jugadores) = 0, 'sin membresía: no ve jugadores');
select prueba.ok((select count(*) from public.grupos) = 0, 'sin membresía: no ve grupos');
select prueba.ok((select count(*) from public.membresias) = 0, 'sin membresía: no ve membresías');
select prueba.ok((select count(*) from public.perfiles) = 1, 'sin membresía: solo ve su propio perfil');
select prueba.error(format('insert into public.escuelas (nombre) values (%L)', 'Nueva'), '42501',
  'nadie puede crear escuelas desde el cliente');
select prueba.error(format('insert into public.membresias (escuela_id, usuario_id, rol) values (%L, %L, %L)', :esc_a, :sin, 'director'),
  '42501', 'nadie puede darse de alta (ni como director) en una escuela');
select prueba.error(format('insert into public.jugadores (escuela_id, nombre) values (%L, %L)', :esc_a, 'Intruso'),
  '42501', 'sin membresía: no puede crear jugadores');
reset role;


-- ---------------------------------------------------------- director de A
select set_config('request.jwt.claim.sub', :dir_a, false);
set role authenticated;
select prueba.ok((select array_agg(id) from public.escuelas) = array[:esc_a::uuid], 'director A: solo ve la escuela A');
select prueba.ok((select count(*) from public.jugadores) = 2, 'director A: ve los 2 jugadores de A');
select prueba.ok((select count(*) from public.jugadores where escuela_id = :esc_b) = 0, 'director A: no ve jugadores de B aunque filtre por B');
select prueba.ok((select count(*) from public.jugadores where id = :jug_b1) = 0, 'director A: no ve un jugador de B por su id');
select prueba.ok((select count(*) from public.membresias) = 2, 'director A: ve solo las membresías de A');
select prueba.ok((select count(*) from public.perfiles) = 2, 'director A: ve su perfil y el de su entrenador, no los de B');
select prueba.ok((select count(*) from public.grupo_jugadores) = 1, 'director A: ve solo las asignaciones de A');

-- Escribir en otra escuela
select prueba.error(format('insert into public.jugadores (escuela_id, nombre) values (%L, %L)', :esc_b, 'Intruso'),
  '42501', 'director A: no puede crear jugadores en B');
select prueba.ok(prueba.filas(format('update public.jugadores set nombre = %L where id = %L', 'Cambiado', :jug_b1)) = 0,
  'director A: no puede editar jugadores de B (0 filas)');
select prueba.ok(prueba.filas(format('delete from public.jugadores where id = %L', :jug_b1)) = 0,
  'director A: no puede borrar jugadores de B (0 filas)');
select prueba.ok(prueba.filas(format('update public.escuelas set nombre = %L where id = %L', 'Hackeada', :esc_b)) = 0,
  'director A: no puede renombrar la escuela B');
select prueba.error(format('insert into public.grupos (escuela_id, nombre) values (%L, %L)', :esc_b, 'Intruso'),
  '42501', 'director A: no puede crear grupos en B');
select prueba.ok(prueba.filas(format('update public.grupos set nombre = %L where id = %L', 'Hackeado', :gru_b)) = 0,
  'director A: no puede editar grupos de B');
select prueba.ok(prueba.filas(format('delete from public.grupos where id = %L', :gru_b)) = 0,
  'director A: no puede borrar grupos de B');
select prueba.ok(prueba.filas(format('delete from public.grupo_jugadores where escuela_id = %L', :esc_b)) = 0,
  'director A: no puede quitar asignaciones de B');

-- Mezclar escuelas mediante relaciones
select prueba.error(format('insert into public.grupo_jugadores (escuela_id, grupo_id, jugador_id) values (%L, %L, %L)', :esc_a, :gru_a, :jug_b1),
  '23503', 'FK compuesta: no se puede meter un jugador de B en un grupo de A');
select prueba.error(format('insert into public.grupo_jugadores (escuela_id, grupo_id, jugador_id) values (%L, %L, %L)', :esc_b, :gru_b, :jug_b1),
  '42501', 'director A: no puede asignar jugadores en B');
select prueba.error(format('insert into public.grupos (escuela_id, nombre, entrenador_id) values (%L, %L, %L)', :esc_a, 'Grupo X', :dir_b),
  '23503', 'FK compuesta: el entrenador de un grupo debe ser miembro de la misma escuela');

-- Columnas protegidas
select prueba.error(format('update public.jugadores set escuela_id = %L where id = %L', :esc_b, :jug_a1),
  '42501', 'director A: no puede mover un jugador a otra escuela');
select prueba.error(format('insert into public.jugadores (escuela_id, nombre, creado_por) values (%L, %L, %L)', :esc_a, 'Falso', :dir_b),
  '42501', 'no se puede falsificar creado_por');
select prueba.error(format('update public.membresias set rol = %L where usuario_id = %L', 'director', :ent_a),
  '42501', 'director A: no puede cambiar roles (membresías solo por service_role)');
select prueba.error(format('delete from public.membresias where usuario_id = %L', :ent_a),
  '42501', 'director A: no puede borrar membresías');

-- Lo que sí puede hacer en su escuela
select prueba.ok(prueba.filas(format('insert into public.jugadores (escuela_id, nombre, nivel) values (%L, %L, %L)', :esc_a, 'Jugador A3', 'intermedio')) = 1,
  'director A: crea un jugador en A');
select prueba.ok((select creado_por from public.jugadores where nombre = 'Jugador A3') = :dir_a::uuid,
  'creado_por se rellena solo con el usuario actual');
select prueba.ok(prueba.filas(format('update public.escuelas set nombre = %L where id = %L', 'Escuela A renombrada', :esc_a)) = 1,
  'director A: renombra su escuela');
select prueba.ok((select updated_at > created_at or updated_at = now() from public.escuelas where id = :esc_a),
  'updated_at se actualiza automáticamente');
select prueba.ok(prueba.filas(format('insert into public.grupos (escuela_id, nombre) values (%L, %L)', :esc_a, 'Grupo A2')) = 1,
  'director A: crea un grupo en A');
select prueba.ok(prueba.filas(format('update public.grupos set entrenador_id = null where id = %L', :gru_a)) = 1
             and prueba.filas(format('update public.grupos set entrenador_id = %L where id = %L', :ent_a, :gru_a)) = 1,
  'director A: quita y vuelve a asignar a su entrenador en un grupo (UPDATE)');
select prueba.error(format('update public.grupos set entrenador_id = %L where id = %L', :dir_b, :gru_a),
  '23503', 'director A: no puede asignar como entrenador a alguien de la escuela B (UPDATE)');
select prueba.error(format('update public.grupos set entrenador_id = %L where id = %L', :sin, :gru_a),
  '23503', 'director A: no puede asignar como entrenador a alguien sin escuela');
select prueba.error(format('insert into public.grupos (escuela_id, nombre) values (%L, %L)', :esc_a, '  grupo a2 '),
  '23505', 'nombres de grupo únicos por escuela (sin distinguir mayúsculas ni espacios)');
select prueba.ok(prueba.filas(format('delete from public.jugadores where id = %L', :jug_a2)) = 1,
  'director A: borra un jugador de A');
reset role;


-- -------------------------------------------------------- entrenador de A
select set_config('request.jwt.claim.sub', :ent_a, false);
set role authenticated;
select prueba.ok((select count(*) from public.jugadores) = 2, 'entrenador A: ve los jugadores de A');
select prueba.ok((select count(*) from public.jugadores where escuela_id = :esc_b) = 0, 'entrenador A: no ve jugadores de B');
select prueba.ok((select count(*) from public.membresias) = 2, 'entrenador A: ve las membresías de A y ninguna de B');
select prueba.ok(prueba.filas(format('insert into public.jugadores (escuela_id, nombre) values (%L, %L)', :esc_a, 'Jugador A4')) = 1,
  'entrenador A: crea jugadores en A');
select prueba.ok(prueba.filas(format('update public.jugadores set foco = %L where id = %L', 'Volea', :jug_a1)) = 1,
  'entrenador A: edita jugadores de A');
select prueba.ok(prueba.filas(format('delete from public.jugadores where id = %L', :jug_a1)) = 0,
  'entrenador A: no puede borrar jugadores (solo director)');
select prueba.error(format('insert into public.grupos (escuela_id, nombre) values (%L, %L)', :esc_a, 'Grupo E'),
  '42501', 'entrenador A: no puede crear grupos (solo director)');
select prueba.ok(prueba.filas(format('update public.grupos set nombre = %L where id = %L', 'Otro', :gru_a)) = 0,
  'entrenador A: no puede editar grupos');
select prueba.ok(prueba.filas(format('update public.grupos set entrenador_id = null where id = %L', :gru_a)) = 0,
  'entrenador A: no puede cambiar quién entrena un grupo (lo decide el director)');
select prueba.ok((select entrenador_id from public.grupos where id = :gru_a) = :ent_a::uuid,
  'entrenador A: ve el grupo que tiene asignado');
select prueba.ok(prueba.filas(format('delete from public.grupos where id = %L', :gru_a)) = 0,
  'entrenador A: no puede borrar grupos');
select prueba.ok(prueba.filas(format('update public.escuelas set nombre = %L where id = %L', 'Otra', :esc_a)) = 0,
  'entrenador A: no puede renombrar la escuela');
select prueba.ok(prueba.filas(format(
  'insert into public.grupo_jugadores (escuela_id, grupo_id, jugador_id) select %L, %L, id from public.jugadores where nombre = %L',
  :esc_a, :gru_a, 'Jugador A4')) = 1,
  'entrenador A: asigna jugadores a grupos de A');
select prueba.ok(prueba.filas(format('update public.perfiles set nombre_visible = %L where id = %L', 'Entrenador', :ent_a)) = 1,
  'cada usuario edita su nombre visible');
select prueba.ok(prueba.filas(format('update public.perfiles set nombre_visible = %L where id = %L', 'Suplantado', :dir_a)) = 0,
  'nadie edita el perfil de otro');
select prueba.error(format('update public.perfiles set id = %L where id = %L', :sin, :ent_a),
  '42501', 'no se puede cambiar el id del perfil');
reset role;


-- ---------------------------------------------------------- director de B
select set_config('request.jwt.claim.sub', :dir_b, false);
set role authenticated;
select prueba.ok((select count(*) from public.jugadores) = 1, 'director B: solo ve su jugador');
select prueba.ok((select count(*) from public.perfiles) = 1, 'director B: no ve perfiles de A');
select prueba.ok((select nombre from public.jugadores where id = :jug_b1) = 'Jugador B1',
  'los intentos de A no modificaron los datos de B');
reset role;


-- --------------------------------------------------------- borrados en cascada
set role service_role;
select prueba.error(format('update public.jugadores set escuela_id = %L where escuela_id = %L', :esc_b, :esc_a),
  '42501', 'ni siquiera service_role puede mover registros de escuela (trigger)');
delete from public.membresias where usuario_id = :ent_a;
select prueba.ok((select entrenador_id from public.grupos where id = :gru_a) is null,
  'al quitar la membresía del entrenador, el grupo se conserva sin entrenador');
reset role;

select set_config('request.jwt.claim.sub', :ent_a, false);
set role authenticated;
select prueba.ok((select count(*) from public.jugadores) = 0, 'sin membresía, el exentrenador pierde el acceso al instante');
reset role;

set role supabase_auth_admin;
delete from auth.users where id = :dir_b;
reset role;
select prueba.ok(not exists (select 1 from public.perfiles where id = :dir_b)
             and not exists (select 1 from public.membresias where usuario_id = :dir_b),
  'borrar un usuario de Auth borra su perfil y sus membresías');

set role service_role;
-- Escuela con un grupo cuyo entrenador sigue asignado: el borrado en cascada
-- (membresías → SET NULL en grupos, y grupos → borrado) no debe fallar.
insert into public.membresias (escuela_id, usuario_id, rol) values (:esc_b, :sin, 'entrenador');
update public.grupos set entrenador_id = :sin where id = :gru_b;
delete from public.escuelas where id = :esc_b;
select prueba.ok(not exists (select 1 from public.jugadores where escuela_id = :esc_b)
             and not exists (select 1 from public.grupos where escuela_id = :esc_b),
  'borrar una escuela (solo service_role) borra sus datos');
reset role;


-- ------------------------------------- alta de escuela con director (migración 2)
set role anon;
select prueba.error(format('select privado.crear_escuela_con_director(%L, %L)', 'X', 'previo@ejemplo.invalid'),
  '42501', 'anon no puede usar el alta de escuelas');
reset role;
select set_config('request.jwt.claim.sub', :previo, false);
set role authenticated;
select prueba.error(format('select privado.crear_escuela_con_director(%L, %L)', 'X', 'previo@ejemplo.invalid'),
  '42501', 'un usuario autenticado no puede darse de alta como director');
reset role;
set role service_role;
select prueba.error(format('select privado.crear_escuela_con_director(%L, %L)', 'X', 'previo@ejemplo.invalid'),
  '42501', 'service_role (API) tampoco puede usar el alta de escuelas');
reset role;

-- Como «postgres» (SQL Editor de Supabase)
set role postgres;
select prueba.error(format('select privado.crear_escuela_con_director(%L, %L)', ' x ', 'previo@ejemplo.invalid'),
  '22023', 'alta: rechaza nombres de escuela demasiado cortos');
select prueba.error(format('select privado.crear_escuela_con_director(%L, %L)', 'Escuela C', '  '),
  '22023', 'alta: exige el email del director');
select prueba.error(format('select privado.crear_escuela_con_director(%L, %L)', 'Escuela C', 'nadie@ejemplo.invalid'),
  'P0002', 'alta: avisa si no existe ningún usuario con ese email');
select prueba.ok(not exists (select 1 from public.escuelas where nombre = 'Escuela C'),
  'alta: si falla, no se crea ninguna escuela');
select prueba.ok(
  (select privado.crear_escuela_con_director('  Escuela C  ', '  PREVIO@Ejemplo.INVALID ')) is not null,
  'alta: crea la escuela (email sin distinguir mayúsculas ni espacios)');
select prueba.ok(
  exists (select 1 from public.membresias m join public.escuelas e on e.id = m.escuela_id
          where e.nombre = 'Escuela C' and m.usuario_id = :previo and m.rol = 'director'),
  'alta: el usuario registrado antes de migrar queda como director');
reset role;

set role supabase_auth_admin;
insert into auth.users (id, email) values
  ('00000d01-0000-4000-8000-000000000000', 'repetido@ejemplo.invalid'),
  ('00000d02-0000-4000-8000-000000000000', 'REPETIDO@ejemplo.invalid');
reset role;
set role postgres;
select prueba.error(format('select privado.crear_escuela_con_director(%L, %L)', 'Escuela D', 'repetido@ejemplo.invalid'),
  'P0003', 'alta: se niega si hay varios usuarios con el mismo email');
reset role;

-- El nuevo director accede a su escuela y solo a ella
select set_config('request.jwt.claim.sub', :previo, false);
set role authenticated;
select prueba.ok((select array_agg(nombre) from public.escuelas) = array['Escuela C'],
  'el nuevo director ve su escuela y ninguna otra');
select prueba.ok(prueba.filas(format('insert into public.jugadores (escuela_id, nombre) select id, %L from public.escuelas', 'Jugador C1')) = 1,
  'el nuevo director ya puede crear jugadores en su escuela');
reset role;

\warn 'TODAS LAS PRUEBAS DE AISLAMIENTO HAN PASADO'
