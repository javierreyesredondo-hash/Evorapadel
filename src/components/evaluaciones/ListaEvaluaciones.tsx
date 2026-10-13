import Link from "next/link";
import { textoFecha } from "@/lib/format";
import { textoMediaEvaluacion, TIPO_TEXTO } from "@/lib/evaluaciones";
import type { ResumenEvaluacion } from "@/lib/supabase/evaluaciones";
import { Lista } from "@/components/ui";

/** Lista de evaluaciones con su media (de 1 a 5). */
export function ListaEvaluaciones({ evaluaciones, etiqueta, conJugador = false }: { evaluaciones: ResumenEvaluacion[]; etiqueta: string; conJugador?: boolean }) {
  return (
    <Lista etiqueta={etiqueta}>
      {evaluaciones.map((e) => (
        <li key={e.id}>
          <Link href={`/evaluaciones/${e.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-noche-600">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{conJugador && e.jugador ? e.jugador.nombre : (e.titulo ?? TIPO_TEXTO[e.tipo])}</p>
              <p className="truncate text-xs text-tenue">
                {textoFecha(e.fecha)} · {conJugador ? TIPO_TEXTO[e.tipo] : `${e.numero} ${e.numero === 1 ? "competencia" : "competencias"}`}
              </p>
            </div>
            <p className="shrink-0 text-right">
              <span className="font-display text-2xl font-bold leading-none">{textoMediaEvaluacion(e.media)}</span>
              <span className="block text-xs text-tenue">media / 5</span>
            </p>
          </Link>
        </li>
      ))}
    </Lista>
  );
}
