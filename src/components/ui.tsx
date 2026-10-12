import Link from "next/link";
import type { ReactNode } from "react";
import type { Evaluacion, Jugador, Objetivo } from "@/lib/demo-data";
import { jugadorPorId } from "@/lib/demo-data";
import { iniciales, porcentaje, textoVencimiento } from "@/lib/format";
import { IconBaja, IconFlecha, IconSube } from "@/components/icons";

export function Cabecera({
  titulo,
  subtitulo,
}: {
  titulo: string;
  subtitulo?: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="font-display text-4xl font-extrabold uppercase italic leading-none tracking-tight">
        {titulo}
      </h1>
      {subtitulo && <p className="mt-2 text-sm text-tenue">{subtitulo}</p>}
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
            className="flex items-center gap-0.5 text-sm font-semibold text-electrico"
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

export function Lista({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-noche-500 overflow-hidden rounded-2xl bg-noche-700 ring-1 ring-noche-500">
      {children}
    </ul>
  );
}

export function Avatar({ nombre }: { nombre: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-11 shrink-0 place-items-center rounded-full bg-noche-500 font-display text-base font-bold text-blanco"
    >
      {iniciales(nombre)}
    </span>
  );
}

export function BarraProgreso({ valor }: { valor: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valor}
      className="h-2 w-full overflow-hidden rounded-full bg-noche-500"
    >
      <div
        className="h-full rounded-full bg-electrico"
        style={{ width: `${valor}%` }}
      />
    </div>
  );
}

export function FilaJugador({ jugador }: { jugador: Jugador }) {
  const sube = jugador.tendencia >= 0;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar nombre={jugador.nombre} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{jugador.nombre}</p>
        <p className="truncate text-xs text-tenue">
          {jugador.nivel} · {jugador.posicion} · Foco: {jugador.foco}
        </p>
      </div>
      <div className="text-right">
        <p className="font-display text-2xl font-bold leading-none">
          {jugador.puntuacion}
        </p>
        <p
          className={`mt-0.5 flex items-center justify-end text-xs font-semibold ${
            sube ? "text-electrico" : "text-naranja"
          }`}
        >
          {sube ? <IconSube className="size-3.5" /> : <IconBaja className="size-3.5" />}
          {sube ? "+" : ""}
          {jugador.tendencia}
        </p>
      </div>
    </li>
  );
}

export function FilaEvaluacion({ evaluacion }: { evaluacion: Evaluacion }) {
  const jugador = jugadorPorId(evaluacion.jugadorId);
  const urgente = evaluacion.venceEnDias <= 0;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        aria-hidden="true"
        className={`h-10 w-1 shrink-0 rounded-full ${
          urgente ? "bg-naranja" : "bg-noche-500"
        }`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{jugador?.nombre ?? "Jugador"}</p>
        <p className="truncate text-xs text-tenue">{evaluacion.tipo}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
          urgente ? "bg-naranja/15 text-naranja" : "bg-noche-500 text-tenue"
        }`}
      >
        {textoVencimiento(evaluacion.venceEnDias)}
      </span>
    </li>
  );
}

export function FilaObjetivo({ objetivo }: { objetivo: Objetivo }) {
  const jugador = jugadorPorId(objetivo.jugadorId);
  const valor = porcentaje(objetivo.progreso, objetivo.meta);
  return (
    <li className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{objetivo.titulo}</p>
          <p className="truncate text-xs text-tenue">
            {jugador?.nombre ?? "Jugador"} · {objetivo.area}
          </p>
        </div>
        <p className="shrink-0 font-display text-xl font-bold leading-none text-electrico">
          {valor}%
        </p>
      </div>
      <div className="mt-2.5">
        <BarraProgreso valor={valor} />
      </div>
      <p className="mt-1.5 text-xs text-tenue">
        {objetivo.progreso} {objetivo.unidad}
      </p>
    </li>
  );
}
