-- =============================================================================
-- ÉVORA PADEL · Migración 2: perfiles de usuarios previos y alta segura de
-- la primera escuela con su director
-- =============================================================================
-- Corrige dos problemas detectados al revisar la migración 1 antes de aplicarla:
--
--   1. Los usuarios que se registraron en Supabase Auth ANTES de aplicar la
--      migración 1 no tienen perfil (el trigger aún no existía). Sin perfil no
--      pueden tener membresías: el alta del primer director fallaba con un
--      error de clave foránea.
--   2. El alta de la primera escuela se hacía copiando a mano un UUID en una
--      plantilla SQL, sin validaciones ni mensajes claros.
--
-- No inserta datos personales: el relleno de perfiles solo copia el id.
-- Revisión y ejecución: ver supabase/README.md.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Perfiles de los usuarios que ya existían
-- -----------------------------------------------------------------------------
insert into public.perfiles (id)
select u.id from auth.users u
on conflict (id) do nothing;


-- -----------------------------------------------------------------------------
-- 2. Alta de una escuela con su director (solo administración)
-- -----------------------------------------------------------------------------
-- Uso, desde el SQL Editor de Supabase (que actúa como «postgres»):
--
--   select privado.crear_escuela_con_director('Nombre de la escuela', 'director@dominio.com');
--
-- El director debe haberse registrado antes en Supabase Auth con ese email.
-- SECURITY INVOKER: se ejecuta con los permisos de quien la llama. Además se
-- retira EXECUTE a todos los roles de la API, así que solo «postgres» (dueño)
-- puede usarla. Todo ocurre en una sola transacción: o se crean la escuela y la
-- membresía, o no se crea nada.

create function privado.crear_escuela_con_director(p_nombre text, p_email_director text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nombre   text := btrim(coalesce(p_nombre, ''));
  v_email    text := lower(btrim(coalesce(p_email_director, '')));
  v_usuarios uuid[];
  v_escuela  uuid;
begin
  if char_length(v_nombre) not between 2 and 120 then
    raise exception 'El nombre de la escuela debe tener entre 2 y 120 caracteres.'
      using errcode = '22023';
  end if;

  if v_email = '' then
    raise exception 'Falta el email del director.' using errcode = '22023';
  end if;

  select array_agg(u.id) into v_usuarios
  from auth.users u
  where lower(u.email) = v_email;

  if v_usuarios is null then
    raise exception 'No hay ningún usuario de Supabase Auth con el email %. Debe registrarse antes.', v_email
      using errcode = 'P0002';  -- no_data_found
  end if;
  if cardinality(v_usuarios) > 1 then
    raise exception 'Hay % usuarios con el email %; resuelve el duplicado antes de continuar.', cardinality(v_usuarios), v_email
      using errcode = 'P0003';  -- too_many_rows
  end if;

  insert into public.perfiles (id) values (v_usuarios[1]) on conflict (id) do nothing;

  insert into public.escuelas (nombre) values (v_nombre)
  returning id into v_escuela;

  insert into public.membresias (escuela_id, usuario_id, rol)
  values (v_escuela, v_usuarios[1], 'director');

  return v_escuela;
end;
$$;

comment on function privado.crear_escuela_con_director(text, text) is
  'Crea una escuela y asigna su director (usuario de Auth con ese email). Solo para el SQL Editor (rol postgres).';

revoke all on function privado.crear_escuela_con_director(text, text)
  from public, anon, authenticated, service_role;
