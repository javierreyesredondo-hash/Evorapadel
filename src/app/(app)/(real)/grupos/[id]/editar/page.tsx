import type { Metadata } from "next";
import { Suspense } from "react";
import { contextoEscuela, listarMiembros, obtenerGrupo } from "@/lib/supabase/gestion";
import { Cabecera } from "@/components/ui";
import { Cargando, ErrorCarga, NoEncontrado, SoloDireccion } from "@/components/gestion/Estados";
import { FormularioGrupo } from "@/components/gestion/FormularioGrupo";

export const metadata: Metadata = { title: "Editar grupo" };

export default function Page(props: PageProps<"/grupos/[id]/editar">) {
  return (
    <Suspense fallback={<Cargando texto="Cargando grupo…" />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  const [r, miembros] = await Promise.all([obtenerGrupo(ctx, id), listarMiembros(ctx)]);
  if (!r.ok) return <ErrorCarga mensaje={r.mensaje} />;
  if (!r.datos) return <NoEncontrado titulo="Grupo no encontrado" volver={{ href: "/grupos", texto: "Ver grupos" }} />;
  if (ctx.rol !== "director") return <SoloDireccion />;
  if (!miembros.ok) return <ErrorCarga mensaje={miembros.mensaje} />;
  return (
    <>
      <Cabecera titulo="Editar grupo" subtitulo={r.datos.nombre} />
      <FormularioGrupo grupo={r.datos} miembros={miembros.datos} usuarioId={ctx.usuarioId} />
    </>
  );
}
