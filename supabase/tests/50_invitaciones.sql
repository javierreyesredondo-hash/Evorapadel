-- =============================================================================
-- Pruebas de la migración 6 (administrador global, invitaciones y suspensión).
-- SOLO EN UN POSTGRESQL LOCAL DESECHABLE (scripts/probar-migracion.sh), después
-- de 10_aislamiento.sql (reutiliza sus funciones). Datos sintéticos.
-- =============================================================================

\set ON_ERROR_STOP on
set client_min_messages = notice;

\set esc_x   '''0000000e-0000-4000-8000-00000000000e'''
\set admin   '''000000e0-0000-4000-8000-00000000000e'''
\set dir_x   '''000000e1-0000-4000-8000-00000000000e'''
\set ent_x   '''000000e2-0000-4000-8000-00000000000e'''
\set nuevo   '''000000e3-0000-4000-8000-00000000000e'''
\set otro    '''000000e4-0000-4000-8000-00000000000e'''
\set jug_x   '''0000e001-0000-4000-8000-00000000000e'''
\set h1      '''1111111111111111111111111111111111111111111111111111111111111111'''
\set h2      '''2222222222222222222222222222222222222222222222222222222222222222'''
\set h3      '''3333333333333333333333333333333333333333333333333333333333333333'''
\set h4      '''4444444444444444444444444444444444444444444444444444444444444444'''
\set h5      '''5555555555555555555555555555555555555555555555555555555555555555'''


-- ------------------------------------------------------- estructura y permisos
select prueba.ok(
  (select relrowsecurity from pg_class where oid = 'public.invitaciones'::regclass)
  and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invitaciones')
  and not exists (select 1 from information_schema.role_table_grants
                  where table_schema = 'public' and table_name = 'invitaciones' and grantee in ('anon', 'authenticated')),
  'invitaciones: RLS sin políticas ni permisos para la API (solo funciones privadas)');

select prueba.ok(
  not exists (select 1 from information_schema.role_table_grants
              where table_schema = 'privado' and table_name = 'administradores'
                and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')),
  'administradores: nadie de la API la lee ni la escribe (alta solo por SQL)');

select prueba.ok((select count(*) from privado.administradores) = 0 and (select count(*) from public.invitaciones) = 0,
  'la migración no crea administradores ni invitaciones (nadie es administrador por defecto)');

select prueba.ok(
  not exists (select 1 from information_schema.column_privileges
              where table_schema = 'public' and table_name = 'escuelas' and grantee = 'authenticated'
                and privilege_type in ('INSERT', 'UPDATE') and column_name in ('estado', 'estado_cambiado_at')),
  'el estado de una escuela no lo cambia el cliente');

select prueba.ok(
  (select bool_and(p.prosecdef) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'privado' and p.proname in ('es_administrador', 'escuela_activa', 'admin_listar_escuelas',
      'admin_invitar', 'admin_crear_escuela', 'admin_revocar_invitacion', 'admin_cambiar_estado_escuela',
      'consultar_invitacion', 'aceptar_invitacion'))
  and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.prosecdef),
  'las funciones privilegiadas son DEFINER en privado; public solo tiene envoltorios INVOKER');

select prueba.ok(
  (select count(*) from pg_policies where schemaname = 'public' and permissive = 'RESTRICTIVE' and policyname like 'suspension_%') = 10,
  'la suspensión se aplica con 10 políticas RESTRICTIVE (los datos de la escuela y el cambio de nombre)');


-- ----------------------------------------------------------------- preparación
set role supabase_auth_admin;
insert into auth.users (id, email) values
  (:admin, 'propietario@evora.invalid'), (:dir_x, 'director-x@evora.invalid'), (:ent_x, 'entrenador-x@evora.invalid'),
  (:nuevo, 'Nueva.Directora@Evora.invalid'), (:otro, 'otra@evora.invalid');
reset role;

-- El propietario se da de alta a mano (como en el SQL Editor).
insert into privado.administradores (usuario_id) values (:admin);

set role service_role;
insert into public.escuelas (id, nombre) values (:esc_x, 'Escuela X');
insert into public.membresias (escuela_id, usuario_id, rol) values (:esc_x, :dir_x, 'director'), (:esc_x, :ent_x, 'entrenador');
insert into public.jugadores (id, escuela_id, nombre) values (:jug_x, :esc_x, 'Jugador X');
reset role;


-- -------------------------------------------- anon y usuarios sin privilegios
set role anon;
select prueba.error('select public.soy_administrador()', '42501', 'anon no consulta si es administrador');
select prueba.error('select * from public.admin_listar_escuelas()', '42501', 'anon no usa el panel global');
select prueba.error(format('select * from public.consultar_invitacion(%L)', :h1), '42501', 'anon no consulta invitaciones');
select prueba.error(format('select public.aceptar_invitacion(%L)', :h1), '42501', 'anon no acepta invitaciones');
reset role;

select set_config('request.jwt.claim.sub', :dir_x, false);
set role authenticated;
select prueba.ok(not public.soy_administrador(), 'un director no es administrador global');
select prueba.error('select * from public.admin_listar_escuelas()', '42501', 'director: sin acceso al panel global');
select prueba.error(format('select public.admin_crear_escuela(%L, %L, %L, 7)', 'Intrusa', 'x@evora.invalid', :h1), '42501',
  'director: no crea escuelas');
select prueba.error(format('select public.admin_cambiar_estado_escuela(%L, %L)', :esc_x, 'suspendida'), '42501',
  'director: no suspende escuelas (ni la suya)');
select prueba.error(format('insert into privado.administradores (usuario_id) values (%L)', :dir_x), '42501',
  'director: no se concede privilegios globales');
select prueba.error(format('update public.escuelas set estado = %L where id = %L', 'activa', :esc_x), '42501',
  'director: no cambia el estado de su escuela');
select prueba.error('select * from public.invitaciones', '42501', 'director: no lee invitaciones');
reset role;

select set_config('request.jwt.claim.sub', :ent_x, false);
set role authenticated;
select prueba.error('select * from public.admin_listar_escuelas()', '42501', 'entrenador: sin acceso al panel global');
select prueba.error(format('select public.admin_invitar(%L, %L, %L, 7)', :esc_x, 'x@evora.invalid', :h1), '42501',
  'entrenador: no invita a nadie');
reset role;


-- ------------------------------------------------ administrador: alta e invitación
select set_config('request.jwt.claim.sub', :admin, false);
set role authenticated;
select prueba.ok(public.soy_administrador(), 'el propietario dado de alta es administrador global');
select public.admin_crear_escuela('  Escuela Nueva  ', ' Nueva.Directora@Evora.INVALID ', :h1, 7) as esc_nueva \gset
select prueba.ok(
  (select count(*) from public.admin_listar_escuelas() where escuela_nombre = 'Escuela Nueva'
     and escuela_estado = 'activa' and directores = 0 and invitacion_estado = 'pendiente'
     and invitacion_email = 'nueva.directora@evora.invalid'
     and invitacion_caduca between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour') = 1,
  'crea la escuela y una invitación pendiente de 7 días para el correo (normalizado)');
select prueba.error(format('select public.admin_crear_escuela(%L, %L, %L, 7)', 'X', 'a@evora.invalid', :h2), '22023', 'nombre demasiado corto');
select prueba.error(format('select public.admin_crear_escuela(%L, %L, %L, 7)', 'Escuela Mala', 'no-es-correo', :h2), '22023', 'correo no válido');
select prueba.error(format('select public.admin_crear_escuela(%L, %L, %L, 90)', 'Escuela Mala', 'a@evora.invalid', :h2), '22023', 'validez fuera de 1–30 días');
select prueba.error(format('select public.admin_crear_escuela(%L, %L, %L, 7)', 'Escuela Mala', 'a@evora.invalid', 'token-en-claro'), '22023',
  'solo acepta un hash SHA-256, nunca el token en claro');
select prueba.error(format('select public.admin_crear_escuela(%L, %L, %L, 7)', 'Escuela Repetida', 'a@evora.invalid', :h1), '23505',
  'el mismo hash no se usa dos veces');
select prueba.ok((select count(*) from public.escuelas where nombre in ('Escuela Mala', 'Escuela Repetida')) = 0,
  'si la invitación falla, no queda una escuela a medias');
reset role;


-- ----------------------------------------------------- consultar y aceptar
select set_config('request.jwt.claim.sub', :otro, false);
set role authenticated;
select prueba.ok(
  (select estado = 'pendiente' and escuela_nombre = 'Escuela Nueva' and email = 'nueva.directora@evora.invalid'
     from public.consultar_invitacion(:h1)),
  'con el enlace se ve la escuela y el correo invitado');
select prueba.ok((select estado = 'no_valida' and escuela_nombre is null and email is null from public.consultar_invitacion(:h5)),
  'un token inexistente no revela nada');
select prueba.ok((select estado = 'no_valida' from public.consultar_invitacion('abc')), 'un token mal formado tampoco');
select prueba.error(format('select public.aceptar_invitacion(%L)', :h1), '42501', 'otro correo no puede aceptar la invitación');
select prueba.ok(not exists (select 1 from public.membresias where usuario_id = :otro::uuid),
  'el intento con otro correo no crea ninguna membresía');
reset role;

-- Director nuevo (correo con mayúsculas en Auth): acepta y queda como director.
select set_config('request.jwt.claim.sub', :nuevo, false);
set role authenticated;
select prueba.ok(public.aceptar_invitacion(:h1) = :'esc_nueva'::uuid, 'el correo invitado acepta (sin distinguir mayúsculas)');
select prueba.ok(
  (select rol from public.membresias where usuario_id = :nuevo::uuid and escuela_id = :'esc_nueva'::uuid) = 'director'
  and exists (select 1 from public.perfiles where id = :nuevo::uuid),
  'queda como director de esa escuela (con su perfil)');
select prueba.ok(public.aceptar_invitacion(:h1) = :'esc_nueva'::uuid, 'un reintento del mismo usuario devuelve la misma escuela');
select prueba.ok((select count(*) from public.membresias where usuario_id = :nuevo::uuid) = 1, 'sin duplicar la membresía');
select prueba.ok((select count(*) from public.jugadores) = 0, 'el nuevo director no ve datos de otras escuelas');
reset role;

select set_config('request.jwt.claim.sub', :otro, false);
set role authenticated;
select prueba.ok((select estado from public.consultar_invitacion(:h1)) = 'aceptada', 'la invitación queda aceptada');
reset role;
-- Aunque fuera del mismo correo, otra cuenta no puede reutilizarla.
set role supabase_auth_admin;
update auth.users set email = 'nueva.directora@evora.invalid' where id = :otro;
reset role;
select set_config('request.jwt.claim.sub', :otro, false);
set role authenticated;
select prueba.error(format('select public.aceptar_invitacion(%L)', :h1), 'P0002', 'una invitación aceptada no se reutiliza');
reset role;
set role supabase_auth_admin;
update auth.users set email = 'otra@evora.invalid' where id = :otro;
reset role;


-- ------------------------------------- revocar, volver a invitar y caducidad
select set_config('request.jwt.claim.sub', :admin, false);
set role authenticated;
select public.admin_invitar(:esc_x, 'otra@evora.invalid', :h2, 7) as inv2 \gset
select prueba.ok((select invitacion_estado from public.admin_listar_escuelas() where escuela_id = :esc_x) = 'pendiente',
  'el propietario invita a una cuenta que ya existe (de otra escuela o de ninguna)');
select public.admin_invitar(:esc_x, 'otra@evora.invalid', :h3, 7) as inv3 \gset
select public.admin_revocar_invitacion(:'inv3');
select prueba.error(format('select public.admin_revocar_invitacion(%L)', :'inv3'), 'P0002', 'no se revoca dos veces');
reset role;

select set_config('request.jwt.claim.sub', :otro, false);
set role authenticated;
select prueba.error(format('select public.aceptar_invitacion(%L)', :h2), 'P0002', 'volver a invitar revoca la invitación anterior');
select prueba.error(format('select public.aceptar_invitacion(%L)', :h3), 'P0002', 'una invitación revocada no se acepta');
select prueba.ok((select estado from public.consultar_invitacion(:h3)) = 'revocada', 'se ve como revocada');
reset role;

-- Caducada: se crea con 1 día y se adelanta la caducidad (como si hubiera pasado el tiempo).
select set_config('request.jwt.claim.sub', :admin, false);
set role authenticated;
select public.admin_invitar(:esc_x, 'otra@evora.invalid', :h4, 1) as inv4 \gset
reset role;
update public.invitaciones set caduca_at = now() - interval '1 minute' where id = :'inv4';
select set_config('request.jwt.claim.sub', :otro, false);
set role authenticated;
select prueba.error(format('select public.aceptar_invitacion(%L)', :h4), 'P0002', 'una invitación caducada no se acepta');
select prueba.ok((select estado from public.consultar_invitacion(:h4)) = 'caducada', 'se ve como caducada');
reset role;

-- Cuenta existente que ya pertenece a otra escuela: acepta y conserva ambas.
select set_config('request.jwt.claim.sub', :admin, false);
set role authenticated;
select public.admin_invitar(:'esc_nueva', 'director-x@evora.invalid', :h5, 7) as inv5 \gset
reset role;
select set_config('request.jwt.claim.sub', :dir_x, false);
set role authenticated;
-- (Dos sentencias: dentro de una misma sentencia, el recuento vería el estado anterior.)
select prueba.ok(public.aceptar_invitacion(:h5) = :'esc_nueva'::uuid, 'un director con cuenta en otra escuela acepta la invitación');
select prueba.ok((select count(*) from public.membresias where usuario_id = :dir_x::uuid) = 2,
  'y conserva sus dos escuelas');
reset role;


-- ----------------------------------------------------------- suspensión
select set_config('request.jwt.claim.sub', :admin, false);
set role authenticated;
select public.admin_cambiar_estado_escuela(:esc_x, 'suspendida');
select prueba.ok((select escuela_estado from public.admin_listar_escuelas() where escuela_id = :esc_x) = 'suspendida',
  'el propietario suspende una escuela');
select prueba.error(format('select public.admin_cambiar_estado_escuela(%L, %L)', :esc_x, 'borrada'), '22023', 'estado no válido');
reset role;

select set_config('request.jwt.claim.sub', :dir_x, false);
set role authenticated;
select prueba.ok((select count(*) from public.jugadores where escuela_id = :esc_x) = 0,
  'escuela suspendida: su director no ve sus jugadores');
select prueba.error(format('insert into public.jugadores (escuela_id, nombre) values (%L, %L)', :esc_x, 'Nuevo'), '42501',
  'escuela suspendida: no se crean jugadores');
select prueba.ok(prueba.filas(format('update public.escuelas set nombre = %L where id = %L', 'Renombrada', :esc_x)) = 0,
  'escuela suspendida: no se renombra');
select prueba.ok((select estado from public.escuelas where id = :esc_x) = 'suspendida'
             and exists (select 1 from public.membresias where escuela_id = :esc_x and usuario_id = :dir_x::uuid),
  'el director ve que su escuela está suspendida (para mostrar el aviso)');
select prueba.ok((select count(*) from public.membresias m join public.escuelas e on e.id = m.escuela_id
                   where m.usuario_id = :dir_x::uuid and e.estado = 'activa') = 1,
  'su otra escuela (activa) sigue funcionando');
reset role;

select prueba.ok((select count(*) from public.jugadores where escuela_id = :esc_x) = 1
             and (select nombre from public.escuelas where id = :esc_x) = 'Escuela X',
  'suspender no borra ni cambia datos');

select set_config('request.jwt.claim.sub', :admin, false);
set role authenticated;
select public.admin_cambiar_estado_escuela(:esc_x, 'activa');
reset role;
select set_config('request.jwt.claim.sub', :dir_x, false);
set role authenticated;
select prueba.ok((select count(*) from public.jugadores where escuela_id = :esc_x) = 1,
  'al reactivarla, su director vuelve a ver todos sus datos');
reset role;

\warn 'TODAS LAS PRUEBAS DE INVITACIONES HAN PASADO'
