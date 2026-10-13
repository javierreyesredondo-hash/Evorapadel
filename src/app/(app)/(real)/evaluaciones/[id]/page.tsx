import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { contextoEscuela } from "@/lib/supabase/gestion";
import { obtenerInforme, puedeEditar } from "@/lib/supabase/evaluaciones";
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
  const { informe, evaluacion } = r.datos;

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
      <p className="mt-8">
        <Link href={`/jugadores/${evaluacion.jugador.id}`} className="inline-flex min-h-11 items-center font-semibold text-electrico">
          Ver la ficha y el historial de {evaluacion.jugador.nombre}
        </Link>
      </p>
    </>
  );
}
