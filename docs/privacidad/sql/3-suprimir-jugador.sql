-- ÉVORA PADEL · Suprimir a UN jugador y todo lo suyo (ESCRITURA, irreversible).
--
-- Antes: 1-localizar-jugador.sql (comprobar que es la persona correcta) y, si
-- se ha pedido acceso o conviene guardar constancia, 2-exportar-jugador.sql.
-- Sustituir <ID_ESCUELA> y <ID_JUGADOR>. Ejecutar UNA vez en el SQL Editor.
--
-- Borra el jugador y, por las claves foráneas (on delete cascade), sus
-- asignaciones a grupos y sus evaluaciones con notas y objetivos.
-- Si no borra exactamente 1 jugador, se detiene y NO borra nada.

do $$
declare
  borrados int;
begin
  delete from public.jugadores
   where id = '<ID_JUGADOR>'
     and escuela_id = '<ID_ESCUELA>';
  get diagnostics borrados = row_count;
  if borrados <> 1 then
    raise exception 'Se esperaba suprimir 1 jugador y serían %. No se ha borrado nada.', borrados;
  end if;
  raise notice 'Jugador suprimido con sus evaluaciones.';
end
$$;
