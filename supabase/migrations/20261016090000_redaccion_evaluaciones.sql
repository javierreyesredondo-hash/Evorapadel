-- =============================================================================
-- ÉVORA PADEL · Migración 5: interpretación técnica e historial de la redacción
-- =============================================================================
-- Revisable y SIN APLICAR. Requiere las migraciones 1 a 4.
--
-- Qué añade:
--   * evaluaciones.interpretacion: interpretación técnica individual (texto
--     propuesto automáticamente por la app a partir de las puntuaciones y
--     revisado por el entrenador/a antes de guardar).
--   * public.evaluacion_redacciones: copia INMUTABLE de la redacción aprobada
--     en cada guardado (fortalezas, aspectos a mejorar, interpretación,
--     observaciones y objetivo), con la propuesta automática que se mostró. Si
--     después se edita la evaluación, las versiones anteriores se conservan: el
--     informe no cambia en silencio.
--   * public.guardar_evaluacion: mismos parámetros que antes y dos opcionales
--     al final (p_interpretacion, p_propuesta). Una llamada antigua sin ellos
--     sigue funcionando. Guarda la copia en la misma transacción.
--
-- No modifica ni rellena evaluaciones existentes (no tienen versiones hasta
-- que se vuelvan a guardar). Sin funciones SECURITY DEFINER nuevas.

-- -----------------------------------------------------------------------------
-- 1. Interpretación técnica
-- -----------------------------------------------------------------------------

alter table public.evaluaciones
  add column interpretacion text check (interpretacion is null or char_length(interpretacion) <= 2000);

grant insert (interpretacion) on public.evaluaciones to authenticated;
grant update (interpretacion) on public.evaluaciones to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Historial de la redacción aprobada (solo se añade; nunca se cambia)
-- -----------------------------------------------------------------------------

create table public.evaluacion_redacciones (
  id              uuid primary key default gen_random_uuid(),
  escuela_id      uuid not null,
  evaluacion_id   uuid not null,
  version         integer not null check (version >= 1),
  -- Copia de lo guardado en la evaluación en ese momento (la rellena el trigger).
  fortalezas      text check (fortalezas is null or char_length(fortalezas) <= 1500),
  mejoras         text check (mejoras is null or char_length(mejoras) <= 1500),
  interpretacion  text check (interpretacion is null or char_length(interpretacion) <= 2000),
  observaciones   text check (observaciones is null or char_length(observaciones) <= 3000),
  objetivo        text check (objetivo is null or char_length(objetivo) <= 200),
  -- Propuesta automática que vio el entrenador/a (null si no se usó):
  -- { version, fortalezas, mejoras, interpretacion, provisional }.
  propuesta       jsonb check (propuesta is null or (jsonb_typeof(propuesta) = 'object' and pg_column_size(propuesta) <= 12000)),
  autor_id        uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  unique (evaluacion_id, version),
  foreign key (escuela_id, evaluacion_id) references public.evaluaciones (escuela_id, id) on delete cascade
);
create index evaluacion_redacciones_evaluacion_idx on public.evaluacion_redacciones (escuela_id, evaluacion_id);
create index evaluacion_redacciones_autor_idx on public.evaluacion_redacciones (autor_id);
comment on table public.evaluacion_redacciones is
  'Versiones aprobadas de la redacción de cada evaluación (puede haber menores: datos personales, RGPD). Solo se añaden.';

-- El contenido de cada versión sale de la evaluación guardada, no del cliente:
-- quien inserta solo elige la evaluación y la propuesta mostrada. El número de
-- versión es el siguiente. SECURITY INVOKER: lee la evaluación con su RLS.
create function privado.preparar_redaccion()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  select e.fortalezas, e.mejoras, e.interpretacion, e.observaciones,
         (select o.descripcion from public.evaluacion_objetivos o
           where o.evaluacion_id = e.id order by o.orden limit 1)
    into new.fortalezas, new.mejoras, new.interpretacion, new.observaciones, new.objetivo
    from public.evaluaciones e
   where e.id = new.evaluacion_id and e.escuela_id = new.escuela_id;
  if not found then
    raise exception 'Evaluación no encontrada.' using errcode = 'P0002';
  end if;
  select coalesce(max(r.version), 0) + 1 into new.version
    from public.evaluacion_redacciones r where r.evaluacion_id = new.evaluacion_id;
  new.autor_id := auth.uid();
  new.created_at := now();
  return new;
end;
$$;

create trigger preparar_redaccion before insert on public.evaluacion_redacciones
  for each row execute function privado.preparar_redaccion();
revoke all on function privado.preparar_redaccion() from public, anon, authenticated;

revoke all on public.evaluacion_redacciones from anon, authenticated;
grant select on public.evaluacion_redacciones to authenticated;
grant insert (escuela_id, evaluacion_id, propuesta) on public.evaluacion_redacciones to authenticated;
grant all on public.evaluacion_redacciones to service_role;

alter table public.evaluacion_redacciones enable row level security;

create policy evaluacion_redacciones_leer on public.evaluacion_redacciones
  for select to authenticated
  using ((select privado.es_miembro(escuela_id)));

-- Solo quien puede editar la evaluación (la dirección o su autor) añade versiones.
-- Sin políticas de UPDATE ni DELETE: las versiones no se cambian ni se borran
-- (solo desaparecen con la evaluación, p. ej. al suprimir un jugador).
create policy evaluacion_redacciones_crear on public.evaluacion_redacciones
  for insert to authenticated
  with check ((select privado.puede_editar_evaluacion(evaluacion_id)));

-- -----------------------------------------------------------------------------
-- 3. guardar_evaluacion con interpretación y copia de la redacción
-- -----------------------------------------------------------------------------

drop function public.guardar_evaluacion(uuid, uuid, uuid, uuid, uuid, public.tipo_evaluacion, date, text, text, text, text, jsonb, jsonb);

create function public.guardar_evaluacion(
  p_escuela         uuid,
  p_id              uuid,
  p_clave_envio     uuid,
  p_jugador         uuid,
  p_grupo           uuid,
  p_tipo            public.tipo_evaluacion,
  p_fecha           date,
  p_titulo          text,
  p_fortalezas      text,
  p_mejoras         text,
  p_observaciones   text,
  p_puntuaciones    jsonb,
  p_objetivos       jsonb,
  p_interpretacion  text default null,
  p_propuesta       jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id        uuid;
  v_anteriores   uuid[] := '{}';
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
      (escuela_id, jugador_id, grupo_id, tipo, fecha, titulo, fortalezas, mejoras, observaciones, interpretacion, clave_envio)
    values
      (p_escuela, p_jugador, p_grupo, p_tipo, p_fecha, p_titulo, p_fortalezas, p_mejoras, p_observaciones, p_interpretacion, p_clave_envio)
    on conflict (escuela_id, clave_envio) do nothing
    returning id into v_id;

    if v_id is null then
      -- Reenvío del mismo formulario: se devuelve la evaluación ya creada, sin
      -- tocarla ni añadir otra versión de la redacción.
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
           fortalezas = p_fortalezas, mejoras = p_mejoras, observaciones = p_observaciones,
           interpretacion = p_interpretacion
     where e.id = p_id and e.escuela_id = p_escuela
    returning e.id into v_id;
    -- 0 filas: no existe, es de otra escuela o no se tiene permiso (mismo mensaje).
    if v_id is null then
      raise exception 'Evaluación no encontrada.' using errcode = 'P0002';
    end if;
    select coalesce(array_agg(p.competencia_id), '{}') into v_anteriores
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
        and (c.activa or c.id = any (v_anteriores))
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

  -- Copia de la redacción aprobada en este guardado (el trigger la rellena
  -- con lo que acaba de quedar guardado).
  insert into public.evaluacion_redacciones (escuela_id, evaluacion_id, propuesta)
  values (p_escuela, v_id, p_propuesta);

  return v_id;
end;
$$;

comment on function public.guardar_evaluacion(uuid, uuid, uuid, uuid, uuid, public.tipo_evaluacion, date, text, text, text, text, jsonb, jsonb, text, jsonb) is
  'Crea o edita una evaluación con sus notas, objetivos y una copia de la redacción en una transacción. SECURITY INVOKER: aplica la RLS del usuario.';

revoke all on function public.guardar_evaluacion(uuid, uuid, uuid, uuid, uuid, public.tipo_evaluacion, date, text, text, text, text, jsonb, jsonb, text, jsonb)
  from public, anon;
grant execute on function public.guardar_evaluacion(uuid, uuid, uuid, uuid, uuid, public.tipo_evaluacion, date, text, text, text, text, jsonb, jsonb, text, jsonb)
  to authenticated;
