import type { Metadata } from "next";
import { objetivos } from "@/lib/demo-data";
import { Cabecera, FilaObjetivo, Lista } from "@/components/ui";

export const metadata: Metadata = { title: "Objetivos" };

export default function Objetivos() {
  return (
    <>
      <Cabecera
        titulo="Objetivos"
        subtitulo={`${objetivos.length} objetivos en curso`}
      />
      <Lista>
        {objetivos.map((o) => (
          <FilaObjetivo key={o.id} objetivo={o} />
        ))}
      </Lista>
    </>
  );
}
