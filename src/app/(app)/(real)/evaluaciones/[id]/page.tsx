import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { contextoEscuela } from "@/lib/supabase/gestion";
import { obtenerInforme, puedeEditar, type VersionRedaccion } from "@/lib/supabase/evaluaciones";
import { textoFecha } from "@/lib/format";
import { EnlaceBoton } from "@/components/ui";
import { IconPdf } from "@/components/icons";
import { Cargando, ErrorCarga, NoEncontrado } from "@/components/gestion/Estados";
import { VistaInforme } from "@/components/evaluaciones/VistaInforme";

export const metadata: Metadata = { title: "Evaluación" };

export default function Page(props: PageProps<"/evaluaciones/[id]">) {
  return (
    <Suspense fallback={<Cargando texto="Cargando evaluación…" />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  const r = await obtenerInforme(ctx, id);
  if (!r.ok) return <ErrorCarga mensaje={r.mensaje} />;
  if (!r.datos) return <NoEncontrado titulo="Evaluación no encontrada" volver={{ href: "/evaluaciones", texto: "Ver evaluaciones" }} />;
  const { informe, evaluacion, versiones } = r.datos;
  const anteriores = versiones.slice(1);

  return (
    <>
      {/* Lo primero de la página: el informe para la familia (también tras guardar, que lleva aquí). */}
      <section aria-label="Informe para la familia" className="mb-6 rounded-2xl bg-noche-700 p-4 ring-1 ring-electrico/40">
        <p className="font-bold text-electrico">Informe para la familia</p>
        <p className="mt-1 text-sm text-blanco/80">
          Genera el PDF con los datos guardados de esta evaluación y compártelo desde el móvil (WhatsApp, correo…).
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <EnlaceBoton href={`/evaluaciones/${evaluacion.id}/informe`} className="w-full sm:w-auto">
            <IconPdf />
            Ver informe PDF
          </EnlaceBoton>
          {puedeEditar(ctx, evaluacion) && (
            <EnlaceBoton href={`/evaluaciones/${evaluacion.id}/editar`} variante="secundario" className="w-full sm:w-auto">
              Editar evaluación
            </EnlaceBoton>
          )}
        </div>
      </section>
      <VistaInforme informe={informe} />
      {anteriores.length > 0 && <VersionesAnteriores versiones={anteriores} />}
      <p className="mt-8">
        <Link href={`/jugadores/${evaluacion.jugador.id}`} className="inline-flex min-h-11 items-center font-semibold text-electrico">
          Ver la ficha y el historial de {evaluacion.jugador.nombre}
        </Link>
      </p>
    </>
  );
}

const ORIGEN: Record<VersionRedaccion["origen"], string> = {
  propuesta: "propuesta automática aprobada sin cambios",
  revisada: "propuesta automática revisada",
  manual: "escrita a mano",
};

/** Versiones anteriores de la redacción: lo que se aprobó antes de cada edición (no se pierde). */
function VersionesAnteriores({ versiones }: { versiones: VersionRedaccion[] }) {
  return (
    <section aria-labelledby="versiones-titulo" className="mt-8">
      <h2 id="versiones-titulo" className="font-display text-xl font-bold uppercase italic tracking-wide">
        Versiones anteriores de la redacción
      </h2>
      <p className="mt-1 text-xs text-tenue">El informe muestra la versión actual. Las anteriores se conservan tal como se aprobaron.</p>
      <div className="mt-3 space-y-2">
        {versiones.map((v) => (
          <details key={v.version} className="rounded-2xl bg-noche-700 ring-1 ring-noche-500">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm font-semibold">
              <span>Versión {v.version}</span>
              <span className="text-xs font-normal text-tenue">
                {textoFecha(v.creada.slice(0, 10))} · {ORIGEN[v.origen]}
              </span>
            </summary>
            <dl className="space-y-3 border-t border-noche-500 p-4 text-sm">
              {(
                [
                  ["Fortalezas", v.fortalezas],
                  ["Aspectos a mejorar", v.mejoras],
                  ["Interpretación técnica", v.interpretacion],
                  ["Objetivo de trabajo", v.objetivo],
                  ["Observaciones del entrenador/a", v.observaciones],
                ] as const
              )
                .filter(([, t]) => t)
                .map(([titulo, t]) => (
                  <div key={titulo}>
                    <dt className="font-bold">{titulo}</dt>
                    <dd className="mt-0.5 whitespace-pre-line text-blanco/80">{t}</dd>
                  </div>
                ))}
            </dl>
          </details>
        ))}
      </div>
    </section>
  );
}
