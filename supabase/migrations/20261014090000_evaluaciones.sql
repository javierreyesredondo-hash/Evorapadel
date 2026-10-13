-- =============================================================================
-- ÉVORA PADEL · Migración 3: metodología (competencias) y evaluaciones
-- =============================================================================
-- Añade:
--   * competencias: la metodología de cada escuela (criterios observables por
--     área). La define la dirección; no hay una lista fija en el código.
--   * evaluaciones: rápidas (en el entrenamiento, algunas competencias) o
--     completas (periódicas, todas las competencias activas). Jugador, grupo,
--     entrenador (autor), fecha, observaciones, fortalezas y áreas de mejora.
--   * evaluacion_puntuaciones: una nota entera de 1 a 5 por competencia.
--   * evaluacion_objetivos: objetivos de mejora con plazo opcional.
--   * public.guardar_evaluacion(): guarda evaluación + notas + objetivos en UNA
--     transacción (sin evaluaciones a medias) y evita duplicados por reenvío.
--
-- Mismos principios que la migración 1:
--   * Aislamiento entre escuelas con FK compuestas (escuela_id, id) y RLS.
--   * Permisos mínimos por columna; anon no recibe nada.
--   * Sin datos: no inserta competencias, evaluaciones ni datos personales.
--
-- Permisos (authenticated; service_role administra todo):
--   tabla                    leer       crear                editar                     borrar
--   competencias             miembros   director             director                   — (se desactivan)
--   evaluaciones             miembros   director/entrenador  autor (dir./entr.) o dir.  —
--   evaluacion_puntuaciones  miembros   quien puede editar la evaluación                (borrar = reemplazar)
--   evaluacion_objetivos     miembros   quien puede editar la evaluación                (borrar = reemplazar)
--
-- Revisión y ejecución: ver supabase/README.md. NO ejecutar sin revisar.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tipos
-- -----------------------------------------------------------------------------

create type public.area_competencia as enum ('tecnica', 'tactica', 'fisica', 'mental');
create type public.tipo_evaluacion as enum ('rapida', 'completa');


-- -----------------------------------------------------------------------------
-- 2. Tablas
-- -----------------------------------------------------------------------------

-- Metodología de la escuela: criterios observables que se puntúan de 1 a 5.
-- No se borran (las evaluaciones antiguas las referencian): se desactivan.
create table public.competencias (
  id           uuid primary key default gen_random_uuid(),
  escuela_id   uuid not null references public.escuelas (id) on delete cascade,
  nombre       text not null check (char_length(btrim(nombre)) between 2 and 80),
  area         public.area_competencia not null,
  descripcion  text check (descripcion is null or char_length(descripcion) <= 300),
  orden        smallint not null default 0 check (orden between 0 and 999),
  activa       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (escuela_id, id)
);
create unique index competencias_nombre_unico_por_escuela on public.competencias (escuela_id, lower(btrim(nombre)));
comment on table public.competencias is 'Metodología de cada escuela: competencias observables evaluadas de 1 a 5.';

-- Evaluación de un jugador. El autor (entrenador_id) es SIEMPRE quien la crea
-- (valor por defecto auth.uid(), columna no insertable por los clientes) y debe
-- ser miembro de la misma escuela. El grupo, si se indica, es de la misma
-- escuela y el jugador pertenece a él (trigger).
create table public.evaluaciones (
  id             uuid primary key default gen_random_uuid(),
  escuela_id     uuid not null references public.escuelas (id) on delete cascade,
  jugador_id     uuid not null,
  grupo_id       uuid,
  entrenador_id  uuid default auth.uid(),
  tipo           public.tipo_evaluacion not null,
  fecha          date not null check (fecha >= date '2000-01-01'),
  titulo         text check (titulo is null or char_length(btrim(titulo)) between 1 and 80),
  fortalezas     text check (fortalezas is null or char_length(fortalezas) <= 1500),
  mejoras        text check (mejoras is null or char_length(mejoras) <= 1500),
  observaciones  text check (observaciones is null or char_length(observaciones) <= 3000),
  -- Identificador del formulario enviado: el mismo envío repetido no duplica.
  clave_envio    uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (escuela_id, id),
  unique (escuela_id, clave_envio),
  foreign key (escuela_id, jugador_id) references public.jugadores (escuela_id, id) on delete cascade,
  foreign key (escuela_id, grupo_id) references public.grupos (escuela_id, id) on delete set null (grupo_id),
  foreign key (escuela_id, entrenador_id)
    references public.membresias (escuela_id, usuario_id)
    on delete set null (entrenador_id)
);
comment on table public.evaluaciones is 'Evaluaciones de jugadores (puede haber menores: datos personales, RGPD).';

-- Nota de 1 a 5 de una competencia en una evaluación.
create table public.evaluacion_puntuaciones (
  escuela_id      uuid not null,
  evaluacion_id   uuid not null,
  competencia_id  uuid not null,
  puntuacion      smallint not null check (puntuacion between 1 and 5),
  primary key (evaluacion_id, competencia_id),
  foreign key (escuela_id, evaluacion_id) references public.evaluaciones (escuela_id, id) on delete cascade,
  -- RESTRICT: una competencia ya usada no se puede borrar (se desactiva).
  foreign key (escuela_id, competencia_id) references public.competencias (escuela_id, id) on delete restrict
);
comment on table public.evaluacion_puntuaciones is 'Puntuaciones (1–5) por competencia de cada evaluación.';

-- Objetivos de mejora acordados en una evaluación (máximo 5, plazo opcional).
create table public.evaluacion_objetivos (
  id             uuid primary key default gen_random_uuid(),
  escuela_id     uuid not null,
  evaluacion_id  uuid not null,
  descripcion    text not null check (char_length(btrim(descripcion)) between 2 and 200),
  plazo          date,
  orden          smallint not null default 0 check (orden between 0 and 9),
  foreign key (escuela_id, evaluacion_id) references public.evaluaciones (escuela_id, id) on delete cascade
);
comment on table public.evaluacion_objetivos is 'Objetivos de mejora con plazo, ligados a una evaluación.';

-- Índices: toda FK cubierta (lo comprueban las pruebas). El de jugador sirve
-- además para el historial (por fecha, más recientes primero).
create index evaluaciones_jugador_idx        on public.evaluaciones (escuela_id, jugador_id, fecha desc, created_at desc);
create index evaluaciones_grupo_idx          on public.evaluaciones (escuela_id, grupo_id);
create index evaluaciones_entrenador_idx     on public.evaluaciones (escuela_id, entrenador_id);
create index evaluaciones_escuela_fecha_idx  on public.evaluaciones (escuela_id, fecha desc, created_at desc);
create index evaluacion_puntuaciones_eval_idx on public.evaluacion_puntuaciones (escuela_id, evaluacion_id);
create index evaluacion_puntuaciones_comp_idx on public.evaluacion_puntuaciones (escuela_id, competencia_id);
create index evaluacion_objetivos_eval_idx    on public.evaluacion_objetivos (escuela_id, evaluacion_id);


-- -----------------------------------------------------------------------------
-- 3. Funciones auxiliares y triggers
-- -----------------------------------------------------------------------------

-- ¿Puede el usuario actual modificar esta evaluación (y sus notas y objetivos)?
-- La dirección, siempre; un entrenador, solo las suyas y mientras sea miembro.
-- SECURITY DEFINER: lee la evaluación sin pasar por su RLS (evita recursión).
create function privado.puede_editar_evaluacion(p_evaluacion uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.evaluaciones e
    where e.id = p_evaluacion
      and (
        privado.tiene_rol(e.escuela_id, array['director']::public.rol_escuela[])
        or (e.entrenador_id = (select auth.uid())
            and privado.tiene_rol(e.escuela_id, array['director', 'entrenador']::public.rol_escuela[]))
      )
  );
$$;

-- El grupo de una evaluación debe ser uno al que pertenece el jugador (se
-- comprueba al crearla y cuando cambian el grupo o el jugador; si después el
-- jugador sale del grupo, la evaluación histórica se conserva tal cual).
-- SECURITY INVOKER a propósito: consulta grupo_jugadores con la RLS de quien
-- escribe. Así alguien de otra escuela recibe siempre el mismo error y no
-- puede deducir si un jugador está en un grupo ajeno.
create function privado.validar_grupo_evaluacion()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if new.grupo_id is not null
     and (tg_op = 'INSERT' or new.grupo_id is distinct from old.grupo_id or new.jugador_id is distinct from old.jugador_id)
     and not exists (
       select 1 from public.grupo_jugadores gj
       where gj.escuela_id = new.escuela_id and gj.grupo_id = new.grupo_id and gj.jugador_id = new.jugador_id)
  then
    raise exception 'El jugador no pertenece a ese grupo.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function privado.puede_editar_evaluacion(uuid)   from public, anon;
revoke all on function privado.validar_grupo_evaluacion()      from public, anon, authenticated;
grant execute on function privado.puede_editar_evaluacion(uuid) to authenticated;

create trigger tocar_updated_at before update on public.competencias
  for each row execute function privado.tocar_updated_at();
create trigger tocar_updated_at before update on public.evaluaciones
  for each row execute function privado.tocar_updated_at();
create trigger impedir_cambio_escuela before update on public.competencias
  for each row execute function privado.impedir_cambio_escuela();
create trigger impedir_cambio_escuela before update on public.evaluaciones
  for each row execute function privado.impedir_cambio_escuela();
create trigger validar_grupo before insert or update on public.evaluaciones
  for each row execute function privado.validar_grupo_evaluacion();


-- -----------------------------------------------------------------------------
-- 4. Permisos de tabla (mínimos, por columna)
-- -----------------------------------------------------------------------------
-- Nunca editables por clientes: id, escuela_id, jugador_id (de una evaluación
-- ya creada), entrenador_id, clave_envio, created_at y updated_at.

revoke all on public.competencias, public.evaluaciones,
              public.evaluacion_puntuaciones, public.evaluacion_objetivos
  from anon, authenticated;

grant select                    on public.competencias to authenticated;
grant insert (escuela_id, nombre, area, descripcion, orden, activa)
                                on public.competencias to authenticated;
grant update (nombre, area, descripcion, orden, activa)
                                on public.competencias to authenticated;

grant select                    on public.evaluaciones to authenticated;
grant insert (escuela_id, jugador_id, grupo_id, tipo, fecha, titulo, fortalezas, mejoras, observaciones, clave_envio)
                                on public.evaluaciones to authenticated;
grant update (grupo_id, tipo, fecha, titulo, fortalezas, mejoras, observaciones)
                                on public.evaluaciones to authenticated;

grant select, delete            on public.evaluacion_puntuaciones to authenticated;
grant insert (escuela_id, evaluacion_id, competencia_id, puntuacion)
                                on public.evaluacion_puntuaciones to authenticated;

grant select, delete            on public.evaluacion_objetivos to authenticated;
grant insert (escuela_id, evaluacion_id, descripcion, plazo, orden)
                                on public.evaluacion_objetivos to authenticated;

grant all on public.competencias, public.evaluaciones,
             public.evaluacion_puntuaciones, public.evaluacion_objetivos
  to service_role;


-- -----------------------------------------------------------------------------
-- 5. Row Level Security
-- -----------------------------------------------------------------------------

alter table public.competencias            enable row level security;
alter table public.evaluaciones            enable row level security;
alter table public.evaluacion_puntuaciones enable row level security;
alter table public.evaluacion_objetivos    enable row level security;

-- Competencias
create policy competencias_leer on public.competencias
  for select to authenticated
  using ((select privado.es_miembro(escuela_id)));

create policy competencias_crear_director on public.competencias
  for insert to authenticated
  with check ((select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[])));

create policy competencias_editar_director on public.competencias
  for update to authenticated
  using ((select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[])))
  with check ((select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[])));

-- Evaluaciones
create policy evaluaciones_leer on public.evaluaciones
  for select to authenticated
  using ((select privado.es_miembro(escuela_id)));

create policy evaluaciones_crear on public.evaluaciones
  for insert to authenticated
  with check (
    (select privado.tiene_rol(escuela_id, array['director', 'entrenador']::public.rol_escuela[]))
    and entrenador_id = (select auth.uid())
  );

create policy evaluaciones_editar on public.evaluaciones
  for update to authenticated
  using (
    (select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[]))
    or (entrenador_id = (select auth.uid())
        and (select privado.tiene_rol(escuela_id, array['director', 'entrenador']::public.rol_escuela[])))
  )
  with check (
    (select privado.tiene_rol(escuela_id, array['director']::public.rol_escuela[]))
    or (entrenador_id = (select auth.uid())
        and (select privado.tiene_rol(escuela_id, array['director', 'entrenador']::public.rol_escuela[])))
  );

-- Puntuaciones y objetivos: se leen como la evaluación y se modifican si se
-- puede editar la evaluación. La FK compuesta impide apuntar a otra escuela.
create policy evaluacion_puntuaciones_leer on public.evaluacion_puntuaciones
  for select to authenticated
  using ((select privado.es_miembro(escuela_id)));

create policy evaluacion_puntuaciones_crear on public.evaluacion_puntuaciones
  for insert to authenticated
  with check ((select privado.puede_editar_evaluacion(evaluacion_id)));

create policy evaluacion_puntuaciones_borrar on public.evaluacion_puntuaciones
  for delete to authenticated
  using ((select privado.puede_editar_evaluacion(evaluacion_id)));

create policy evaluacion_objetivos_leer on public.evaluacion_objetivos
  for select to authenticated
  using ((select privado.es_miembro(escuela_id)));

create policy evaluacion_objetivos_crear on public.evaluacion_objetivos
  for insert to authenticated
  with check ((select privado.puede_editar_evaluacion(evaluacion_id)));

create policy evaluacion_objetivos_borrar on public.evaluacion_objetivos
  for delete to authenticated
  using ((select privado.puede_editar_evaluacion(evaluacion_id)));


-- -----------------------------------------------------------------------------
-- 6. Guardado atómico: public.guardar_evaluacion
-- -----------------------------------------------------------------------------
-- SECURITY INVOKER: se ejecuta con los permisos y la RLS de quien la llama;
-- no concede nada que el usuario no pudiera hacer tabla a tabla. Solo aporta
-- atomicidad (todo o nada), validaciones y la protección contra duplicados.
--
--   p_id null  → crea (p_clave_envio obligatoria; repetirla devuelve la misma).
--   p_id       → edita: datos, y reemplaza notas y objetivos. El jugador de una
--                evaluación no cambia.
--   p_puntuaciones: [{"competencia": uuid, "puntuacion": 1..5}, …]  (≥ 1)
--   p_objetivos:    [{"descripcion": text, "plazo": "AAAA-MM-DD" | null}, …] (≤ 5)

create function public.guardar_evaluacion(
  p_escuela        uuid,
  p_id             uuid,
  p_clave_envio    uuid,
  p_jugador        uuid,
  p_grupo          uuid,
  p_tipo           public.tipo_evaluacion,
  p_fecha          date,
  p_titulo         text,
  p_fortalezas     text,
  p_mejoras        text,
  p_observaciones  text,
  p_puntuaciones   jsonb,
  p_objetivos      jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id        uuid;
  v_previas   uuid[] := '{}';
  v_nota      jsonb;
  v_objetivo  jsonb;
  v_orden     int := 0;
  v_plazo     date;
begin
  if p_escuela is null or p_tipo is null or p_fecha is null then
    raise exception 'Faltan datos de la evaluación.' using errcode = '22023';
  end if;
  -- Un día de margen por la diferencia horaria entre el usuario y el servidor.
  if p_fecha > current_date + 1 then
    raise exception 'La fecha de la evaluación no puede ser futura.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_puntuaciones) is distinct from 'array' or jsonb_array_length(p_puntuaciones) = 0 then
    raise exception 'La evaluación necesita al menos una puntuación.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_objetivos, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_objetivos, '[]'::jsonb)) > 5 then
    raise exception 'Como máximo 5 objetivos por evaluación.' using errcode = '22023';
  end if;

  if p_id is null then
    if p_clave_envio is null or p_jugador is null then
      raise exception 'Faltan datos de la evaluación.' using errcode = '22023';
    end if;
    insert into public.evaluaciones
      (escuela_id, jugador_id, grupo_id, tipo, fecha, titulo, fortalezas, mejoras, observaciones, clave_envio)
    values
      (p_escuela, p_jugador, p_grupo, p_tipo, p_fecha, p_titulo, p_fortalezas, p_mejoras, p_observaciones, p_clave_envio)
    on conflict (escuela_id, clave_envio) do nothing
    returning id into v_id;

    if v_id is null then
      -- Reenvío del mismo formulario: se devuelve la evaluación ya creada, sin tocarla.
      select e.id into v_id from public.evaluaciones e
      where e.escuela_id = p_escuela and e.clave_envio = p_clave_envio;
      if v_id is null then
        raise exception 'No se ha podido guardar la evaluación.' using errcode = '42501';
      end if;
      return v_id;
    end if;
  else
    update public.evaluaciones e
       set grupo_id = p_grupo, tipo = p_tipo, fecha = p_fecha, titulo = p_titulo,
           fortalezas = p_fortalezas, mejoras = p_mejoras, observaciones = p_observaciones
     where e.id = p_id and e.escuela_id = p_escuela
    returning e.id into v_id;
    -- 0 filas: no existe, es de otra escuela o no se tiene permiso (mismo mensaje).
    if v_id is null then
      raise exception 'Evaluación no encontrada.' using errcode = 'P0002';
    end if;
    select coalesce(array_agg(p.competencia_id), '{}') into v_previas
      from public.evaluacion_puntuaciones p where p.evaluacion_id = v_id;
    delete from public.evaluacion_puntuaciones p where p.evaluacion_id = v_id;
    delete from public.evaluacion_objetivos o where o.evaluacion_id = v_id;
  end if;

  for v_nota in select value from jsonb_array_elements(p_puntuaciones) loop
    -- Solo competencias activas de la escuela (al editar, también las que ya
    -- tenía la evaluación aunque después se hayan desactivado).
    if not exists (
      select 1 from public.competencias c
      where c.id = (v_nota ->> 'competencia')::uuid
        and c.escuela_id = p_escuela
        and (c.activa or c.id = any (v_previas))
    ) then
      raise exception 'Competencia no válida.' using errcode = '23503';
    end if;
    insert into public.evaluacion_puntuaciones (escuela_id, evaluacion_id, competencia_id, puntuacion)
    values (p_escuela, v_id, (v_nota ->> 'competencia')::uuid, (v_nota ->> 'puntuacion')::smallint);
  end loop;

  for v_objetivo in select value from jsonb_array_elements(coalesce(p_objetivos, '[]'::jsonb)) loop
    v_plazo := nullif(v_objetivo ->> 'plazo', '')::date;
    if v_plazo is not null and v_plazo < p_fecha then
      raise exception 'El plazo de un objetivo no puede ser anterior a la evaluación.' using errcode = '22023';
    end if;
    insert into public.evaluacion_objetivos (escuela_id, evaluacion_id, descripcion, plazo, orden)
    values (p_escuela, v_id, btrim(v_objetivo ->> 'descripcion'), v_plazo, v_orden);
    v_orden := v_orden + 1;
  end loop;

  return v_id;
end;
$$;

comment on function public.guardar_evaluacion(uuid, uuid, uuid, uuid, uuid, public.tipo_evaluacion, date, text, text, text, text, jsonb, jsonb) is
  'Crea o edita una evaluación con sus notas y objetivos en una transacción. SECURITY INVOKER: aplica la RLS del usuario.';

revoke all on function public.guardar_evaluacion(uuid, uuid, uuid, uuid, uuid, public.tipo_evaluacion, date, text, text, text, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.guardar_evaluacion(uuid, uuid, uuid, uuid, uuid, public.tipo_evaluacion, date, text, text, text, text, jsonb, jsonb)
  to authenticated;
