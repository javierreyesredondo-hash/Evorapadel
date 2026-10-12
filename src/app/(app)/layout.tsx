import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { NavegacionInferior, NavegacionLateral } from "@/components/Navegacion";
import { ProveedorAvisos } from "@/components/gestion/Avisos";
import { ZonaPrivada, CargandoSesion } from "@/components/ZonaPrivada";

// Zona privada. El Proxy ya redirige a /acceso sin sesión; ZonaPrivada vuelve
// a comprobarla en el servidor antes de mostrar nada (defensa en profundidad).
export default function LayoutApp({ children }: LayoutProps<"/">) {
  return (
    <ProveedorAvisos>
      <div className="md:flex">
        <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col md:border-r md:border-noche-500 md:px-4 md:py-6">
          <Logo />
          <p className="mt-1 text-xs text-tenue">Observa. Mide. Haz crecer.</p>
          <NavegacionLateral />
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-noche-500 bg-noche/95 px-4 py-3 backdrop-blur md:hidden">
            <Logo />
          </header>

          <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-10">
            {/* Leer la sesión es dato de petición: con Cache Components va tras Suspense. */}
            <Suspense fallback={<CargandoSesion />}>
              <ZonaPrivada>{children}</ZonaPrivada>
            </Suspense>
          </main>
        </div>
      </div>
      <NavegacionInferior />
    </ProveedorAvisos>
  );
}
