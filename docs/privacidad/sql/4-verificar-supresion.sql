-- ÉVORA PADEL · Comprobar que no queda nada del jugador (SOLO LECTURA).
-- Sustituir <ID_JUGADOR>. Todos los recuentos deben ser 0.

select
  (select count(*) from public.jugadores       where id = '<ID_JUGADOR>')         as jugador,
  (select count(*) from public.grupo_jugadores where jugador_id = '<ID_JUGADOR>') as en_grupos,
  (select count(*) from public.evaluaciones    where jugador_id = '<ID_JUGADOR>') as evaluaciones;
