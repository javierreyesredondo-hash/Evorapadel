import type { Metadata } from "next";
import { Suspense } from "react";
import { nombreArchivoInforme, TIPO_TEXTO } from "@/lib/evaluaciones";
import { textoFecha } from "@/lib/format";
import { contextoEscuela } from "@/lib/supabase/gestion";
import { obtenerInforme } from "@/lib/supabase/evaluaciones";
import { Cabecera } from "@/components/ui";
import { Cargando, ErrorCarga, NoEncontrado } from "@/components/gestion/Estados";
import { VistaInforme } from "@/components/evaluaciones/VistaInforme";
import { AccionesInforme } from "@/components/evaluaciones/AccionesInforme";

export const metadata: Metadata = { title: "Informe" };

export default function Page(props: PageProps<"/evaluaciones/[id]/informe">) {
  return (
    <>
      <Cabecera titulo="Informe" subtitulo="Vista previa del PDF para compartir con la familia." />
      <Suspense fallback={<Cargando texto="Preparando el informe…" />}>
        <Contenido params={props.params} />
      </Suspense>
    </>
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
    <div className="space-y-6">
      <AccionesInforme
        url={`/evaluaciones/${evaluacion.id}/pdf`}
        nombreArchivo={nombreArchivoInforme(informe.jugador.nombre, informe.fecha)}
        titulo={`${TIPO_TEXTO[informe.tipo]} de ${informe.jugador.nombre} (${textoFecha(informe.fecha)})`}
      />
      <VistaInforme informe={informe} variante="papel" />
    </div>
  );
}
