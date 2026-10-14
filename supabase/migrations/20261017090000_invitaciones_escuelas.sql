-- =============================================================================
-- ÉVORA PADEL · Migración 6: alta de escuelas, invitaciones privadas y suspensión
-- =============================================================================
-- Revisable y SIN APLICAR. Requiere las migraciones 1 a 5.
--
-- Qué añade:
--   * privado.administradores: el PROPIETARIO de ÉVORA (administrador global).
--     Nadie lo es por defecto ni se puede conceder desde la app: se da de alta a
--     mano en el SQL Editor (ver supabase/README.md). Nunca el «primer usuario».
--   * public.invitaciones: invitación de un solo uso para dirigir una escuela,
--     ligada a la escuela, al correo y al rol. Solo se guarda el HASH (SHA-256)
--     del token: el token viaja únicamente en el enlace. Caduca (7 días por
--     defecto, 1–30). Se puede revocar y volver a invitar.
--   * escuelas.estado (activa / suspendida): registro administrativo simple
--     para la relación comercial (los pagos se gestionan fuera, por Bizum). Una
--     escuela suspendida no puede leer ni escribir sus datos (políticas
--     RESTRICTIVE), pero NO se borra nada; al reactivarla vuelve todo.
--   * Funciones: las privilegiadas viven en «privado» (SECURITY DEFINER,
--     search_path vacío) y comprueban que quien llama es administrador; la app
--     las usa mediante envoltorios SECURITY INVOKER en «public» (el esquema
--     expuesto sigue sin funciones DEFINER).
--
-- Sin pasarela de pagos ni planes: todas las escuelas activas tienen lo mismo.

-- -----------------------------------------------------------------------------
-- 1. Estado operativo de cada escuela
-- -----------------------------------------------------------------------------

alter table public.escuelas
  add column estado text not null default 'activa' check (estado in ('activa', 'suspendida')),
  add column estado_cambiado_at timestamptz;
-- Sin permisos nuevos: authenticated solo puede actualizar «nombre» (migración 1).

-- -----------------------------------------------------------------------------
-- 2. Administradores globales (propietario de ÉVORA)
-- -----------------------------------------------------------------------------

create table privado.administradores (
  usuario_id  uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
comment on table privado.administradores is
  'Administradores globales de ÉVORA. Solo se dan de alta a mano (SQL Editor, rol postgres).';
revoke all on privado.administradores from public, anon, authenticated, service_role;

create function privado.es_administrador()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from privado.administradores a where a.usuario_id = (select auth.uid()));
$$;

-- ¿La escuela está activa? (para las políticas de suspensión)
create function privado.escuela_activa(p_escuela uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.escuelas e where e.id = p_escuela and e.estado = 'activa');
$$;

revoke all on function privado.es_administrador()     from public, anon;
revoke all on function privado.escuela_activa(uuid)    from public, anon;
grant execute on function privado.es_administrador()  to authenticated;
grant execute on function privado.escuela_activa(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Invitaciones
-- -----------------------------------------------------------------------------

create table public.invitaciones (
  id            uuid primary key default gen_random_uuid(),
  escuela_id    uuid not null references public.escuelas (id) on delete cascade,
  email         text not null check (
                  email = lower(btrim(email)) and char_length(email) between 3 and 254
                  and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  rol           public.rol_escuela not null default 'director' check (rol = 'director'),
  -- SHA-256 (hex) del token. El token en claro no se guarda en ningún sitio.
  token_hash    text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  caduca_at     timestamptz not null,
  creada_por    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  aceptada_at   timestamptz,
  aceptada_por  uuid references auth.users (id) on delete set null,
  revocada_at   timestamptz,
  check (aceptada_at is null or revocada_at is null),
  check ((aceptada_at is null) = (aceptada_por is null))
);
create index invitaciones_escuela_idx      on public.invitaciones (escuela_id, created_at desc);
create index invitaciones_creada_por_idx   on public.invitaciones (creada_por);
create index invitaciones_aceptada_por_idx on public.invitaciones (aceptada_por);
comment on table public.invitaciones is
  'Invitaciones de un solo uso para dirigir una escuela (contiene correos: datos personales). Solo funciones privadas y service_role.';

-- Sin políticas: authenticated y anon no la leen ni la escriben directamente.
alter table public.invitaciones enable row level security;
revoke all on public.invitaciones from anon, authenticated;
grant all on public.invitaciones to service_role;

-- Estado legible de una invitación.
create function privado.estado_invitacion(p_aceptada timestamptz, p_revocada timestamptz, p_caduca timestamptz)
returns text
language sql stable security invoker set search_path = ''
as $$
  select case
    when p_aceptada is not null then 'aceptada'
    when p_revocada is not null then 'revocada'
    when p_caduca <= now() then 'caducada'
    else 'pendiente'
  end;
$$;
revoke all on function privado.estado_invitacion(timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function privado.estado_invitacion(timestamptz, timestamptz, timestamptz) to authenticated, service_role;

-- Comprobaciones comunes de los datos de una invitación nueva.
create function privado.validar_datos_invitacion(p_email text, p_token_hash text, p_dias integer)
returns text
language plpgsql immutable security invoker set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if char_length(v_email) not between 3 and 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Escribe un correo electrónico válido.' using errcode = '22023';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invitación mal formada.' using errcode = '22023';
  end if;
  if p_dias is null or p_dias not between 1 and 30 then
    raise exception 'La validez de la invitación debe ser de 1 a 30 días.' using errcode = '22023';
  end if;
  return v_email;
end;
$$;
revoke all on function privado.validar_datos_invitacion(text, text, integer) from public, anon, authenticated;

create function privado.exigir_administrador()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not privado.es_administrador() then
    raise exception 'Solo el administrador de ÉVORA puede hacer esto.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function privado.exigir_administrador() from public, anon, authenticated;

-- ---------------------------------------------------- funciones del administrador

-- Escuelas con su estado y su última invitación.
create function privado.admin_listar_escuelas()
returns table (
  escuela_id uuid, escuela_nombre text, escuela_estado text, alta timestamptz, estado_cambiado timestamptz,
  directores integer, miembros integer,
  invitacion_id uuid, invitacion_email text, invitacion_estado text, invitacion_creada timestamptz, invitacion_caduca timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform privado.exigir_administrador();
  return query
    select e.id, e.nombre, e.estado, e.created_at, e.estado_cambiado_at,
           (select count(*)::integer from public.membresias m where m.escuela_id = e.id and m.rol = 'director'),
           (select count(*)::integer from public.membresias m where m.escuela_id = e.id),
           i.id, i.email, privado.estado_invitacion(i.aceptada_at, i.revocada_at, i.caduca_at), i.created_at, i.caduca_at
      from public.escuelas e
      left join lateral (
        select x.id, x.email, x.aceptada_at, x.revocada_at, x.caduca_at, x.created_at
          from public.invitaciones x where x.escuela_id = e.id
         order by x.created_at desc limit 1
      ) i on true
     order by e.created_at desc;
end;
$$;

-- Nueva invitación para dirigir una escuela; revoca las pendientes anteriores.
create function privado.admin_invitar(p_escuela uuid, p_email text, p_token_hash text, p_dias integer)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text;
  v_id    uuid;
begin
  perform privado.exigir_administrador();
  v_email := privado.validar_datos_invitacion(p_email, p_token_hash, p_dias);
  if not exists (select 1 from public.escuelas e where e.id = p_escuela) then
    raise exception 'Escuela no encontrada.' using errcode = 'P0002';
  end if;
  update public.invitaciones i
     set revocada_at = now()
   where i.escuela_id = p_escuela and i.aceptada_at is null and i.revocada_at is null;
  insert into public.invitaciones (escuela_id, email, token_hash, caduca_at, creada_por)
  values (p_escuela, v_email, p_token_hash, now() + make_interval(days => p_dias), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Escuela nueva y la invitación de su director, juntas.
create function privado.admin_crear_escuela(p_nombre text, p_email text, p_token_hash text, p_dias integer)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_nombre  text := btrim(coalesce(p_nombre, ''));
  v_escuela uuid;
begin
  perform privado.exigir_administrador();
  if char_length(v_nombre) not between 2 and 120 then
    raise exception 'El nombre de la escuela debe tener entre 2 y 120 caracteres.' using errcode = '22023';
  end if;
  perform privado.validar_datos_invitacion(p_email, p_token_hash, p_dias);
  insert into public.escuelas (nombre) values (v_nombre) returning id into v_escuela;
  perform privado.admin_invitar(v_escuela, p_email, p_token_hash, p_dias);
  return v_escuela;
end;
$$;

create function privado.admin_revocar_invitacion(p_invitacion uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform privado.exigir_administrador();
  update public.invitaciones i
     set revocada_at = now()
   where i.id = p_invitacion and i.aceptada_at is null and i.revocada_at is null;
  if not found then
    raise exception 'La invitación no existe o ya no está pendiente.' using errcode = 'P0002';
  end if;
end;
$$;

-- Suspender o reactivar el acceso de una escuela. No borra ni cambia sus datos.
create function privado.admin_cambiar_estado_escuela(p_escuela uuid, p_estado text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform privado.exigir_administrador();
  if p_estado is null or p_estado not in ('activa', 'suspendida') then
    raise exception 'Estado no válido.' using errcode = '22023';
  end if;
  update public.escuelas e
     set estado = p_estado, estado_cambiado_at = now()
   where e.id = p_escuela;
  if not found then
    raise exception 'Escuela no encontrada.' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------- funciones del invitado

-- Lo que puede ver quien tiene el enlace: estado, escuela y correo invitado.
-- Quien no tiene el token no puede consultar nada (hash de 256 bits).
create function privado.consultar_invitacion(p_token_hash text)
returns table (estado text, escuela_nombre text, email text, caduca timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return query select 'no_valida'::text, null::text, null::text, null::timestamptz;
    return;
  end if;
  return query
    select privado.estado_invitacion(i.aceptada_at, i.revocada_at, i.caduca_at), e.nombre, i.email, i.caduca_at
      from public.invitaciones i join public.escuelas e on e.id = i.escuela_id
     where i.token_hash = p_token_hash;
  if not found then
    return query select 'no_valida'::text, null::text, null::text, null::timestamptz;
  end if;
end;
$$;

-- Acepta la invitación con la cuenta actual: debe ser del MISMO correo. Crea
-- (o convierte en director) la membresía. Un solo uso: el mismo usuario puede
-- repetir la llamada (reintento) y recibe la misma escuela; otro, no.
create function privado.aceptar_invitacion(p_token_hash text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_inv     record;
  v_usuario uuid := auth.uid();
  v_email   text;
begin
  if v_usuario is null then
    raise exception 'INVITACION_SIN_SESION' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVITACION_NO_VALIDA' using errcode = 'P0002';
  end if;
  -- Bloquea la fila: dos aceptaciones simultáneas se atienden de una en una.
  select i.id, i.escuela_id, i.email, i.rol, i.caduca_at, i.aceptada_at, i.aceptada_por, i.revocada_at
    into v_inv
    from public.invitaciones i where i.token_hash = p_token_hash
   for update;
  if not found then
    raise exception 'INVITACION_NO_VALIDA' using errcode = 'P0002';
  end if;
  if v_inv.aceptada_at is not null then
    if v_inv.aceptada_por = v_usuario then
      return v_inv.escuela_id;  -- reintento del mismo usuario
    end if;
    raise exception 'INVITACION_USADA' using errcode = 'P0002';
  end if;
  if v_inv.revocada_at is not null then
    raise exception 'INVITACION_REVOCADA' using errcode = 'P0002';
  end if;
  if v_inv.caduca_at <= now() then
    raise exception 'INVITACION_CADUCADA' using errcode = 'P0002';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_usuario;
  if v_email is distinct from v_inv.email then
    raise exception 'INVITACION_OTRO_CORREO' using errcode = '42501';
  end if;

  insert into public.perfiles (id) values (v_usuario) on conflict (id) do nothing;
  insert into public.membresias (escuela_id, usuario_id, rol)
  values (v_inv.escuela_id, v_usuario, v_inv.rol)
  on conflict (escuela_id, usuario_id) do update set rol = excluded.rol;
  update public.invitaciones i set aceptada_at = now(), aceptada_por = v_usuario where i.id = v_inv.id;
  return v_inv.escuela_id;
end;
$$;

revoke all on function privado.admin_listar_escuelas()                              from public, anon;
revoke all on function privado.admin_invitar(uuid, text, text, integer)             from public, anon;
revoke all on function privado.admin_crear_escuela(text, text, text, integer)       from public, anon;
revoke all on function privado.admin_revocar_invitacion(uuid)                       from public, anon;
revoke all on function privado.admin_cambiar_estado_escuela(uuid, text)             from public, anon;
revoke all on function privado.consultar_invitacion(text)                           from public, anon;
revoke all on function privado.aceptar_invitacion(text)                             from public, anon;
-- Ejecutables por usuarios con sesión: cada una comprueba quién llama.
grant execute on function privado.admin_listar_escuelas()                        to authenticated;
grant execute on function privado.admin_invitar(uuid, text, text, integer)       to authenticated;
grant execute on function privado.admin_crear_escuela(text, text, text, integer) to authenticated;
grant execute on function privado.admin_revocar_invitacion(uuid)                 to authenticated;
grant execute on function privado.admin_cambiar_estado_escuela(uuid, text)       to authenticated;
grant execute on function privado.consultar_invitacion(text)                     to authenticated, service_role;
grant execute on function privado.aceptar_invitacion(text)                       to authenticated;

-- -------------------------------------------- envoltorios en public (INVOKER)

create function public.soy_administrador() returns boolean
language sql stable security invoker set search_path = ''
as $$ select privado.es_administrador(); $$;

create function public.admin_listar_escuelas()
returns table (
  escuela_id uuid, escuela_nombre text, escuela_estado text, alta timestamptz, estado_cambiado timestamptz,
  directores integer, miembros integer,
  invitacion_id uuid, invitacion_email text, invitacion_estado text, invitacion_creada timestamptz, invitacion_caduca timestamptz
)
language sql stable security invoker set search_path = ''
as $$ select * from privado.admin_listar_escuelas(); $$;

create function public.admin_crear_escuela(p_nombre text, p_email text, p_token_hash text, p_dias integer default 7)
returns uuid language sql security invoker set search_path = ''
as $$ select privado.admin_crear_escuela(p_nombre, p_email, p_token_hash, p_dias); $$;

create function public.admin_invitar(p_escuela uuid, p_email text, p_token_hash text, p_dias integer default 7)
returns uuid language sql security invoker set search_path = ''
as $$ select privado.admin_invitar(p_escuela, p_email, p_token_hash, p_dias); $$;

create function public.admin_revocar_invitacion(p_invitacion uuid)
returns void language sql security invoker set search_path = ''
as $$ select privado.admin_revocar_invitacion(p_invitacion); $$;

create function public.admin_cambiar_estado_escuela(p_escuela uuid, p_estado text)
returns void language sql security invoker set search_path = ''
as $$ select privado.admin_cambiar_estado_escuela(p_escuela, p_estado); $$;

create function public.consultar_invitacion(p_token_hash text)
returns table (estado text, escuela_nombre text, email text, caduca timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from privado.consultar_invitacion(p_token_hash); $$;

create function public.aceptar_invitacion(p_token_hash text)
returns uuid language sql security invoker set search_path = ''
as $$ select privado.aceptar_invitacion(p_token_hash); $$;

revoke all on function public.soy_administrador()                                 from public, anon;
revoke all on function public.admin_listar_escuelas()                             from public, anon;
revoke all on function public.admin_crear_escuela(text, text, text, integer)      from public, anon;
revoke all on function public.admin_invitar(uuid, text, text, integer)            from public, anon;
revoke all on function public.admin_revocar_invitacion(uuid)                      from public, anon;
revoke all on function public.admin_cambiar_estado_escuela(uuid, text)            from public, anon;
revoke all on function public.consultar_invitacion(text)                          from public, anon;
revoke all on function public.aceptar_invitacion(text)                            from public, anon;
grant execute on function public.soy_administrador()                              to authenticated;
grant execute on function public.admin_listar_escuelas()                          to authenticated;
grant execute on function public.admin_crear_escuela(text, text, text, integer)   to authenticated;
grant execute on function public.admin_invitar(uuid, text, text, integer)         to authenticated;
grant execute on function public.admin_revocar_invitacion(uuid)                   to authenticated;
grant execute on function public.admin_cambiar_estado_escuela(uuid, text)         to authenticated;
grant execute on function public.consultar_invitacion(text)                       to authenticated, service_role;
grant execute on function public.aceptar_invitacion(text)                         to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Suspensión: sin acceso operativo a los datos de una escuela suspendida
-- -----------------------------------------------------------------------------
-- Políticas RESTRICTIVE (se suman como «Y» a las existentes, que no cambian).
-- Siguen visibles para sus miembros la propia escuela (nombre y estado, para
-- mostrar el aviso), sus membresías y los perfiles. Nada se borra.

create policy suspension_jugadores on public.jugadores as restrictive for all to authenticated
  using ((select privado.escuela_activa(escuela_id))) with check ((select privado.escuela_activa(escuela_id)));
create policy suspension_grupos on public.grupos as restrictive for all to authenticated
  using ((select privado.escuela_activa(escuela_id))) with check ((select privado.escuela_activa(escuela_id)));
create policy suspension_grupo_jugadores on public.grupo_jugadores as restrictive for all to authenticated
  using ((select privado.escuela_activa(escuela_id))) with check ((select privado.escuela_activa(escuela_id)));
create policy suspension_competencias on public.competencias as restrictive for all to authenticated
  using ((select privado.escuela_activa(escuela_id))) with check ((select privado.escuela_activa(escuela_id)));
create policy suspension_evaluaciones on public.evaluaciones as restrictive for all to authenticated
  using ((select privado.escuela_activa(escuela_id))) with check ((select privado.escuela_activa(escuela_id)));
create policy suspension_evaluacion_puntuaciones on public.evaluacion_puntuaciones as restrictive for all to authenticated
  using ((select privado.escuela_activa(escuela_id))) with check ((select privado.escuela_activa(escuela_id)));
create policy suspension_evaluacion_objetivos on public.evaluacion_objetivos as restrictive for all to authenticated
  using ((select privado.escuela_activa(escuela_id))) with check ((select privado.escuela_activa(escuela_id)));
create policy suspension_metodologias on public.metodologias as restrictive for all to authenticated
  using ((select privado.escuela_activa(escuela_id))) with check ((select privado.escuela_activa(escuela_id)));
create policy suspension_evaluacion_redacciones on public.evaluacion_redacciones as restrictive for all to authenticated
  using ((select privado.escuela_activa(escuela_id))) with check ((select privado.escuela_activa(escuela_id)));
-- Una escuela suspendida tampoco cambia de nombre.
create policy suspension_escuelas_editar on public.escuelas as restrictive for update to authenticated
  using ((select privado.escuela_activa(id))) with check ((select privado.escuela_activa(id)));
