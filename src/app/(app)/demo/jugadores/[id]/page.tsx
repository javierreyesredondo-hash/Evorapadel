import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { jugadores, jugadorPorId } from "@/lib/demo-data";
import { FichaJugador } from "@/components/vistas/FichaJugador";

export function generateStaticParams() {
  return jugadores.map((j) => ({ id: j.id }));
}

export async function generateMetadata(props: PageProps<"/demo/jugadores/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  return { title: jugadorPorId(id)?.nombre ?? "Jugador" };
}

export default async function Page(props: PageProps<"/demo/jugadores/[id]">) {
  const { id } = await props.params;
  if (!jugadorPorId(id)) notFound();
  return <FichaJugador id={id} />;
}
