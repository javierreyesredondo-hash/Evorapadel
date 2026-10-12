import type { Metadata } from "next";
import { Suspense } from "react";
import { hoyIso } from "@/lib/format";
import { contextoEscuela, listarJugadores } from "@/lib/supabase/gestion";
import { Cabecera, EnlaceBoton } from "@/components/ui";
import { Cargando, ErrorCarga } from "@/components/gestion/Estados";
import { ListaJugadoresReales } from "@/components/gestion/ListaJugadoresReales";

export const metadata: Metadata = { title: "Jugadores" };

export default function Page() {
  return (
    <>
      <Cabecera
        titulo="Jugadores"
        subtitulo="Jugadores de tu escuela"
        accion={
          <EnlaceBoton href="/jugadores/nuevo" className="shrink-0">
            Nuevo
          </EnlaceBoton>
        }
      />
      <Suspense fallback={<Cargando texto="Cargando jugadores…" />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  const r = await listarJugadores(ctx);
  if (!r.ok) return <ErrorCarga mensaje={r.mensaje} />;
  return <ListaJugadoresReales jugadores={r.datos} hoy={hoyIso()} />;
}
