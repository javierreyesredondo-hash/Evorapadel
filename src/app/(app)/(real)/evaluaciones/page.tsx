import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { contextoEscuela } from "@/lib/supabase/gestion";
import { listarCompetencias, listarEvaluacionesRecientes } from "@/lib/supabase/evaluaciones";
import { Cabecera, EnlaceBoton, Vacio } from "@/components/ui";
import { Cargando, ErrorCarga } from "@/components/gestion/Estados";
import { ListaEvaluaciones } from "@/components/evaluaciones/ListaEvaluaciones";

export const metadata: Metadata = { title: "Evaluaciones" };

export default function Page() {
  return (
    <>
      <Cabecera titulo="Evaluaciones" subtitulo="Las más recientes de tu escuela" />
      <Suspense fallback={<Cargando texto="Cargando evaluaciones…" />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  const [evaluaciones, competencias] = await Promise.all([listarEvaluacionesRecientes(ctx), listarCompetencias(ctx)]);
  if (!evaluaciones.ok) return <ErrorCarga mensaje={evaluaciones.mensaje} />;
  const hayMetodologia = competencias.ok && competencias.datos.some((c) => c.activa);

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-3">
        {hayMetodologia && <EnlaceBoton href="/evaluaciones/nueva">Nueva evaluación</EnlaceBoton>}
        <EnlaceBoton href="/metodologia" variante="secundario">
          Metodología
        </EnlaceBoton>
      </div>
      {!hayMetodologia && (
        <div className="mb-5 rounded-2xl border border-naranja/40 bg-naranja/10 p-4 text-sm text-naranja">
          <p className="font-bold">Tu escuela todavía no tiene metodología.</p>
          <p className="mt-1 text-blanco/80">
            {ctx.rol === "director" ? (
              <>
                Define las competencias que se evalúan en <Link href="/metodologia" className="font-bold text-electrico underline">Metodología</Link>.
              </>
            ) : (
              "Pide a la dirección que defina las competencias que se evalúan."
            )}
          </p>
        </div>
      )}
      {evaluaciones.datos.length > 0 ? (
        <ListaEvaluaciones evaluaciones={evaluaciones.datos} etiqueta="Evaluaciones recientes" conJugador />
      ) : (
        <Vacio>Todavía no hay evaluaciones. Empieza desde la ficha de un jugador o con «Nueva evaluación».</Vacio>
      )}
    </>
  );
}
