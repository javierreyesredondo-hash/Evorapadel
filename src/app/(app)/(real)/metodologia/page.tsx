import type { Metadata } from "next";
import { Suspense } from "react";
import { METODOLOGIA_BASE, AREA_TEXTO } from "@/lib/metodologia";
import { contextoEscuela } from "@/lib/supabase/gestion";
import { listarCompetencias } from "@/lib/supabase/evaluaciones";
import { Cabecera, Lista, Seccion, Vacio } from "@/components/ui";
import { Cargando, ErrorCarga, SoloDireccion } from "@/components/gestion/Estados";
import { BotonCargarBase, FilaCompetencia, FormularioCompetencia } from "@/components/evaluaciones/Metodologia";

export const metadata: Metadata = { title: "Metodología" };

export default function Page() {
  return (
    <>
      <Cabecera titulo="Metodología" subtitulo="Competencias que se evalúan de 1 a 5 en tu escuela" />
      <Suspense fallback={<Cargando texto="Cargando metodología…" />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  const r = await listarCompetencias(ctx);
  if (!r.ok) return <ErrorCarga mensaje={r.mensaje} />;
  const esDirector = ctx.rol === "director";
  const competencias = r.datos;

  return (
    <>
      {!esDirector && <SoloDireccion>Solo la dirección puede cambiar la metodología.</SoloDireccion>}
      {competencias.length === 0 ? (
        <div className="mt-4 space-y-4">
          <Vacio>Tu escuela todavía no tiene competencias definidas.</Vacio>
          {esDirector && (
            <div className="rounded-2xl bg-noche-700 p-4 ring-1 ring-noche-500">
              <p className="text-sm">
                Puedes empezar con la metodología base ÉVORA ({METODOLOGIA_BASE.map((c) => c.nombre).join(", ")}) y adaptarla
                después, o crear tus propias competencias.
              </p>
              <div className="mt-4">
                <BotonCargarBase />
              </div>
            </div>
          )}
        </div>
      ) : (
        <Lista etiqueta="Competencias de tu escuela">
          {competencias.map((c) => (
            <FilaCompetencia key={c.id} competencia={c} esDirector={esDirector} />
          ))}
        </Lista>
      )}
      {esDirector && (
        <Seccion titulo="Añadir competencia">
          <div className="rounded-2xl bg-noche-700 p-4 ring-1 ring-noche-500">
            <FormularioCompetencia ordenSiguiente={Math.max(0, ...competencias.map((c) => c.orden)) + 1} />
          </div>
        </Seccion>
      )}
      <p className="mt-6 text-xs text-tenue">
        Áreas: {Object.values(AREA_TEXTO).join(", ")}. Las competencias no se borran (las evaluaciones antiguas las usan): se
        desactivan y dejan de pedirse en las evaluaciones nuevas.
      </p>
    </>
  );
}
