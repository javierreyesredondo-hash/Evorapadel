"use client";

import { CRITERIOS, ESCALA, jugadorPorId } from "@/lib/demo-data";
import { useAlmacen } from "@/lib/almacen";
import { evaluacionesDe, mediaNotas, resumenJugador } from "@/lib/dominio";
import { textoFecha, textoMedia } from "@/lib/format";
import {
  Avatar,
  EnlaceBoton,
  EtiquetaFicticio,
  FilaPendiente,
  FilaRealizada,
  Lista,
  MedidorNota,
  Seccion,
  Tendencia,
  Vacio,
} from "@/components/ui";
import { FilaObjetivo } from "@/components/FilaObjetivo";

export function FichaJugador({ id }: { id: string }) {
  const { estado } = useAlmacen();
  const jugador = jugadorPorId(id);
  if (!jugador) return null;

  const resumen = resumenJugador(estado, id);
  const historial = evaluacionesDe(estado, id);
  const pendientes = estado.pendientes.filter((p) => p.jugadorId === id);
  const objetivos = estado.objetivos.filter((o) => o.jugadorId === id);
  const ultima = resumen.ultima;

  return (
    <>
      <header className="flex items-center gap-4">
        <Avatar nombre={jugador.nombre} grande />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-extrabold uppercase italic leading-none tracking-tight">
              {jugador.nombre}
            </h1>
            <EtiquetaFicticio />
          </div>
          <p className="mt-1.5 text-sm text-tenue">
            {jugador.nivel} · {jugador.posicion} · {jugador.grupo}
          </p>
        </div>
      </header>

      <dl className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-noche-700 p-3 ring-1 ring-noche-500">
          <dt className="text-xs text-tenue">
            Puntuación <span className="sr-only">(de 20 a 100)</span>
          </dt>
          <dd className="mt-1 font-display text-3xl font-bold leading-none">{resumen.puntuacion ?? "—"}</dd>
        </div>
        <div className="rounded-2xl bg-noche-700 p-3 ring-1 ring-noche-500">
          <dt className="text-xs text-tenue">Tendencia</dt>
          <dd className="mt-2 [&>span]:justify-start [&>span]:text-base">
            <Tendencia valor={resumen.tendencia} />
          </dd>
        </div>
        <div className="rounded-2xl bg-noche-700 p-3 ring-1 ring-noche-500">
          <dt className="text-xs text-tenue">Evaluaciones</dt>
          <dd className="mt-1 font-display text-3xl font-bold leading-none">{resumen.total}</dd>
        </div>
      </dl>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl bg-noche-700 p-4 text-sm ring-1 ring-noche-500 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-tenue">Edad</dt>
          <dd className="font-semibold">{jugador.edad} años</dd>
        </div>
        <div>
          <dt className="text-xs text-tenue">Mano</dt>
          <dd className="font-semibold">{jugador.mano}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-tenue">Foco actual</dt>
          <dd className="font-semibold">{jugador.foco}</dd>
        </div>
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <EnlaceBoton href={`/evaluaciones/nueva?jugador=${id}`}>Evaluar</EnlaceBoton>
        <EnlaceBoton href={`/objetivos/nuevo?jugador=${id}`} variante="secundario">
          Nuevo objetivo
        </EnlaceBoton>
      </div>

      <Seccion titulo="Última evaluación">
        {ultima ? (
          <div className="rounded-2xl bg-noche-700 p-4 ring-1 ring-noche-500">
            <p className="text-sm text-tenue">
              {ultima.tipo} · {textoFecha(ultima.fecha)} · Media{" "}
              <span className="font-semibold text-blanco">{textoMedia(mediaNotas(ultima.notas) ?? 0)}</span>
            </p>
            <ul className="mt-3 space-y-2.5" aria-label="Notas por criterio">
              {CRITERIOS.map((c) => {
                const nota = ultima.notas[c.id];
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{c.nombre}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <MedidorNota nota={nota} />
                      <span className="text-right text-xs text-tenue sm:w-24">
                        <span className="font-bold text-blanco">{nota}</span>
                        <span className="hidden sm:inline"> · {ESCALA[nota]}</span>
                        <span className="sr-only sm:hidden"> · {ESCALA[nota]}</span>
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {ultima.comentario && (
              <p className="mt-3 border-t border-noche-500 pt-3 text-sm text-tenue">«{ultima.comentario}»</p>
            )}
          </div>
        ) : (
          <Vacio>Todavía no hay evaluaciones.</Vacio>
        )}
      </Seccion>

      <Seccion titulo="Objetivos">
        {objetivos.length > 0 ? (
          <Lista etiqueta="Objetivos del jugador">
            {objetivos.map((o) => (
              <FilaObjetivo key={o.id} objetivo={o} mostrarJugador={false} />
            ))}
          </Lista>
        ) : (
          <Vacio>Sin objetivos. Crea el primero con «Nuevo objetivo».</Vacio>
        )}
      </Seccion>

      {pendientes.length > 0 && (
        <Seccion titulo="Pendiente">
          <Lista>
            {pendientes.map((p) => (
              <FilaPendiente key={p.id} pendiente={p} />
            ))}
          </Lista>
        </Seccion>
      )}

      <Seccion titulo="Historial">
        {historial.length > 0 ? (
          <Lista etiqueta="Historial de evaluaciones">
            {historial.map((e) => (
              <FilaRealizada key={e.id} evaluacion={e} mostrarJugador={false} />
            ))}
          </Lista>
        ) : (
          <Vacio>Sin evaluaciones registradas.</Vacio>
        )}
      </Seccion>
    </>
  );
}
