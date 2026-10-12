import type { Metadata } from "next";
import { Suspense } from "react";
import { contextoEscuela, listarMiembros } from "@/lib/supabase/gestion";
import { Cabecera } from "@/components/ui";
import { Cargando, ErrorCarga, SoloDireccion } from "@/components/gestion/Estados";
import { FormularioGrupo } from "@/components/gestion/FormularioGrupo";

export const metadata: Metadata = { title: "Nuevo grupo" };

export default function Page() {
  return (
    <>
      <Cabecera titulo="Nuevo grupo" subtitulo="Se guardará en tu escuela." />
      <Suspense fallback={<Cargando texto="Preparando el formulario…" />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  if (ctx.rol !== "director") return <SoloDireccion />;
  const miembros = await listarMiembros(ctx);
  if (!miembros.ok) return <ErrorCarga mensaje={miembros.mensaje} />;
  return <FormularioGrupo miembros={miembros.datos} usuarioId={ctx.usuarioId} />;
}
