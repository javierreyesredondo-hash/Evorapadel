-- ÉVORA PADEL · Copia de los datos de un jugador (SOLO LECTURA).
-- Para atender el derecho de acceso (o portabilidad) y antes de una supresión.
-- Sustituir <ID_ESCUELA> y <ID_JUGADOR> (de 1-localizar-jugador.sql).
-- Devuelve un único JSON con el jugador, sus grupos y todas sus evaluaciones.

select jsonb_pretty(jsonb_build_object(
  'jugador', jsonb_build_object(
    'nombre', j.nombre, 'fecha_nacimiento', j.fecha_nacimiento, 'mano', j.mano,
    'nivel', j.nivel, 'posicion', j.posicion, 'foco', j.foco, 'activo', j.activo,
    'alta', j.created_at, 'ultima_modificacion', j.updated_at),
  'grupos', (
    select coalesce(jsonb_agg(g.nombre order by g.nombre), '[]'::jsonb)
      from public.grupo_jugadores gj
      join public.grupos g on g.id = gj.grupo_id
     where gj.jugador_id = j.id),
  'evaluaciones', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'fecha', ev.fecha, 'tipo', ev.tipo, 'titulo', ev.titulo,
             'fortalezas', ev.fortalezas, 'areas_de_mejora', ev.mejoras,
             'observaciones', ev.observaciones,
             'puntuaciones', (
               select coalesce(jsonb_agg(jsonb_build_object('competencia', c.nombre, 'puntuacion', p.puntuacion)
                                         order by c.orden, c.nombre), '[]'::jsonb)
                 from public.evaluacion_puntuaciones p
                 join public.competencias c on c.id = p.competencia_id
                where p.evaluacion_id = ev.id),
             'objetivos', (
               select coalesce(jsonb_agg(jsonb_build_object('objetivo', o.descripcion, 'plazo', o.plazo)
                                         order by o.orden), '[]'::jsonb)
                 from public.evaluacion_objetivos o
                where o.evaluacion_id = ev.id))
           order by ev.fecha, ev.created_at), '[]'::jsonb)
      from public.evaluaciones ev
     where ev.jugador_id = j.id)
)) as datos
  from public.jugadores j
 where j.id = '<ID_JUGADOR>'
   and j.escuela_id = '<ID_ESCUELA>';
