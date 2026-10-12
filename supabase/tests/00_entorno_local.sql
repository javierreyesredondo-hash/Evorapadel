-- =============================================================================
-- SOLO PARA PRUEBAS LOCALES EN UN POSTGRESQL DESECHABLE.
-- NUNCA ejecutar en Supabase: allí estos roles, el esquema auth y auth.uid()
-- ya existen y los gestiona la plataforma.
-- =============================================================================
-- Se ejecuta como superusuario «supabase_admin» y reproduce lo que importa de
-- la imagen oficial supabase/postgres (comprobado en 15.19.0.004):
--   * «postgres» NO es superusuario: BYPASSRLS, CREATEROLE, CREATEDB y miembro
--     de anon, authenticated y service_role. La migración se aplica con él,
--     como hace la CLI de Supabase.
--   * auth.users pertenece a supabase_auth_admin; postgres tiene sobre ella
--     todos los privilegios de tabla (incluidos REFERENCES y TRIGGER).
--   * auth.uid() lee el «sub» del JWT.
--   * Privilegios por defecto AMPLIOS en public para anon/authenticated/
--     service_role, para comprobar que la migración los recorta de verdad.

create role postgres login nosuperuser createrole createdb bypassrls;
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role supabase_auth_admin nologin noinherit createrole;
grant anon, authenticated, service_role to postgres;

-- public pertenece al dueño de la base de datos (postgres) en Supabase.
alter database postgres owner to postgres;
alter schema public owner to pg_database_owner;
grant usage on schema public to postgres, anon, authenticated, service_role;

create schema auth authorization supabase_admin;
grant usage on schema auth to postgres, anon, authenticated, service_role;
grant usage, create on schema auth to supabase_auth_admin;

create table auth.users (
  id                  uuid primary key,
  email               text,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);
alter table auth.users owner to supabase_auth_admin;
grant all on auth.users to postgres;

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
alter function auth.uid() owner to supabase_auth_admin;

alter default privileges for role postgres in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
