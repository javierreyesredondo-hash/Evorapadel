-- =============================================================================
-- SOLO PARA PRUEBAS LOCALES EN UN POSTGRESQL DESECHABLE.
-- NUNCA ejecutar en Supabase: allí estos roles, el esquema auth y auth.uid()
-- ya existen y los gestiona la plataforma.
-- =============================================================================
-- Reproduce lo mínimo de Supabase que necesita la migración:
--   * roles anon, authenticated, service_role (BYPASSRLS) y supabase_auth_admin
--   * esquema auth con auth.users y auth.uid() (lee el «sub» del JWT)
--   * los privilegios por defecto AMPLIOS que Supabase da en public, para
--     comprobar que la migración los recorta de verdad.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role supabase_auth_admin nologin;

create schema auth;
create table auth.users (
  id                  uuid primary key,
  email               text,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- Igual que en Supabase: el usuario sale del claim «sub» del JWT.
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant select, insert, delete on auth.users to supabase_auth_admin;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
