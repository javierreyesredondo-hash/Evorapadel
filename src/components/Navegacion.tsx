"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { IconEvaluaciones, IconGrupos, IconInicio, IconJugadores } from "@/components/icons";

const enlaces = [
  { href: "/", texto: "Inicio", Icono: IconInicio },
  { href: "/jugadores", texto: "Jugadores", Icono: IconJugadores },
  { href: "/grupos", texto: "Grupos", Icono: IconGrupos },
  // Tareas de entrenamiento (también para el director que entrena): sus grupos y evaluaciones.
  { href: "/entrenamiento", texto: "Entrenar", Icono: IconEvaluaciones, tambien: ["/evaluaciones"] },
] as const;

function esActivo(pathname: string | null, enlace: (typeof enlaces)[number]) {
  if (pathname === null) return false;
  if (enlace.href === "/") return pathname === "/";
  const prefijos: readonly string[] = [enlace.href, ...("tambien" in enlace ? enlace.tambien : [])];
  return prefijos.some((p) => pathname.startsWith(p));
}

// usePathname() es dato de petición en rutas con parámetros dinámicos
// (/jugadores/[id], /grupos/[id]): tras Suspense, con la misma barra sin
// pestaña activa como respaldo para que no haya saltos.
function ConRuta({ Vista }: { Vista: (p: { pathname: string | null }) => ReactNode }) {
  const pathname = usePathname();
  return <Vista pathname={pathname} />;
}

/** Barra inferior en móvil. */
export function NavegacionInferior() {
  return (
    <Suspense fallback={<BarraInferior pathname={null} />}>
      <ConRuta Vista={BarraInferior} />
    </Suspense>
  );
}

function BarraInferior({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-noche-500 bg-noche/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {enlaces.map((enlace) => {
          const { href, texto, Icono } = enlace;
          const activo = esActivo(pathname, enlace);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${
                  activo ? "text-electrico" : "text-tenue"
                }`}
              >
                <Icono className="size-6" />
                {texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Menú lateral en escritorio. */
export function NavegacionLateral() {
  return (
    <Suspense fallback={<MenuLateral pathname={null} />}>
      <ConRuta Vista={MenuLateral} />
    </Suspense>
  );
}

function MenuLateral({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Principal" className="mt-8">
      <ul className="space-y-1">
        {enlaces.map((enlace) => {
          const { href, texto, Icono } = enlace;
          const activo = esActivo(pathname, enlace);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  activo
                    ? "bg-electrico text-noche"
                    : "text-tenue hover:bg-noche-600 hover:text-blanco"
                }`}
              >
                <Icono className="size-5" />
                {texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
