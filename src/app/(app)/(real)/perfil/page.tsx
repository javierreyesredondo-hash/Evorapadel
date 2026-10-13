import type { Metadata } from "next";
import { Suspense } from "react";
import { NOMBRE_ROL } from "@/lib/acceso";
import { obtenerSesion } from "@/lib/supabase/sesion";
import { Cabecera } from "@/components/ui";
import { Cargando, ErrorCarga } from "@/components/gestion/Estados";
import { FormularioPerfil } from "@/components/evaluaciones/FormularioPerfil";

export const metadata: Metadata = { title: "Tu perfil" };

export default function Page() {
  return (
    <>
      <Cabecera titulo="Tu perfil" />
      <Suspense fallback={<Cargando texto="Cargando tu perfil…" />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const sesion = await obtenerSesion();
  if (sesion.estado !== "ok") return <ErrorCarga />;
  const m = sesion.membresias[0];
  return (
    <div className="space-y-6">
      <p className="text-sm text-tenue">
        {sesion.email}
        {m && <> · {NOMBRE_ROL[m.rol]} en {m.escuelaNombre}</>}
      </p>
      <FormularioPerfil nombre={sesion.nombreVisible ?? ""} />
    </div>
  );
}
