-- ÉVORA PADEL · Localizar a un jugador (SOLO LECTURA).
-- Uso: SQL Editor de Supabase. Sustituir <NOMBRE> por parte del nombre.
-- Devuelve el id de la escuela y del jugador, y cuántas evaluaciones tiene.

select e.nombre as escuela,
       e.id     as id_escuela,
       j.id     as id_jugador,
       j.nombre as jugador,
       j.activo,
       j.created_at::date as alta,
       (select count(*) from public.evaluaciones ev where ev.jugador_id = j.id) as evaluaciones
  from public.jugadores j
  join public.escuelas e on e.id = j.escuela_id
 where j.nombre ilike '%<NOMBRE>%'
 order by e.nombre, j.nombre;
