"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconEvaluaciones,
  IconInicio,
  IconJugadores,
  IconObjetivos,
} from "@/components/icons";

const enlaces = [
  { href: "/", texto: "Inicio", Icono: IconInicio },
  { href: "/jugadores", texto: "Jugadores", Icono: IconJugadores },
  { href: "/evaluaciones", texto: "Evaluaciones", Icono: IconEvaluaciones },
  { href: "/objetivos", texto: "Objetivos", Icono: IconObjetivos },
] as const;

function esActivo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Barra inferior en móvil. */
export function NavegacionInferior() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-noche-500 bg-noche/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {enlaces.map(({ href, texto, Icono }) => {
          const activo = esActivo(pathname, href);
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
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="mt-8">
      <ul className="space-y-1">
        {enlaces.map(({ href, texto, Icono }) => {
          const activo = esActivo(pathname, href);
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
