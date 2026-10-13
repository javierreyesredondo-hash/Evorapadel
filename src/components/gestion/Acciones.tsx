"use client";

import { useId, useState, useTransition } from "react";
import {
  asignarJugador,
  cambiarEstadoJugador,
  desasignarJugador,
  type ResultadoAccion,
} from "@/app/acciones-gestion";
import { claseBoton } from "@/components/ui";
import { claseCampo } from "@/components/campos";
import { useAvisos } from "@/components/gestion/Avisos";

/**
 * Ejecuta una Server Action sin formulario: un solo envío a la vez (el botón
 * se desactiva mientras tanto), confirmación con aviso y error en español.
 */
export function useAccion() {
  const { avisar } = useAvisos();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ejecutar(accion: () => Promise<ResultadoAccion>, alTerminar?: () => void) {
    if (pendiente) return;
    setError(null);
    iniciar(async () => {
      try {
        const r = await accion();
        if (r.ok) {
          avisar(r.mensaje);
          alTerminar?.();
        } else {
          setError(r.error);
        }
      } catch {
        setError("No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo.");
      }
    });
  }
  return { pendiente, error, ejecutar };
}

export function ErrorAccion({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-2 text-sm font-semibold text-naranja">
      {error}
    </p>
  );
}

/** Archivar (con confirmación) o reactivar un jugador. */
export function BotonEstadoJugador({ id, nombre, activo }: { id: string; nombre: string; activo: boolean }) {
  const { pendiente, error, ejecutar } = useAccion();
  return (
    <div>
      <button
        type="button"
        disabled={pendiente}
        className={claseBoton.secundario}
        onClick={() => {
          if (activo && !window.confirm(`¿Archivar a ${nombre}? Dejará de aparecer en la lista de activos. Podrás reactivarlo.`)) return;
          ejecutar(() => cambiarEstadoJugador(id, !activo));
        }}
      >
        {pendiente ? "Guardando…" : activo ? "Archivar" : "Reactivar"}
      </button>
      <ErrorAccion error={error} />
    </div>
  );
}

/** Quitar un jugador de un grupo. */
export function BotonQuitar({ grupoId, jugadorId, etiqueta }: { grupoId: string; jugadorId: string; etiqueta: string }) {
  const { pendiente, error, ejecutar } = useAccion();
  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={pendiente}
        aria-label={etiqueta}
        onClick={() => ejecutar(() => desasignarJugador(grupoId, jugadorId))}
        className="-my-2 inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-naranja hover:bg-noche-600 disabled:opacity-40"
      >
        {pendiente ? "Quitando…" : "Quitar"}
      </button>
      <ErrorAccion error={error} />
    </div>
  );
}

/**
 * Selector + botón para asignar. Desde la ficha se elige grupo; desde el grupo,
 * jugador. `fijo` es el id que no cambia (el jugador o el grupo de la pantalla).
 */
export function Asignar({
  modo,
  fijo,
  opciones,
}: {
  modo: "grupo" | "jugador";
  fijo: string;
  opciones: { id: string; nombre: string }[];
}) {
  const { pendiente, error, ejecutar } = useAccion();
  const [elegido, setElegido] = useState("");
  const id = useId();
  const etiqueta = modo === "grupo" ? "Añadir a un grupo" : "Añadir jugador al grupo";

  if (opciones.length === 0) {
    return (
      <p className="text-sm text-tenue">
        {modo === "grupo" ? "Ya está en todos los grupos de la escuela." : "No quedan jugadores activos por añadir."}
      </p>
    );
  }

  return (
    <div>
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (!elegido) return;
        const [grupoId, jugadorId] = modo === "grupo" ? [elegido, fijo] : [fijo, elegido];
        ejecutar(() => asignarJugador(grupoId, jugadorId), () => setElegido(""));
      }}
    >
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
          {etiqueta}
        </label>
        <select id={id} value={elegido} onChange={(e) => setElegido(e.target.value)} className={claseCampo}>
          <option value="">{modo === "grupo" ? "Elige un grupo…" : "Elige un jugador…"}</option>
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pendiente || !elegido} className={claseBoton.primario}>
        {pendiente ? "Añadiendo…" : "Añadir"}
      </button>
    </form>
    <ErrorAccion error={error} />
    </div>
  );
}
