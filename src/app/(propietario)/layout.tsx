import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { ProveedorAvisos } from "@/components/gestion/Avisos";
import { CargandoSesion } from "@/components/ZonaPrivada";

// Zona del PROPIETARIO de ÉVORA (administración global). Fuera de la zona de
// las escuelas: el administrador no necesita pertenecer a ninguna. El proxy
// exige sesión; la página comprueba en el servidor que es administrador.
export default function LayoutPropietario({ children }: LayoutProps<"/">) {
  return (
    <ProveedorAvisos>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-noche-500 bg-noche/95 px-4 py-2 backdrop-blur">
        <Logo variante="compacta" className="h-10" />
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 md:px-8 md:pt-10">
        <Suspense fallback={<CargandoSesion />}>{children}</Suspense>
      </main>
    </ProveedorAvisos>
  );
}
