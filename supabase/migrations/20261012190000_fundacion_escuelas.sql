-- =============================================================================
-- ÉVORA PADEL · Migración 1: fundación multiescuela
-- =============================================================================
-- Crea escuelas, perfiles (vinculados a Supabase Auth), membresías con rol
-- (director / entrenador), jugadores, grupos y la relación jugador–grupo.
--
-- Principios:
--   * Aislamiento entre escuelas en dos capas:
--       1) Claves foráneas compuestas (escuela_id, id): la base de datos impide
--          relacionar filas de escuelas distintas aunque falle una política.
--       2) Row Level Security (RLS) en todas las tablas.
--   * Permisos mínimos: se revoca lo que Supabase concede por defecto a anon y
--     authenticated, y se concede solo lo necesario (por columnas en UPDATE).
--     anon no recibe ningún permiso.
--   * Nadie es administrador por defecto: los clientes NO pueden crear escuelas
--     ni membresías. Eso queda reservado a service_role (o al SQL Editor) hasta
--     que exista un flujo de invitación revisado en otra migración.
--   * Sin datos: esta migración no inserta escuelas, usuarios ni datos personales.
--
-- Requisitos: PostgreSQL 15+ (Supabase). Usa gen_random_uuid() (nativo) y
-- ON DELETE SET NULL (columna), disponible desde PostgreSQL 15.
-- Revisión y ejecución: ver supabase/README.md. NO ejecutar sin revisar.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Esquema privado para funciones auxiliares
-- -----------------------------------------------------------------------------
-- Supabase expone el esquema public por la API. Las funciones SECURITY DEFINER
-- van en un esquema NO expuesto para que no se puedan llamar por RPC.

create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 1. Tipos
-- -----------------------------------------------------------------------------

create type public.rol_escuela as enum ('director', 'entrenador');
create type public.nivel_jugador as enum ('iniciacion', 'intermedio', 'avanzado', 'competicion');
create type public.posicion_jugador as enum ('drive', 'reves');
create type public.mano_dominante as enum ('diestro', 'zurdo');


-- -----------------------------------------------------------------------------
-- 2. Tablas
-- -----------------------------------------------------------------------------

-- Escuelas (inquilinos). Cada fila de datos de la app pertenece a una.
create table public.escuelas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (char_length(btrim(nombre)) between 2 and 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.escuelas is 'Escuelas (inquilinos). Aisladas entre sí mediante FK compuestas y RLS.';

-- Perfiles: 1:1 con auth.users. Sin email ni datos sensibles (viven en auth).
create table public.perfiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  nombre_visible  text check (nombre_visible is null or char_length(btrim(nombre_visible)) between 1 and 120),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.perfiles is 'Perfil público mínimo de cada usuario de Supabase Auth. Se crea con un trigger.';

-- Membresías: qué usuario pertenece a qué escuela y con qué rol (uno por escuela).
create table public.membresias (
  id          uuid primary key default gen_random_uuid(),
  escuela_id  uuid not null references public.escuelas (id) on delete cascade,
  usuario_id  uuid not null references public.perfiles (id) on delete cascade,
  rol         public.rol_escuela not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (escuela_id, usuario_id)
);
comment on table public.membresias is 'Pertenencia de un usuario a una escuela con un rol. Solo service_role la modifica.';

-- Jugadores. Datos mínimos; ningún dato de contacto.
create table public.jugadores (
  id                uuid primary key default gen_random_uuid(),
  escuela_id        uuid not null references public.escuelas (id) on delete cascade,
  nombre            text not null check (char_length(btrim(nombre)) between 2 and 120),
  fecha_nacimiento  date check (fecha_nacimiento is null or fecha_nacimiento >= date '1900-01-01'),
  mano              public.mano_dominante,
  nivel             public.nivel_jugador,
  posicion          public.posicion_jugador,
  foco              text check (foco is null or char_length(foco) <= 200),
  activo            boolean not null default true,
  creado_por        uuid references public.perfiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Destino de las FK compuestas: permite exigir «misma escuela» en relaciones.
  unique (escuela_id, id)
);
comment on table public.jugadores is 'Jugadores de una escuela. Puede haber menores: tratar como datos personales (RGPD).';

-- Grupos de entrenamiento. El entrenador responsable, si lo hay, debe ser
-- miembro de la MISMA escuela (FK compuesta a membresias).
create table public.grupos (
  id             uuid primary key default gen_random_uuid(),
  escuela_id     uuid not null references public.escuelas (id) on delete cascade,
  nombre         text not null check (char_length(btrim(nombre)) between 1 and 80),
  entrenador_id  uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (escuela_id, id),
  foreign key (escuela_id, entrenador_id)
    references public.membresias (escuela_id, usuario_id)
    on delete set null (entrenador_id)
);
create unique index grupos_nombre_unico_por_escuela on public.grupos (escuela_id, lower(btrim(nombre)));
comment on table public.grupos is 'Grupos de entrenamiento de una escuela.';

-- Jugador ↔ grupo. Las dos FK compuestas obligan a que grupo y jugador sean
-- de la misma escuela que la fila.
create table public.grupo_jugadores (
  escuela_id  uuid not null,
  grupo_id    uuid not null,
  jugador_id  uuid not null,
  created_at  timestamptz not null default now(),
  primary key (grupo_id, jugador_id),
  foreign key (escuela_id, grupo_id)   references public.grupos (escuela_id, id)    on delete cascade,
  foreign key (escuela_id, jugador_id) references public.jugadores (escuela_id, id) on delete cascade
);
comment on table public.grupo_jugadores is 'Asignación de jugadores a grupos dentro de una misma escuela.';

-- Índices para las FK y los filtros de las políticas.
create index membresias_usuario_idx       on public.membresias (usuario_id);
create index jugadores_escuela_idx        on public.jugadores (escuela_id);
create index jugadores_creado_por_idx     on public.jugadores (creado_por);
create index grupos_escuela_entrenador_idx on public.grupos (escuela_id, entrenador_id);
create index grupo_jugadores_jugador_idx  on public.grupo_jugadores (escuela_id, jugador_id);


-- -----------------------------------------------------------------------------
-- 3. Funciones auxiliares (esquema privado)
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER + search_path vacío: leen membresias sin pasar por su RLS
-- (evita recursión en las políticas) y no se ven afectadas por objetos que un
-- usuario pudiera crear en otros esquemas.

create function privado.es_miembro(p_escuela uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membresias m
    where m.escuela_id = p_escuela
      and m.usuario_id = (select auth.uid())
  );
$$;

create function privado.tiene_rol(p_escuela uuid, p_roles public.rol_escuela[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membresias m
    where m.escuela_id = p_escuela
      and m.usuario_id = (select auth.uid())
      and m.rol = any (p_roles)
  );
$$;

-- ¿El usuario actual comparte alguna escuela con p_usuario?
create function privado.comparte_escuela(p_usuario uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.membresias yo
    join public.membresias otro on otro.escuela_id = yo.escuela_id
    where yo.usuario_id = (select auth.uid())
      and otro.usuario_id = p_usuario
  );
$$;

-- Mantiene updated_at al día.
create function privado.tocar_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Ningún cliente puede cambiar una fila de escuela ni su marca de creación.
-- (Además no se les concede UPDATE sobre esas columnas; esto es una red extra
-- que también protege frente a errores en funciones futuras.)
create function privado.impedir_cambio_escuela()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.escuela_id is distinct from old.escuela_id then
    raise exception 'No se puede cambiar la escuela de un registro' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Crea el perfil vacío al registrarse un usuario en Supabase Auth.
-- No copia email ni metadatos: el nombre visible lo rellena el propio usuario.
create function privado.crear_perfil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

-- Solo lo necesario: nadie ejecuta estas funciones salvo quien las necesita.
revoke all on function privado.es_miembro(uuid)                         from public, anon;
revoke all on function privado.tiene_rol(uuid, public.rol_escuela[])     from public, anon;
revoke all on function privado.comparte_escuela(uuid)                    from public, anon;
revoke all on function privado.tocar_updated_at()                        from public, anon, authenticated;
revoke all on function privado.impedir_cambio_escuela()                  from public, anon, authenticated;
revoke all on function privado.crear_perfil()                            from public, anon, authenticated;
grant execute on function privado.es_miembro(uuid)                     to authenticated;
grant execute on function privado.tiene_rol(uuid, public.rol_escuela[]) to authenticated;
grant execute on function privado.comparte_escuela(uuid)                to authenticated;


-- -----------------------------------------------------------------------------
-- 4. Triggers
-- -----------------------------------------------------------------------------

create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function privado.crear_perfil();

create trigger tocar_updated_at before update on public.escuelas
  for each row execute function privado.tocar_updated_at();
create trigger tocar_updated_at before update on public.perfiles
  for each row execute function privado.tocar_updated_at();
create trigger tocar_updated_at before update on public.membresias
  for each row execute function privado.tocar_updated_at();
create trigger tocar_updated_at before update on public.jugadores
  for each row execute function privado.tocar_updated_at();
create trigger tocar_updated_at before update on public.grupos
  for each row execute function privado.tocar_updated_at();

create trigger impedir_cambio_escuela before update on public.membresias
  for each row execute function privado.impedir_cambio_escuela();
create trigger impedir_cambio_escuela before update on public.jugadores
  for each row execute function privado.impedir_cambio_escuela();
create trigger impedir_cambio_escuela before update on public.grupos
  for each row execute function privado.impedir_cambio_escuela();


-- -----------------------------------------------------------------------------
-- 5. Permisos de tabla (mínimos)
-- -----------------------------------------------------------------------------
-- Supabase concede por defecto ALL a anon y authenticated en tablas nuevas de
-- public. Se retira todo y se concede solo lo imprescindible. Las columnas
-- id, escuela_id, created_at, updated_at y creado_por nunca son editables.

revoke all on public.escuelas, public.perfiles, public.membresias,
              public.jugadores, public.grupos, public.grupo_jugadores
  from anon, authenticated;

grant select                    on public.escuelas        to authenticated;
grant update (nombre)           on public.escuelas        to authenticated;

grant select                    on public.perfiles        to authenticated;
grant update (nombre_visible)   on public.perfiles        to authenticated;

grant select                    on public.membresias      to authenticated;

grant select, delete            on public.jugadores       to authenticated;
grant insert (escuela_id, nombre, fecha_nacimiento, mano, nivel, posicion, foco, activo)
                                on public.jugadores       to authenticated;
grant update (nombre, fecha_nacimiento, mano, nivel, posicion, foco, activo)
                                on public.jugadores       to authenticated;

grant select, delete            on public.grupos          to authenticated;
grant insert (escuela_id, nombre, entrenador_id)
                                on public.grupos          to authenticated;
grant update (nombre, entrenador_id)
                                on public.grupos          to authenticated;

grant select, delete            on public.grupo_jugadores to authenticated;
grant insert (escuela_id, grupo_id, jugador_id)
                                on public.grupo_jugadores to authenticated;

-- service_role (solo servidor, nunca en el navegador) administra todo.
grant all on public.escuelas, public.perfiles, public.membresias,
             public.jugadores, public.grupos, public.grupo_jugadores
  to service_role;


-- -----------------------------------------------------------------------------
-- 6. Row Level Security
-- -----------------------------------------------------------------------------
-- Sin política = sin acceso. Las políticas son solo para authenticated.
--
--   tabla            leer                        crear              editar             borrar
--   escuelas         miembros                    —                  director           —
--   perfiles         uno mismo + compañeros      (trigger)          uno mismo          —
--   membresias       miembros de la escuela      —                  —                  —
--   jugadores        miembros                    director/entren.   director/entren.   director
--   grupos           miembros                    director           director           director
--   grupo_jugadores  miembros                    director/entren.   —                  director/entren.

alter table public.escuelas        enable row level security;
alter table public.perfiles        enable row level security;
alter table public.membresias      enable row level security;
alter table public.jugadores       enable row level security;
alter table public.grupos          enable row level security;
alter table public.grupo_jugadores enable row level security;

-- Escuelas
create policy escuelas_leer on public.escuelas
  for select to authenticated
  using ((select privado.es_miembro(id)));

create policy escuelas_editar_director on public.escuelas
  for update to authenticated
  using ((select privado.tiene_rol(id, array['director']::public.rol_escuela[])))
  with check ((select privado.tiene_rol(id, array['director']::public.rol_escuela[])));

-- Perfiles
create policy perfiles_leer on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or (select privado.comparte_escuela(id)));

create policy perfiles_editar_propio on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Membresías (solo lectura para clientes)
create policy membresias_leer on public.membresias
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select privado.es_miembro(escuela_id)));

-- Jugadores
create policy jugadores_leer on public.jugadores
  for select to authenticated
  using ((select privado.es_miembro(escuela_id)));

create policy jugadores_crear on public.jugadores
  for insert to authenticated
  with check ((select privado.tiene_rol(escuela_id, array['director', 'entrenador']::public.rol_escuela[])));

create policy jugadores_editar on public.jugadores
  for update to authenticated
  using ((select privado.tiene_rol(escuela_id, array['director', 'entrenador']::public.rol_escuela[])))
  with check ((select privado.tiene_rol(escuela_id, array['director', 'entrenador']::public.rol_escuela[])));

create policy jugadores_borrar_director on public.jugadores
  for delete to authenticated
  using ((select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[])));

-- Grupos
create policy grupos_leer on public.grupos
  for select to authenticated
  using ((select privado.es_miembro(escuela_id)));

create policy grupos_crear_director on public.grupos
  for insert to authenticated
  with check ((select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[])));

create policy grupos_editar_director on public.grupos
  for update to authenticated
  using ((select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[])))
  with check ((select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[])));

create policy grupos_borrar_director on public.grupos
  for delete to authenticated
  using ((select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[])));

-- Jugador ↔ grupo
create policy grupo_jugadores_leer on public.grupo_jugadores
  for select to authenticated
  using ((select privado.es_miembro(escuela_id)));

create policy grupo_jugadores_crear on public.grupo_jugadores
  for insert to authenticated
  with check ((select privado.tiene_rol(escuela_id, array['director', 'entrenador']::public.rol_escuela[])));

create policy grupo_jugadores_borrar on public.grupo_jugadores
  for delete to authenticated
  using ((select privado.tiene_rol(escuela_id, array['director', 'entrenador']::public.rol_escuela[])));
