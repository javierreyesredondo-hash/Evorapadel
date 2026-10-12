import type { Metadata } from "next";
import { Suspense } from "react";
import { NuevaEvaluacion } from "@/components/formularios/FormularioEvaluacion";

export const metadata: Metadata = { title: "Nueva evaluación" };

export default function Page() {
  // useSearchParams necesita un límite de Suspense con Cache Components.
  return (
    <Suspense>
      <NuevaEvaluacion />
    </Suspense>
  );
}
