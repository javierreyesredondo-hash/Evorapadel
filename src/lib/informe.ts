// Modelo del informe de una evaluación: los datos YA GUARDADOS en Supabase que
// muestran la previsualización (HTML) y el PDF. Ambos se generan a partir de
// este mismo objeto, así que siempre coinciden. Sin React ni Supabase.

import type { Comparacion, ObjetivoEvaluacion, PuntuacionCompetencia, TipoEvaluacion } from "./evaluaciones.ts";
import type { Escala } from "./metodologia.ts";

export type InformeEvaluacion = {
  escuela: string;
  jugador: { nombre: string; nivel: string | null };
  grupo: string | null;
  /** Nombre visible del autor; null si no tiene (se muestra un texto neutro). */
  entrenador: string | null;
  tipo: TipoEvaluacion;
  titulo: string | null;
  /** AAAA-MM-DD */
  fecha: string;
  puntuaciones: PuntuacionCompetencia[];
  media: number | null;
  fortalezas: string | null;
  mejoras: string | null;
  observaciones: string | null;
  objetivos: ObjetivoEvaluacion[];
  /** Evolución en competencias comunes con la evaluación anterior del mismo tipo. */
  comparacion: Comparacion | null;
  /** Hay una evaluación anterior del mismo tipo, aunque no compartan competencias. */
  hayAnterior: boolean;
  /** Fecha de emisión del informe (AAAA-MM-DD). */
  emitido: string;
  /** Escala con la que se puntuó (la de su metodología; si falta, la de ÉVORA). */
  escala?: Escala;
  /** Metodología importada vigente al crear la evaluación (null: la propia de la escuela). */
  metodologia?: { nombre: string; version: string } | null;
};

export const TEXTO_SIN_ENTRENADOR = "Equipo técnico de la escuela";

/** Texto de la sección de evolución cuando no hay comparación posible. */
export function textoSinComparacion(m: Pick<InformeEvaluacion, "hayAnterior">): string {
  return m.hayAnterior
    ? "La evaluación anterior de este tipo no puntuó las mismas competencias, así que todavía no hay datos comparables."
    : "Todavía no hay historial suficiente: es la primera evaluación de este tipo registrada para el jugador.";
}
