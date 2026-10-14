// Evaluación en cadena de un grupo (lógica pura, sin React ni Supabase):
// quién está evaluado hoy, quién falta y quién va después.

export type JugadorCadena = { id: string; nombre: string };
export type EvaluacionHoy = { id: string; jugadorId: string; entrenadorId: string | null; numeroNotas: number };

export type EstadoCadena = {
  jugadores: (JugadorCadena & { evaluacion: EvaluacionHoy | null })[];
  evaluados: number;
  total: number;
  completado: boolean;
};

/** Estado de la cadena: cada jugador con su evaluación de hoy en este grupo (si la hay). */
export function estadoCadena(jugadores: readonly JugadorCadena[], evaluaciones: readonly EvaluacionHoy[]): EstadoCadena {
  // Si hubiera varias del mismo día (p. ej. hechas fuera de la cadena), cuenta la primera.
  const porJugador = new Map<string, EvaluacionHoy>();
  for (const e of evaluaciones) if (!porJugador.has(e.jugadorId)) porJugador.set(e.jugadorId, e);
  const lista = jugadores.map((j) => ({ ...j, evaluacion: porJugador.get(j.id) ?? null }));
  const evaluados = lista.filter((j) => j.evaluacion).length;
  return { jugadores: lista, evaluados, total: lista.length, completado: lista.length > 0 && evaluados === lista.length };
}

/**
 * Siguiente jugador pendiente DESPUÉS de `actual` (en el orden de la lista y
 * volviendo al principio), sin contar los indicados como recién evaluados.
 * null si no queda ninguno.
 */
export function siguientePendiente(estado: EstadoCadena, actual: string | null, tambienEvaluados: readonly string[] = []): JugadorCadena | null {
  const hechos = new Set(tambienEvaluados);
  const pendientes = estado.jugadores.filter((j) => !j.evaluacion && !hechos.has(j.id));
  if (pendientes.length === 0) return null;
  const i = actual ? estado.jugadores.findIndex((j) => j.id === actual) : -1;
  const despues = estado.jugadores.slice(i + 1).find((j) => pendientes.includes(j));
  return despues ?? pendientes.find((j) => j.id !== actual) ?? null;
}
