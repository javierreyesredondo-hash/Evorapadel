-- =============================================================================
-- ÉVORA PADEL · Migración 4: metodologías importadas (desde PDF) y versiones
-- =============================================================================
-- Revisable y SIN APLICAR. Requiere las migraciones 1, 2 y 3.
--
-- Qué añade:
--   * public.metodologias: metodologías propias de cada escuela, con versión,
--     estado (borrador → activa → archivada), el contenido REVISADO por la
--     dirección (fases, escala, competencias, fichas… en JSON) y una REFERENCIA
--     al PDF de origen (nombre, tamaño, páginas y huella SHA-256). El PDF no se
--     guarda: no hay archivos ni enlaces que proteger.
--   * competencias.metodologia_id y competencias.grupo: las competencias que
--     aporta una metodología conservan su categoría original (p. ej. «Toma de
--     decisiones»). area pasa a ser opcional (o área o grupo).
--   * evaluaciones.metodologia_id: la metodología activa al crear la evaluación
--     (la fija un trigger; el cliente no la elige). El historial conserva así su
--     versión, escala y competencias aunque después se active otra.
--
-- Reglas (en la base de datos, no solo en la interfaz):
--   * Solo la dirección crea, edita y activa metodologías; los miembros las leen.
--   * Se crean siempre como borrador. Activada o archivada, una metodología ya
--     no cambia de contenido: una corrección es una versión nueva.
--   * Una sola activa por escuela. Activar archiva la anterior, desactiva las
--     competencias que no son de la nueva (sin borrarlas) y crea o reactiva las
--     de la nueva. Las evaluaciones antiguas no se tocan.
--   * Sin borrado: ni metodologías ni competencias se pueden borrar.
--   * Duplicados: mismo PDF (huella) o mismo nombre + versión en una escuela.
--
-- Todas las funciones nuevas son SECURITY INVOKER: actúan con los permisos y
-- la RLS de quien escribe.

-- -----------------------------------------------------------------------------
-- 1. Tipos y tabla
-- -----------------------------------------------------------------------------

create type public.estado_metodologia as enum ('borrador', 'activa', 'archivada');

create table public.metodologias (
  id                 uuid primary key default gen_random_uuid(),
  escuela_id         uuid not null references public.escuelas (id) on delete cascade,
  nombre             text not null check (char_length(btrim(nombre)) between 2 and 120),
  version            text not null check (char_length(btrim(version)) between 1 and 20),
  descripcion        text check (descripcion is null or char_length(descripcion) <= 2000),
  estado             public.estado_metodologia not null default 'borrador',
  -- Contenido revisado: { fases, principios, escala, competencias, fichas, … }.
  contenido          jsonb not null check (jsonb_typeof(contenido) = 'object' and pg_column_size(contenido) <= 400000),
  documento_nombre   text check (documento_nombre is null or char_length(documento_nombre) <= 200),
  documento_sha256   text check (documento_sha256 is null or documento_sha256 ~ '^[0-9a-f]{64}$'),
  documento_bytes    integer check (documento_bytes is null or documento_bytes > 0),
  documento_paginas  integer check (documento_paginas is null or documento_paginas > 0),
  creado_por         uuid default auth.uid() references public.perfiles (id) on delete set null,
  activada_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (escuela_id, id)
);
create unique index metodologias_version_unica on public.metodologias (escuela_id, lower(btrim(nombre)), lower(btrim(version)));
create unique index metodologias_documento_unico on public.metodologias (escuela_id, documento_sha256) where documento_sha256 is not null;
create unique index metodologias_una_activa on public.metodologias (escuela_id) where estado = 'activa';
create index metodologias_creado_por_idx on public.metodologias (creado_por);
comment on table public.metodologias is 'Metodologías propias de cada escuela (importadas desde PDF y revisadas), con versión y estado.';

-- -----------------------------------------------------------------------------
-- 2. Competencias y evaluaciones: enlace con la metodología
-- -----------------------------------------------------------------------------

alter table public.competencias
  add column metodologia_id uuid,
  add column grupo text check (grupo is null or char_length(btrim(grupo)) between 1 and 80),
  alter column area drop not null,
  add constraint competencias_area_o_grupo check (area is not null or grupo is not null),
  add constraint competencias_metodologia_fk foreign key (escuela_id, metodologia_id)
    references public.metodologias (escuela_id, id) on delete restrict;
create index competencias_metodologia_idx on public.competencias (escuela_id, metodologia_id);

-- El nombre es único dentro de su metodología y grupo (p. ej. «Globo» en Técnica
-- y en Defensa). Para las competencias propias (sin metodología ni grupo) la
-- regla es la misma que antes: único por escuela.
drop index public.competencias_nombre_unico_por_escuela;
create unique index competencias_nombre_unico_por_escuela on public.competencias (
  escuela_id,
  coalesce(metodologia_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(btrim(coalesce(grupo, ''))),
  lower(btrim(nombre))
);

alter table public.evaluaciones
  add column metodologia_id uuid,
  add constraint evaluaciones_metodologia_fk foreign key (escuela_id, metodologia_id)
    references public.metodologias (escuela_id, id) on delete restrict;
create index evaluaciones_metodologia_idx on public.evaluaciones (escuela_id, metodologia_id);

-- -----------------------------------------------------------------------------
-- 3. Funciones y triggers (SECURITY INVOKER, search_path vacío)
-- -----------------------------------------------------------------------------

-- Ciclo de vida: se crea en borrador; el contenido solo cambia en borrador;
-- nunca se vuelve a borrador. Al activar: exige alguna competencia evaluable y
-- archiva la que estuviera activa (antes de escribir, por el índice único).
create function privado.validar_metodologia()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  evaluables int;
begin
  if tg_op = 'INSERT' then
    if new.estado <> 'borrador' then
      raise exception 'Una metodología se crea como borrador.' using errcode = '22023';
    end if;
    new.activada_at := null;
    return new;
  end if;

  if old.estado <> 'borrador' and (
       new.contenido is distinct from old.contenido or new.nombre is distinct from old.nombre
       or new.version is distinct from old.version or new.descripcion is distinct from old.descripcion) then
    raise exception 'Una metodología activada o archivada no se modifica: importa una versión nueva.' using errcode = '22023';
  end if;
  if new.estado = 'borrador' and old.estado <> 'borrador' then
    raise exception 'Una metodología activada o archivada no vuelve a borrador.' using errcode = '22023';
  end if;

  if new.estado = 'activa' and old.estado <> 'activa' then
    select count(*) into evaluables
      from jsonb_array_elements(coalesce(new.contenido -> 'competencias', '[]'::jsonb)) c
     where (c ->> 'evaluable')::boolean is true;
    if evaluables = 0 then
      raise exception 'La metodología no tiene competencias evaluables.' using errcode = '22023';
    end if;
    update public.metodologias m
       set estado = 'archivada'
     where m.escuela_id = new.escuela_id and m.estado = 'activa' and m.id <> new.id;
    new.activada_at := now();
  end if;
  return new;
end;
$$;

-- Tras activar: las competencias de la escuela pasan a ser las de esta
-- metodología. Las demás se desactivan (no se borran: las evaluaciones
-- antiguas las siguen usando). Si ya se activó antes, se reactivan las suyas.
create function privado.activar_competencias_metodologia()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  update public.competencias c
     set activa = false
   where c.escuela_id = new.escuela_id and c.activa
     and c.metodologia_id is distinct from new.id;

  update public.competencias c
     set activa = true
   where c.escuela_id = new.escuela_id and c.metodologia_id = new.id;

  if not found then
    insert into public.competencias (escuela_id, metodologia_id, grupo, nombre, descripcion, orden, activa)
    select new.escuela_id, new.id,
           nullif(btrim(c ->> 'grupo'), ''),
           btrim(c ->> 'nombre'),
           nullif(btrim(c ->> 'descripcion'), ''),
           least(n - 1, 999)::smallint,
           true
      from jsonb_array_elements(new.contenido -> 'competencias') with ordinality as t (c, n)
     where (c ->> 'evaluable')::boolean is true;
  end if;
  return null;
end;
$$;

-- Las competencias que aporta una metodología no se editan (solo se activan o
-- desactivan): su nombre, grupo y descripción son los de esa versión.
create function privado.proteger_competencia_metodologia()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if old.metodologia_id is not null and (
       new.nombre is distinct from old.nombre or new.grupo is distinct from old.grupo
       or new.descripcion is distinct from old.descripcion or new.area is distinct from old.area
       or new.orden is distinct from old.orden or new.metodologia_id is distinct from old.metodologia_id) then
    raise exception 'Las competencias de una metodología importada no se editan: importa una versión nueva.' using errcode = '22023';
  end if;
  if old.metodologia_id is null and new.metodologia_id is not null then
    raise exception 'Una competencia propia no pasa a una metodología.' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- La evaluación queda ligada a la metodología activa cuando se crea.
create function privado.fijar_metodologia_evaluacion()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.metodologia_id := (
      select m.id from public.metodologias m
       where m.escuela_id = new.escuela_id and m.estado = 'activa');
  else
    new.metodologia_id := old.metodologia_id;
  end if;
  return new;
end;
$$;

create trigger tocar_updated_at before update on public.metodologias
  for each row execute function privado.tocar_updated_at();
create trigger impedir_cambio_escuela before update on public.metodologias
  for each row execute function privado.impedir_cambio_escuela();
create trigger validar_metodologia before insert or update on public.metodologias
  for each row execute function privado.validar_metodologia();
create trigger activar_competencias after update of estado on public.metodologias
  for each row when (new.estado = 'activa' and old.estado <> 'activa')
  execute function privado.activar_competencias_metodologia();
create trigger proteger_competencia_metodologia before update on public.competencias
  for each row execute function privado.proteger_competencia_metodologia();
create trigger fijar_metodologia before insert or update on public.evaluaciones
  for each row execute function privado.fijar_metodologia_evaluacion();

revoke all on function privado.validar_metodologia()               from public, anon, authenticated;
revoke all on function privado.activar_competencias_metodologia()  from public, anon, authenticated;
revoke all on function privado.proteger_competencia_metodologia()  from public, anon, authenticated;
revoke all on function privado.fijar_metodologia_evaluacion()      from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Permisos (mínimos, por columna) y RLS
-- -----------------------------------------------------------------------------

revoke all on public.metodologias from anon, authenticated;
grant select on public.metodologias to authenticated;
grant insert (escuela_id, nombre, version, descripcion, contenido,
              documento_nombre, documento_sha256, documento_bytes, documento_paginas)
  on public.metodologias to authenticated;
grant update (nombre, version, descripcion, contenido, estado) on public.metodologias to authenticated;
grant all on public.metodologias to service_role;

-- Al activar, el trigger (con los permisos de la dirección) crea las competencias.
grant insert (metodologia_id, grupo) on public.competencias to authenticated;

alter table public.metodologias enable row level security;

create policy metodologias_leer on public.metodologias
  for select to authenticated
  using ((select privado.es_miembro(escuela_id)));

create policy metodologias_crear_director on public.metodologias
  for insert to authenticated
  with check ((select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[])));

create policy metodologias_editar_director on public.metodologias
  for update to authenticated
  using ((select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[])))
  with check ((select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[])));
