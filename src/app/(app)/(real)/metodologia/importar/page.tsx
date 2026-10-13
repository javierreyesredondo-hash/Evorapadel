import type { Metadata } from "next";
import { Suspense } from "react";
import { contextoEscuela } from "@/lib/supabase/gestion";
import { Cabecera } from "@/components/ui";
import { Cargando, ErrorCarga, SoloDireccion } from "@/components/gestion/Estados";
import { Importador } from "@/components/metodologias/Importador";

export const metadata: Metadata = { title: "Importar metodología" };

export default function Page() {
  return (
    <>
      <Cabecera titulo="Importar metodología" subtitulo="Desde un PDF: se analiza, lo revisas y se guarda como borrador" />
      <Suspense fallback={<Cargando texto="Cargando…" />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  if (ctx.rol !== "director") return <SoloDireccion>Solo la dirección de la escuela puede importar metodologías.</SoloDireccion>;
  return <Importador />;
}
