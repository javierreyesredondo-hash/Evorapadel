import type { Metadata } from "next";
import { ListaJugadores } from "@/components/vistas/ListaJugadores";

export const metadata: Metadata = { title: "Jugadores" };

export default function Page() {
  return <ListaJugadores />;
}
