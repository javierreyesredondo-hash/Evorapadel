import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { METODOLOGIA_BASE, AREA_TEXTO } from "@/lib/metodologia";
import { contextoEscuela } from "@/lib/supabase/gestion";
import { listarCompetencias } from "@/lib/supabase/evaluaciones";
import { listarMetodologias, type ResumenMetodologia } from "@/lib/supabase/metodologias";
import { Cabecera, EnlaceBoton, Lista, Seccion, Vacio } from "@/components/ui";
import { Cargando, ErrorCarga, SoloDireccion } from "@/components/gestion/Estados";
import { BotonCargarBase, FilaCompetencia, FormularioCompetencia } from "@/components/evaluaciones/Metodologia";
import { ESTADO_TEXTO } from "@/components/metodologias/VistaMetodologia";

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
  const [r, importadas] = await Promise.all([listarCompetencias(ctx), listarMetodologias(ctx)]);
  if (!r.ok) return <ErrorCarga mensaje={r.mensaje} />;
  const esDirector = ctx.rol === "director";
  const competencias = r.datos;
  const activa = importadas.ok ? importadas.datos.find((m) => m.estado === "activa") : undefined;

  return (
    <>
      {!esDirector && <SoloDireccion>Solo la dirección puede cambiar la metodología.</SoloDireccion>}
      {activa && (
        <p className="mb-4 rounded-xl bg-noche-700 px-3 py-2 text-sm ring-1 ring-noche-500">
          Metodología activa:{" "}
          <Link href={`/metodologia/importadas/${activa.id}`} className="font-bold text-electrico">
            {activa.nombre} · versión {activa.version}
          </Link>
        </p>
      )}
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
      <Seccion titulo="Metodologías importadas">
        {esDirector && (
          <div className="mb-3">
            <EnlaceBoton href="/metodologia/importar">Importar metodología desde PDF</EnlaceBoton>
          </div>
        )}
        {!importadas.ok ? (
          <ErrorCarga mensaje={importadas.mensaje} />
        ) : importadas.datos.length === 0 ? (
          <Vacio>Todavía no se ha importado ninguna metodología.</Vacio>
        ) : (
          <Lista etiqueta="Metodologías importadas">
            {importadas.datos.map((m) => (
              <FilaImportada key={m.id} m={m} />
            ))}
          </Lista>
        )}
      </Seccion>
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

function FilaImportada({ m }: { m: ResumenMetodologia }) {
  return (
    <li>
      <Link href={`/metodologia/importadas/${m.id}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 hover:bg-noche-600">
        <span className="min-w-0">
          <span className="block truncate font-semibold">{m.nombre}</span>
          <span className="block text-xs text-tenue">Versión {m.version}</span>
        </span>
        <span className={`shrink-0 text-xs font-bold ${m.estado === "activa" ? "text-electrico" : "text-tenue"}`}>{ESTADO_TEXTO[m.estado]}</span>
      </Link>
    </li>
  );
}
