"use client";

import { useState } from "react";
import { jugadores, NIVELES, POSICIONES, type Nivel, type Posicion } from "@/lib/demo-data";
import { useAlmacen } from "@/lib/almacen";
import { FILTROS_VACIOS, filtrarJugadores, resumenJugador, type Filtros } from "@/lib/dominio";
import { Cabecera, FilaJugador, Lista, Vacio } from "@/components/ui";

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`min-h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold transition-colors ${
        activo ? "bg-electrico text-noche" : "bg-noche-700 text-tenue ring-1 ring-noche-500 hover:text-blanco"
      }`}
    >
      {children}
    </button>
  );
}

export function ListaJugadores() {
  const { estado } = useAlmacen();
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const resultado = filtrarJugadores(jugadores, filtros)
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const hayFiltros = filtros.texto.trim() !== "" || filtros.nivel !== null || filtros.posicion !== null;

  const alternar = <K extends "nivel" | "posicion">(clave: K, valor: Filtros[K]) =>
    setFiltros((f) => ({ ...f, [clave]: f[clave] === valor ? null : valor }));

  return (
    <>
      <Cabecera titulo="Jugadores" subtitulo="Puntuación de la última evaluación (0–100)" />

      <div role="search" className="space-y-3">
        <label htmlFor="buscar" className="sr-only">
          Buscar jugador
        </label>
        <input
          id="buscar"
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Buscar por nombre, grupo o foco"
          value={filtros.texto}
          onChange={(e) => setFiltros((f) => ({ ...f, texto: e.target.value }))}
          className="h-12 w-full rounded-2xl bg-noche-700 px-4 text-base text-blanco ring-1 ring-noche-500 placeholder:text-tenue focus:outline-none focus:ring-2 focus:ring-electrico"
        />
        <div role="group" aria-label="Filtrar por nivel" className="flex flex-wrap gap-2">
          {NIVELES.map((n) => (
            <Chip key={n} activo={filtros.nivel === n} onClick={() => alternar("nivel", n as Nivel)}>
              {n}
            </Chip>
          ))}
        </div>
        <div role="group" aria-label="Filtrar por posición" className="flex gap-2">
          {POSICIONES.map((p) => (
            <Chip key={p} activo={filtros.posicion === p} onClick={() => alternar("posicion", p as Posicion)}>
              {p}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mb-3 mt-5 flex items-center justify-between">
        <p className="text-sm text-tenue" aria-live="polite">
          {resultado.length} {resultado.length === 1 ? "jugador" : "jugadores"}
        </p>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => setFiltros(FILTROS_VACIOS)}
            className="text-sm font-semibold text-electrico"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {resultado.length > 0 ? (
        <Lista etiqueta="Resultados">
          {resultado.map((j) => {
            const r = resumenJugador(estado, j.id);
            return <FilaJugador key={j.id} jugador={j} puntuacion={r.puntuacion} tendencia={r.tendencia} />;
          })}
        </Lista>
      ) : (
        <Vacio>Ningún jugador coincide con la búsqueda.</Vacio>
      )}
    </>
  );
}
