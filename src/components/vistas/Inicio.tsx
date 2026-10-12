"use client";

import Link from "next/link";
import { jugadores } from "@/lib/demo-data";
import { useAlmacen } from "@/lib/almacen";
import { objetivoCompletado, resumenJugador } from "@/lib/dominio";
import { FilaJugador, FilaPendiente, Lista, Seccion, Vacio } from "@/components/ui";
import { FilaObjetivo } from "@/components/FilaObjetivo";

export function Inicio() {
  const { estado } = useAlmacen();
  const urgentes = estado.pendientes.filter((e) => e.venceEnDias <= 0).length;
  const activos = estado.objetivos.filter((o) => !objetivoCompletado(o));
  const destacados = jugadores
    .map((j) => ({ jugador: j, ...resumenJugador(estado, j.id) }))
    .sort((a, b) => (b.tendencia ?? -Infinity) - (a.tendencia ?? -Infinity))
    .slice(0, 3);

  const datos = [
    { valor: jugadores.length, texto: "Jugadores", href: "/demo/jugadores" },
    { valor: estado.pendientes.length, texto: "Evaluaciones pendientes", href: "/demo/evaluaciones" },
    { valor: activos.length, texto: "Objetivos activos", href: "/demo/objetivos" },
  ];

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl bg-electrico p-5 text-noche">
        <p className="text-sm font-semibold">Hola, entrenador</p>
        <h1 className="mt-1 font-display text-4xl font-extrabold uppercase italic leading-[0.95] tracking-tight sm:text-5xl">
          Observa.
          <br />
          Mide.
          <br />
          Haz crecer.
        </h1>
        {urgentes > 0 && (
          <Link
            href="/demo/evaluaciones"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-noche px-4 text-sm font-bold text-blanco"
          >
            <span className="size-2 rounded-full bg-naranja" aria-hidden="true" />
            {urgentes} {urgentes === 1 ? "evaluación urgente" : "evaluaciones urgentes"}
          </Link>
        )}
        <span
          aria-hidden="true"
          className="absolute -right-8 -top-8 size-32 rounded-full border-[14px] border-noche/10"
        />
      </section>

      <ul className="mt-4 grid grid-cols-3 gap-3">
        {datos.map((d) => (
          <li key={d.href}>
            <Link
              href={d.href}
              className="block h-full rounded-2xl bg-noche-700 p-3 ring-1 ring-noche-500 transition-colors hover:ring-electrico"
            >
              <p className="font-display text-3xl font-bold leading-none">{d.valor}</p>
              <p className="mt-1 text-xs leading-tight text-tenue">{d.texto}</p>
            </Link>
          </li>
        ))}
      </ul>

      <Seccion titulo="Evaluaciones pendientes" enlace={{ href: "/demo/evaluaciones", texto: "Ver todas" }}>
        {estado.pendientes.length > 0 ? (
          <Lista>
            {estado.pendientes.slice(0, 3).map((e) => (
              <FilaPendiente key={e.id} pendiente={e} />
            ))}
          </Lista>
        ) : (
          <Vacio>No hay evaluaciones pendientes.</Vacio>
        )}
      </Seccion>

      <Seccion titulo="Objetivos" enlace={{ href: "/demo/objetivos", texto: "Ver todos" }}>
        {activos.length > 0 ? (
          <Lista>
            {activos.slice(0, 3).map((o) => (
              <FilaObjetivo key={o.id} objetivo={o} />
            ))}
          </Lista>
        ) : (
          <Vacio>No hay objetivos activos.</Vacio>
        )}
      </Seccion>

      <Seccion titulo="Más progreso" enlace={{ href: "/demo/jugadores", texto: "Jugadores" }}>
        <Lista>
          {destacados.map((d) => (
            <FilaJugador key={d.jugador.id} jugador={d.jugador} puntuacion={d.puntuacion} tendencia={d.tendencia} />
          ))}
        </Lista>
      </Seccion>
    </>
  );
}
