"use client";

import Link from "next/link";
import { useState } from "react";
import {
  filtrarJugadoresReales,
  NIVEL_TEXTO,
  NIVELES_BD,
  resumenJugadorReal,
  type JugadorReal,
  type NivelBD,
} from "@/lib/gestion";
import { Avatar, Lista, Vacio } from "@/components/ui";

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors ${
        activo ? "bg-electrico text-noche" : "bg-noche-700 text-tenue ring-1 ring-noche-500 hover:text-blanco"
      }`}
    >
      {children}
    </button>
  );
}

export function ListaJugadoresReales({ jugadores, hoy }: { jugadores: JugadorReal[]; hoy: string }) {
  const [texto, setTexto] = useState("");
  const [nivel, setNivel] = useState<NivelBD | null>(null);
  const [estado, setEstado] = useState<"activos" | "archivados">("activos");
  const resultado = filtrarJugadoresReales(jugadores, { texto, nivel, estado });
  const archivados = jugadores.filter((j) => !j.activo).length;

  if (jugadores.length === 0) {
    return <Vacio>Tu escuela todavía no tiene jugadores. Crea el primero con «Nuevo».</Vacio>;
  }

  return (
    <>
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
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="h-12 w-full rounded-2xl bg-noche-700 px-4 text-base text-blanco ring-1 ring-noche-500 placeholder:text-tenue focus:outline-none focus:ring-2 focus:ring-electrico"
        />
        <div role="group" aria-label="Filtrar por nivel" className="flex flex-wrap gap-2">
          {NIVELES_BD.map((n) => (
            <Chip key={n} activo={nivel === n} onClick={() => setNivel((a) => (a === n ? null : n))}>
              {NIVEL_TEXTO[n]}
            </Chip>
          ))}
        </div>
        <div role="group" aria-label="Estado" className="flex gap-2">
          <Chip activo={estado === "activos"} onClick={() => setEstado("activos")}>
            Activos
          </Chip>
          <Chip activo={estado === "archivados"} onClick={() => setEstado("archivados")}>
            {`Archivados (${archivados})`}
          </Chip>
        </div>
      </div>

      <p className="mb-3 mt-5 text-sm text-tenue" aria-live="polite">
        {resultado.length} {resultado.length === 1 ? "jugador" : "jugadores"}
      </p>

      {resultado.length > 0 ? (
        <Lista etiqueta="Jugadores de tu escuela">
          {resultado.map((j) => (
            <li key={j.id}>
              <Link href={`/jugadores/${j.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-noche-600">
                <Avatar nombre={j.nombre} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{j.nombre}</p>
                  <p className="truncate text-xs text-tenue">
                    {resumenJugadorReal(j, hoy)}
                    {j.grupos.length > 0 && <> · {j.grupos.map((g) => g.nombre).join(", ")}</>}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </Lista>
      ) : (
        <Vacio>Ningún jugador coincide con la búsqueda.</Vacio>
      )}
    </>
  );
}
