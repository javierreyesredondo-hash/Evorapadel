import type { Metadata } from "next";
import { jugadores } from "@/lib/demo-data";
import { Cabecera, FilaJugador, Lista } from "@/components/ui";

export const metadata: Metadata = { title: "Jugadores" };

export default function Jugadores() {
  const ordenados = [...jugadores].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return (
    <>
      <Cabecera
        titulo="Jugadores"
        subtitulo={`${jugadores.length} jugadores · puntuación de la última evaluación`}
      />
      <Lista>
        {ordenados.map((j) => (
          <FilaJugador key={j.id} jugador={j} />
        ))}
      </Lista>
    </>
  );
}
