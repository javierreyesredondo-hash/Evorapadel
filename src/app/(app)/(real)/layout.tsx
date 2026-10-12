import type { ReactNode } from "react";
import { IndicadorDatosReales } from "@/components/gestion/Modo";

// Pantallas con datos REALES de la escuela (Supabase). Todas muestran el
// indicador de modo para no confundirlas con la demostración (/demo).
export default function LayoutReal({ children }: { children: ReactNode }) {
  return (
    <>
      <IndicadorDatosReales />
      {children}
    </>
  );
}
