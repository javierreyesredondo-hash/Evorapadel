import type { Metadata } from "next";
import { Suspense } from "react";
import { hoyIso } from "@/lib/format";
import { contextoEscuela } from "@/lib/supabase/gestion";
import { Cabecera } from "@/components/ui";
import { Cargando, ErrorCarga } from "@/components/gestion/Estados";
import { FormularioJugador } from "@/components/gestion/FormularioJugador";

export const metadata: Metadata = { title: "Nuevo jugador" };

export default function Page() {
  return (
    <>
      <Cabecera titulo="Nuevo jugador" subtitulo="Se guardará en tu escuela." />
      <Suspense fallback={<Cargando texto="Preparando el formulario…" />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  // Directores y entrenadores pueden dar de alta jugadores (RLS jugadores_crear).
  if (!(await contextoEscuela())) return <ErrorCarga />;
  return <FormularioJugador hoy={hoyIso()} />;
}
