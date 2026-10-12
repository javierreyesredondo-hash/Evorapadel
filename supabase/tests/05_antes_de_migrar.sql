-- =============================================================================
-- SOLO PARA PRUEBAS LOCALES. Se ejecuta ANTES de aplicar las migraciones.
-- Simula un usuario que se registró en Supabase Auth antes de que existieran
-- las tablas de la app (caso habitual del primer director). Identificador y
-- email sintéticos (dominio reservado .invalid).
-- =============================================================================
set role supabase_auth_admin;
insert into auth.users (id, email, raw_user_meta_data)
values ('00000c01-0000-4000-8000-000000000000', 'previo@ejemplo.invalid', '{}');
reset role;
