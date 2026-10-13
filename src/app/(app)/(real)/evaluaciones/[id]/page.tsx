import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { contextoEscuela } from "@/lib/supabase/gestion";
import { obtenerInforme, puedeEditar } from "@/lib/supabase/evaluaciones";
import { EnlaceBoton } from "@/components/ui";
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
      <div className="mb-5 flex flex-wrap gap-3">
        <EnlaceBoton href={`/evaluaciones/${evaluacion.id}/informe`}>Informe PDF</EnlaceBoton>
        {puedeEditar(ctx, evaluacion) && (
          <EnlaceBoton href={`/evaluaciones/${evaluacion.id}/editar`} variante="secundario">
            Editar
          </EnlaceBoton>
        )}
      </div>
      <VistaInforme informe={informe} />
      <p className="mt-8">
        <Link href={`/jugadores/${evaluacion.jugador.id}`} className="inline-flex min-h-11 items-center font-semibold text-electrico">
          Ver la ficha y el historial de {evaluacion.jugador.nombre}
        </Link>
      </p>
    </>
  );
}
