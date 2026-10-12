import type { Metadata } from "next";
import { evaluaciones } from "@/lib/demo-data";
import { Cabecera, FilaEvaluacion, Lista } from "@/components/ui";

export const metadata: Metadata = { title: "Evaluaciones" };

export default function Evaluaciones() {
  const ordenadas = [...evaluaciones].sort((a, b) => a.venceEnDias - b.venceEnDias);
  return (
    <>
      <Cabecera
        titulo="Evaluaciones"
        subtitulo={`${evaluaciones.length} pendientes · las más urgentes primero`}
      />
      <Lista>
        {ordenadas.map((e) => (
          <FilaEvaluacion key={e.id} evaluacion={e} />
        ))}
      </Lista>
    </>
  );
}
