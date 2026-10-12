import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { EnlaceBoton } from "@/components/ui";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NoEncontrado() {
  return (
    // Se muestra fuera de la zona privada (layout raíz), así que lleva su propio <main>.
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      <Logo />
      <p className="mt-10 font-display text-6xl font-extrabold italic text-electrico">404</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold uppercase italic">Página no encontrada</h1>
      <p className="mt-2 text-sm text-tenue">Lo que buscas no existe o ya no está disponible.</p>
      <EnlaceBoton href="/jugadores" className="mt-6">
        Ver jugadores
      </EnlaceBoton>
    </main>
  );
}
