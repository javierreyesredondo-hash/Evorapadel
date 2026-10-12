"use client";

import type { Objetivo } from "@/lib/demo-data";
import { jugadorPorId } from "@/lib/demo-data";
import { useAlmacen } from "@/lib/almacen";
import { objetivoCompletado } from "@/lib/dominio";
import { porcentaje } from "@/lib/format";
import { BarraProgreso } from "@/components/ui";

const claseControl =
  "grid size-11 place-items-center rounded-full text-xl font-bold ring-1 ring-noche-500 transition-colors hover:bg-noche-600 disabled:opacity-30 disabled:hover:bg-transparent";

/** Objetivo con su progreso y controles para sumar o restar una unidad. */
export function FilaObjetivo({
  objetivo,
  mostrarJugador = true,
}: {
  objetivo: Objetivo;
  mostrarJugador?: boolean;
}) {
  const { despachar } = useAlmacen();
  const jugador = jugadorPorId(objetivo.jugadorId);
  const valor = porcentaje(objetivo.progreso, objetivo.meta);
  const completado = objetivoCompletado(objetivo);
  const cambiar = (delta: number) =>
    despachar({ tipo: "actualizarProgreso", objetivoId: objetivo.id, progreso: objetivo.progreso + delta });

  return (
    <li className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{objetivo.titulo}</p>
          <p className="truncate text-xs text-tenue">
            {mostrarJugador && `${jugador?.nombre ?? "Jugador"} · `}
            {objetivo.area}
          </p>
        </div>
        <p className="shrink-0 font-display text-xl font-bold leading-none text-electrico">
          {valor}%
        </p>
      </div>
      <div className="mt-2.5">
        <BarraProgreso valor={valor} etiqueta={`Progreso de ${objetivo.titulo}`} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-tenue" aria-live="polite">
          <span className="font-semibold text-blanco">{objetivo.progreso}</span> de {objetivo.meta}
          {completado && (
            <span className="ml-2 rounded-full bg-electrico px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-noche">
              Completado
            </span>
          )}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className={claseControl}
            onClick={() => cambiar(-1)}
            disabled={objetivo.progreso <= 0}
            aria-label={`Restar 1 a «${objetivo.titulo}»`}
          >
            −
          </button>
          <button
            type="button"
            className={`${claseControl} bg-electrico text-noche ring-electrico hover:bg-electrico hover:opacity-90`}
            onClick={() => cambiar(1)}
            disabled={completado}
            aria-label={`Sumar 1 a «${objetivo.titulo}»`}
          >
            +
          </button>
        </div>
      </div>
    </li>
  );
}
