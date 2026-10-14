"use client";

import { useState } from "react";
import { LIMITES_REDACCION, type Redaccion } from "@/lib/redaccion";
import { claseCampo } from "@/components/campos";

// Propuesta automática de fortalezas, aspectos a mejorar e interpretación
// técnica, editable antes de guardar. Mientras el entrenador/a no toca un
// apartado, sigue a las puntuaciones; en cuanto lo edita, se respeta su texto
// (y puede volver a la propuesta con un botón).

export type CampoRedaccion = "fortalezas" | "mejoras" | "interpretacion";
const CAMPOS: readonly [CampoRedaccion, string, number][] = [
  ["fortalezas", "Fortalezas", 4],
  ["mejoras", "Aspectos a mejorar", 4],
  ["interpretacion", "Interpretación técnica", 5],
];

/**
 * Textos de la redacción: los editados por el entrenador/a o, si no, la
 * propuesta. `inicial` (al editar una evaluación guardada) cuenta como editado,
 * aunque esté vacío: lo guardado nunca se sustituye solo.
 */
export function useRedaccion(propuesta: Redaccion, inicial?: Partial<Record<CampoRedaccion, string>>) {
  const [propios, setPropios] = useState<Partial<Record<CampoRedaccion, string>>>(() =>
    Object.fromEntries(Object.entries(inicial ?? {}).filter(([, v]) => v !== undefined)),
  );
  const valores = {
    fortalezas: propios.fortalezas ?? propuesta.fortalezas,
    mejoras: propios.mejoras ?? propuesta.mejoras,
    interpretacion: propios.interpretacion ?? propuesta.interpretacion,
  };
  return {
    valores,
    editado: (c: CampoRedaccion) => propios[c] !== undefined,
    cambiar: (c: CampoRedaccion, v: string) => setPropios((p) => ({ ...p, [c]: v })),
    restablecer: (c: CampoRedaccion) =>
      setPropios((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== c))),
    /** Propuesta mostrada (se guarda aparte para distinguirla de lo aprobado). */
    propuestaJson: JSON.stringify({
      version: propuesta.version,
      fortalezas: propuesta.fortalezas,
      mejoras: propuesta.mejoras,
      interpretacion: propuesta.interpretacion,
      provisional: propuesta.provisional,
    }),
  };
}

export function PropuestaInforme({
  propuesta,
  redaccion,
  prefijo,
  errores,
}: {
  propuesta: Redaccion;
  redaccion: ReturnType<typeof useRedaccion>;
  prefijo: string;
  errores?: Partial<Record<CampoRedaccion, string>>;
}) {
  return (
    <section aria-labelledby={`${prefijo}-propuesta`} className="space-y-3">
      <div>
        <h2 id={`${prefijo}-propuesta`} className="font-display text-xl font-bold uppercase italic">
          Propuesta de informe
        </h2>
        <p className="mt-1 text-xs text-tenue">
          <span className="mr-1 inline-block rounded-full bg-noche-600 px-2 py-0.5 font-bold text-blanco">Generado</span>
          A partir de las puntuaciones y de la escala de la metodología, en tu dispositivo (no se envía a ningún servicio
          externo). Revísalo y corrígelo: se guarda lo que veas aquí.
        </p>
        {propuesta.provisional && propuesta.perfil !== "sin-datos" && (
          <p role="note" className="mt-2 rounded-xl border border-naranja/40 bg-naranja/10 px-3 py-2 text-xs font-semibold text-naranja">
            Propuesta provisional: no están puntuadas todas las competencias.
          </p>
        )}
      </div>
      {CAMPOS.map(([campo, etiqueta, filas]) => {
        const id = `${prefijo}-${campo}`;
        const valor = redaccion.valores[campo];
        const error = errores?.[campo];
        return (
          <div key={campo}>
            <div className="mb-1.5 flex items-end justify-between gap-3">
              <label htmlFor={id} className="text-sm font-semibold">
                {etiqueta}
                <span className="ml-2 text-xs font-normal text-tenue">{redaccion.editado(campo) ? "editado por ti" : "propuesta automática"}</span>
              </label>
              {redaccion.editado(campo) && (
                <button
                  type="button"
                  onClick={() => redaccion.restablecer(campo)}
                  className="-my-2 inline-flex min-h-11 shrink-0 items-center text-xs font-semibold text-electrico"
                >
                  Volver a la propuesta
                </button>
              )}
            </div>
            <textarea
              id={id}
              name={campo}
              rows={filas}
              value={valor}
              maxLength={LIMITES_REDACCION[campo]}
              placeholder={campo === "interpretacion" ? "" : "Sin datos suficientes para proponerlo."}
              onChange={(e) => redaccion.cambiar(campo, e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className={`${claseCampo} h-auto py-3 text-sm`}
            />
            {error && (
              <p id={`${id}-error`} className="mt-1 text-xs font-semibold text-naranja">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
