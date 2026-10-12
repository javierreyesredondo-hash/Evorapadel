import type { Metadata } from "next";
import { Suspense } from "react";
import { hoyIso } from "@/lib/format";
import { contextoEscuela, obtenerJugador } from "@/lib/supabase/gestion";
import { Cabecera } from "@/components/ui";
import { Cargando, ErrorCarga, NoEncontrado } from "@/components/gestion/Estados";
import { FormularioJugador } from "@/components/gestion/FormularioJugador";

export const metadata: Metadata = { title: "Editar jugador" };

export default function Page(props: PageProps<"/jugadores/[id]/editar">) {
  return (
    <Suspense fallback={<Cargando texto="Cargando jugador…" />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  const r = await obtenerJugador(ctx, id);
  if (!r.ok) return <ErrorCarga mensaje={r.mensaje} />;
  if (!r.datos) return <NoEncontrado titulo="Jugador no encontrado" volver={{ href: "/jugadores", texto: "Ver jugadores" }} />;
  return (
    <>
      <Cabecera titulo="Editar jugador" subtitulo={r.datos.nombre} />
      <FormularioJugador jugador={r.datos} hoy={hoyIso()} />
    </>
  );
}
