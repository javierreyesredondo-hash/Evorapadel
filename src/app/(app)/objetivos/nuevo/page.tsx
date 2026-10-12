import type { Metadata } from "next";
import { Suspense } from "react";
import { NuevoObjetivo } from "@/components/formularios/FormularioObjetivo";

export const metadata: Metadata = { title: "Nuevo objetivo" };

export default function Page() {
  // useSearchParams necesita un límite de Suspense con Cache Components.
  return (
    <Suspense>
      <NuevoObjetivo />
    </Suspense>
  );
}
