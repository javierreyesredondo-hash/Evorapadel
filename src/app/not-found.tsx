import type { Metadata } from "next";
import { EnlaceBoton } from "@/components/ui";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NoEncontrado() {
  return (
    <div className="py-10 text-center">
      <p className="font-display text-6xl font-extrabold italic text-electrico">404</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold uppercase italic">Página no encontrada</h1>
      <p className="mt-2 text-sm text-tenue">Lo que buscas no existe o ya no está disponible.</p>
      <EnlaceBoton href="/jugadores" className="mt-6">
        Ver jugadores
      </EnlaceBoton>
    </div>
  );
}
