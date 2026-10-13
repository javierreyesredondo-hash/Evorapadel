-- ÉVORA PADEL · Revisión periódica de conservación (SOLO LECTURA).
-- Lista los jugadores ARCHIVADOS sin cambios desde hace más de <MESES> meses:
-- candidatos a suprimir según la política de conservación (documento 4).
-- Sustituir <MESES> por el plazo decidido (número entero).

select e.nombre as escuela,
       j.id     as id_jugador,
       j.nombre as jugador,
       j.updated_at::date as archivado_o_modificado,
       (select count(*) from public.evaluaciones ev where ev.jugador_id = j.id) as evaluaciones
  from public.jugadores j
  join public.escuelas e on e.id = j.escuela_id
 where not j.activo
   and j.updated_at < now() - make_interval(months => <MESES>)
 order by j.updated_at;
