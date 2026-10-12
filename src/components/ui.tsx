import Link from "next/link";
import type { ReactNode } from "react";
import type { EvaluacionPendiente, EvaluacionRealizada, Jugador } from "@/lib/demo-data";
import { jugadorPorId } from "@/lib/demo-data";
import { puntuacionGlobal } from "@/lib/dominio";
import { iniciales, textoFecha, textoVencimiento } from "@/lib/format";
import { IconBaja, IconFlecha, IconSube } from "@/components/icons";

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

/** Marca visible de que el jugador es inventado. */
export function EtiquetaFicticio() {
  return (
    <span className="rounded-full border border-naranja/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-naranja">
      Ficticio
    </span>
  );
}

export function BarraProgreso({ valor, etiqueta }: { valor: number; etiqueta?: string }) {
  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valor}
      className="h-2 w-full overflow-hidden rounded-full bg-noche-500"
    >
      <div
        className="h-full rounded-full bg-electrico transition-[width]"
        style={{ width: `${valor}%` }}
      />
    </div>
  );
}

/** Cinco segmentos para una nota de 1 a 5. */
export function MedidorNota({ nota }: { nota: number }) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-2 w-5 rounded-full ${i <= nota ? "bg-electrico" : "bg-noche-500"}`}
        />
      ))}
    </span>
  );
}

export function Tendencia({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-xs text-tenue">—</span>;
  const sube = valor >= 0;
  return (
    <span
      className={`flex items-center justify-end text-xs font-semibold ${
        sube ? "text-electrico" : "text-naranja"
      }`}
    >
      {sube ? <IconSube className="size-3.5" /> : <IconBaja className="size-3.5" />}
      {sube ? "+" : ""}
      {valor}
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

export function FilaJugador({
  jugador,
  puntuacion,
  tendencia,
}: {
  jugador: Jugador;
  puntuacion: number | null;
  tendencia: number | null;
}) {
  return (
    <li>
      <Link
        href={`/jugadores/${jugador.id}`}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-noche-600"
      >
        <Avatar nombre={jugador.nombre} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{jugador.nombre}</p>
          <p className="truncate text-xs text-tenue">
            {jugador.nivel} · {jugador.posicion} · Foco: {jugador.foco}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold leading-none">{puntuacion ?? "—"}</p>
          <div className="mt-0.5">
            <Tendencia valor={tendencia} />
          </div>
        </div>
      </Link>
    </li>
  );
}

export function FilaPendiente({ pendiente }: { pendiente: EvaluacionPendiente }) {
  const jugador = jugadorPorId(pendiente.jugadorId);
  const urgente = pendiente.venceEnDias <= 0;
  return (
    <li>
      <Link
        href={`/evaluaciones/nueva?pendiente=${pendiente.id}`}
        aria-label={`Evaluar a ${jugador?.nombre ?? "jugador"}: ${pendiente.tipo}, ${textoVencimiento(pendiente.venceEnDias)}`}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-noche-600"
      >
        <span
          aria-hidden="true"
          className={`h-10 w-1 shrink-0 rounded-full ${urgente ? "bg-naranja" : "bg-noche-500"}`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{jugador?.nombre ?? "Jugador"}</p>
          <p className="truncate text-xs text-tenue">{pendiente.tipo}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            urgente ? "bg-naranja/15 text-naranja" : "bg-noche-500 text-tenue"
          }`}
        >
          {textoVencimiento(pendiente.venceEnDias)}
        </span>
      </Link>
    </li>
  );
}

export function FilaRealizada({
  evaluacion,
  mostrarJugador = true,
}: {
  evaluacion: EvaluacionRealizada;
  mostrarJugador?: boolean;
}) {
  const jugador = jugadorPorId(evaluacion.jugadorId);
  const contenido = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {mostrarJugador ? (jugador?.nombre ?? "Jugador") : evaluacion.tipo}
        </p>
        <p className="truncate text-xs text-tenue">
          {mostrarJugador ? `${evaluacion.tipo} · ` : ""}
          {textoFecha(evaluacion.fecha)}
        </p>
      </div>
      <p className="shrink-0 font-display text-2xl font-bold leading-none">
        {puntuacionGlobal(evaluacion.notas)}
      </p>
    </>
  );
  return (
    <li>
      {mostrarJugador ? (
        <Link
          href={`/jugadores/${evaluacion.jugadorId}`}
          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-noche-600"
        >
          {contenido}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">{contenido}</div>
      )}
    </li>
  );
}
