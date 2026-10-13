import Link from "next/link";
import type { ReactNode } from "react";
import { iniciales } from "@/lib/format";
import { IconFlecha } from "@/components/icons";

export function Cabecera({
  titulo,
  subtitulo,
  accion,
}: {
  titulo: string;
  subtitulo?: string;
  accion?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-4xl font-extrabold uppercase italic leading-none tracking-tight">
          {titulo}
        </h1>
        {subtitulo && <p className="mt-2 text-sm text-tenue">{subtitulo}</p>}
      </div>
      {accion}
    </header>
  );
}

export function Seccion({
  titulo,
  enlace,
  children,
}: {
  titulo: string;
  enlace?: { href: string; texto: string };
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-4">
        <h2 className="font-display text-xl font-bold uppercase italic tracking-wide">
          {titulo}
        </h2>
        {enlace && (
          <Link
            href={enlace.href}
            className="-my-3 -mr-2 flex min-h-11 items-center gap-0.5 px-2 text-sm font-semibold text-electrico"
          >
            {enlace.texto}
            <IconFlecha className="size-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function Lista({ children, etiqueta }: { children: ReactNode; etiqueta?: string }) {
  return (
    <ul
      aria-label={etiqueta}
      className="divide-y divide-noche-500 overflow-hidden rounded-2xl bg-noche-700 ring-1 ring-noche-500"
    >
      {children}
    </ul>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-noche-500 px-4 py-8 text-center text-sm text-tenue">
      {children}
    </div>
  );
}

export function Avatar({ nombre, grande = false }: { nombre: string; grande?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-noche-500 font-display font-bold text-blanco ${
        grande ? "size-16 text-2xl" : "size-11 text-base"
      }`}
    >
      {iniciales(nombre)}
    </span>
  );
}

export const claseBoton = {
  primario:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-electrico px-5 text-sm font-bold text-noche transition-opacity hover:opacity-90 disabled:opacity-40",
  secundario:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold text-blanco ring-1 ring-noche-500 transition-colors hover:bg-noche-600",
};

export function EnlaceBoton({
  href,
  children,
  variante = "primario",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variante?: keyof typeof claseBoton;
  className?: string;
}) {
  return (
    <Link href={href} className={`${claseBoton[variante]} ${className}`}>
      {children}
    </Link>
  );
}
