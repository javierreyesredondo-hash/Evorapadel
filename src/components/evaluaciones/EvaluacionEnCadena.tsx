"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { guardarEvaluacionCadena, type EntradaCadena } from "@/app/acciones-evaluaciones";
import { siguientePendiente, type EstadoCadena } from "@/lib/cadena";
import { LIMITES_EVALUACION, type Competencia, type Nota } from "@/lib/evaluaciones";
import { etiquetaGrupo } from "@/lib/metodologia";
import { generarRedaccion, type EscalaDescrita } from "@/lib/redaccion";
import { claseBoton } from "@/components/ui";
import { claseCampo } from "@/components/campos";
import { useAvisos } from "@/components/gestion/Avisos";
import { PropuestaInforme, useRedaccion } from "@/components/evaluaciones/PropuestaInforme";

// Evaluación en cadena de un grupo, pensada para el móvil durante el
// entrenamiento: un jugador cada vez, guardar y pasar al siguiente pendiente.
// El progreso sale siempre de la base de datos (se puede salir y volver).

const NOTAS = [1, 2, 3, 4, 5] as const;

type Props = {
  grupo: { id: string; nombre: string };
  estado: EstadoCadena;
  actualId: string | null;
  competencias: Competencia[];
  escala: EscalaDescrita;
  /** Evaluaciones de hoy que el usuario puede editar (autor o dirección). */
  editables: string[];
  metodologia: { nombre: string; version: string } | null;
};

const url = (grupoId: string, jugadorId?: string) => `/entrenamiento/evaluar/${grupoId}${jugadorId ? `?jugador=${jugadorId}` : ""}`;

export function EvaluacionEnCadena(props: Props) {
  const { grupo, estado, actualId } = props;
  const actual = estado.jugadores.find((j) => j.id === actualId) ?? null;
  const porcentaje = estado.total ? Math.round((estado.evaluados / estado.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-noche-700 p-4 ring-1 ring-noche-500">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">
            Evaluados hoy: <span className="text-electrico">{estado.evaluados}</span> de {estado.total}
          </p>
          {props.metodologia && (
            <p className="truncate text-xs text-tenue">
              {props.metodologia.nombre} · v{props.metodologia.version}
            </p>
          )}
        </div>
        <div
          role="progressbar"
          aria-label={`Progreso del grupo ${grupo.nombre}`}
          aria-valuemin={0}
          aria-valuemax={estado.total}
          aria-valuenow={estado.evaluados}
          className="mt-2 h-2 overflow-hidden rounded-full bg-noche-500"
        >
          <div className="h-full rounded-full bg-electrico transition-all" style={{ width: `${porcentaje}%` }} />
        </div>
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold text-electrico">Jugadores del grupo</summary>
          <ul aria-label={`Jugadores de ${grupo.nombre}`} className="mt-1 divide-y divide-noche-500">
            {estado.jugadores.map((j) => (
              <li key={j.id}>
                <Link
                  href={url(grupo.id, j.id)}
                  aria-current={j.id === actualId ? "step" : undefined}
                  className="flex min-h-11 items-center justify-between gap-3 py-1 hover:text-electrico"
                >
                  <span className="min-w-0 truncate font-semibold">{j.nombre}</span>
                  <span className={`shrink-0 text-xs font-bold ${j.evaluacion ? "text-electrico" : j.id === actualId ? "text-blanco" : "text-tenue"}`}>
                    {j.evaluacion ? "Evaluado ✓" : j.id === actualId ? "Ahora" : "Pendiente"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>

      {!actual ? (
        <Completado grupo={grupo} estado={estado} />
      ) : actual.evaluacion ? (
        <YaEvaluado {...props} jugador={actual} evaluacion={actual.evaluacion} />
      ) : (
        <FormularioJugador key={actual.id} {...props} jugador={actual} />
      )}
    </div>
  );
}

function Completado({ grupo, estado }: Pick<Props, "grupo" | "estado">) {
  return (
    <section aria-labelledby="cadena-completada" className="rounded-2xl bg-noche-700 p-5 text-center ring-1 ring-noche-500">
      <h2 id="cadena-completada" className="font-display text-2xl font-extrabold uppercase italic">
        {estado.total === 0 ? "Sin jugadores activos" : "Grupo evaluado"}
      </h2>
      <p className="mt-2 text-sm text-tenue">
        {estado.total === 0
          ? `El grupo ${grupo.nombre} no tiene jugadores activos.`
          : `Has completado las evaluaciones de hoy de ${grupo.nombre}. Puedes abrir cualquier jugador para verla o editarla.`}
      </p>
      <Link href="/entrenamiento" className={`${claseBoton.secundario} mt-4`}>
        Volver a mi entrenamiento
      </Link>
    </section>
  );
}

function YaEvaluado({
  grupo,
  estado,
  editables,
  jugador,
  evaluacion,
}: Props & { jugador: EstadoCadena["jugadores"][number]; evaluacion: NonNullable<EstadoCadena["jugadores"][number]["evaluacion"]> }) {
  const siguiente = siguientePendiente(estado, jugador.id);
  return (
    <section aria-labelledby="ya-evaluado" className="space-y-3 rounded-2xl bg-noche-700 p-4 ring-1 ring-noche-500">
      <h2 id="ya-evaluado" className="font-display text-2xl font-extrabold uppercase italic">
        {jugador.nombre}
      </h2>
      <p className="text-sm">
        Ya tiene una evaluación de hoy en este grupo ({evaluacion.numeroNotas} {evaluacion.numeroNotas === 1 ? "competencia" : "competencias"}). No se
        crea otra: puedes verla{editables.includes(evaluacion.id) ? " o editarla" : ""}.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href={`/evaluaciones/${evaluacion.id}`} className={claseBoton.secundario}>
          Ver evaluación
        </Link>
        {editables.includes(evaluacion.id) && (
          <Link href={`/evaluaciones/${evaluacion.id}/editar`} className={claseBoton.secundario}>
            Editar evaluación
          </Link>
        )}
        {siguiente && (
          <Link href={url(grupo.id, siguiente.id)} className={claseBoton.primario}>
            Siguiente: {siguiente.nombre}
          </Link>
        )}
      </div>
    </section>
  );
}

/** Identificador del envío: el mismo en todos los reintentos de este jugador. */
function nuevaClave(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

type Envio =
  | { estado: "editando" }
  | { estado: "guardando" }
  | { estado: "guardado"; id: string }
  | { estado: "error"; mensaje: string; red: boolean; existente?: { id: string } };

function FormularioJugador({ grupo, estado, competencias, escala, jugador }: Props & { jugador: EstadoCadena["jugadores"][number] }) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const claveRef = useRef<string | null>(null);
  const resultadoRef = useRef<HTMLDivElement>(null);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [envio, setEnvio] = useState<Envio>({ estado: "editando" });

  const puntuadas = competencias.filter((c) => notas[c.id]);
  const propuesta = useMemo(
    () =>
      generarRedaccion({
        notas: competencias.filter((c) => notas[c.id]).map((c) => ({
          nombre: c.nombre,
          grupo: c.grupo ?? null,
          descripcion: c.descripcion,
          orden: c.orden,
          puntuacion: Number(notas[c.id]) as Nota,
        })),
        totalCompetencias: competencias.length,
        escala,
        observaciones,
        objetivo,
      }),
    [notas, competencias, escala, observaciones, objetivo],
  );
  const redaccion = useRedaccion(propuesta);
  const guardado = envio.estado === "guardado";
  const sucio = puntuadas.length > 0 || observaciones !== "" || objetivo !== "";
  const siguiente = siguientePendiente(estado, jugador.id, guardado ? [jugador.id] : []);

  // Aviso del navegador si se sale con datos sin guardar.
  useEffect(() => {
    if (!sucio || guardado) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sucio, guardado]);

  useEffect(() => {
    if (envio.estado === "guardado" || envio.estado === "error") resultadoRef.current?.focus();
  }, [envio.estado]);

  async function guardar() {
    if (envio.estado === "guardando" || guardado) return;
    if (puntuadas.length === 0) {
      setEnvio({ estado: "error", mensaje: "Puntúa al menos una competencia.", red: false });
      return;
    }
    claveRef.current ??= nuevaClave();
    const entrada: EntradaCadena = {
      grupoId: grupo.id,
      jugadorId: jugador.id,
      clave: claveRef.current,
      notas,
      observaciones,
      objetivo,
      ...redaccion.valores,
      propuesta: redaccion.propuestaJson,
    };
    setEnvio({ estado: "guardando" });
    try {
      const r = await guardarEvaluacionCadena(entrada);
      if (r.ok) {
        setEnvio({ estado: "guardado", id: r.id });
        avisar(`Evaluación de ${jugador.nombre} guardada.`);
      } else {
        setEnvio({ estado: "error", mensaje: r.error, red: false, existente: r.existente });
      }
    } catch {
      setEnvio({
        estado: "error",
        mensaje: "No se ha podido conectar. La evaluación todavía no se ha guardado; tus datos siguen aquí.",
        red: true,
      });
    }
  }

  function irA(jugadorId?: string) {
    if (sucio && !guardado && !window.confirm(`Hay datos de ${jugador.nombre} sin guardar. ¿Salir sin guardarlos?`)) return;
    router.push(url(grupo.id, jugadorId));
  }

  if (guardado) {
    return (
      <section ref={resultadoRef} tabIndex={-1} aria-labelledby="guardado-titulo" className="space-y-4 rounded-2xl bg-noche-700 p-5 ring-1 ring-electrico focus:outline-none">
        <h2 id="guardado-titulo" className="font-display text-2xl font-extrabold uppercase italic text-electrico">
          ✓ Guardada
        </h2>
        <p className="text-sm">
          La evaluación de <strong>{jugador.nombre}</strong> está guardada en tu escuela ({puntuadas.length}{" "}
          {puntuadas.length === 1 ? "competencia" : "competencias"}).
        </p>
        {siguiente ? (
          <button type="button" onClick={() => router.push(url(grupo.id, siguiente.id))} className={`${claseBoton.primario} w-full`}>
            Siguiente: {siguiente.nombre}
          </button>
        ) : (
          <button type="button" onClick={() => router.push(url(grupo.id))} className={`${claseBoton.primario} w-full`}>
            Terminar el grupo
          </button>
        )}
        <Link href={`/evaluaciones/${envio.id}`} className={`${claseBoton.secundario} w-full`}>
          Ver evaluación e informe
        </Link>
      </section>
    );
  }

  const enviando = envio.estado === "guardando";
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-tenue">Evaluando a</p>
          <h2 className="truncate font-display text-3xl font-extrabold uppercase italic leading-tight">{jugador.nombre}</h2>
        </div>
        {siguientePendiente(estado, jugador.id) && (
          <button type="button" onClick={() => irA(siguientePendiente(estado, jugador.id)?.id)} className="inline-flex min-h-11 shrink-0 items-center px-2 text-sm font-semibold text-tenue">
            Saltar
          </button>
        )}
      </header>

      <section aria-labelledby="cadena-notas" className="space-y-3">
        <div>
          <h2 id="cadena-notas" className="font-display text-xl font-bold uppercase italic">
            Puntuaciones
          </h2>
          <p className="text-xs text-tenue">Puntúa de 1 a 5 lo que hayas observado; las que dejes sin puntuar no cuentan.</p>
          <details className="mt-1 text-xs">
            <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-electrico">Ver la escala</summary>
            <dl className="space-y-1 pb-2">
              {NOTAS.map((n) => (
                <div key={n}>
                  <dt className="inline font-bold">
                    {n} · {escala[n].nombre}
                  </dt>
                  {escala[n].descripcion && <dd className="inline text-tenue">: {escala[n].descripcion}</dd>}
                </div>
              ))}
            </dl>
          </details>
        </div>
        {competencias.map((c) => {
          const valor = notas[c.id] ?? "";
          return (
            <fieldset key={c.id} role="radiogroup" aria-labelledby={`cad-${c.id}`} className="rounded-2xl bg-noche-700 p-3 ring-1 ring-noche-500">
              <legend id={`cad-${c.id}`} className="sr-only">
                {c.nombre}
              </legend>
              <div aria-hidden="true" className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{c.nombre}</span>
                <span className="shrink-0 text-xs text-tenue">{valor ? `${valor} · ${escala[Number(valor) as Nota].nombre}` : etiquetaGrupo(c)}</span>
              </div>
              {c.descripcion && <p className="mt-0.5 text-xs text-tenue">{c.descripcion}</p>}
              <div className="mt-2 grid grid-cols-5 gap-2">
                {NOTAS.map((n) => (
                  <label key={n} className="relative">
                    <input
                      type="radio"
                      name={`cad_${c.id}`}
                      value={n}
                      checked={valor === String(n)}
                      disabled={enviando}
                      onChange={() => setNotas((p) => ({ ...p, [c.id]: String(n) }))}
                      // Tocar la nota elegida otra vez la quita.
                      onClick={() => valor === String(n) && setNotas((p) => ({ ...p, [c.id]: "" }))}
                      aria-label={`${c.nombre}: ${n} (${escala[n].nombre})`}
                      className="peer absolute inset-0 size-full cursor-pointer opacity-0"
                    />
                    <span
                      aria-hidden="true"
                      className="grid h-12 place-items-center rounded-xl bg-noche-600 font-display text-xl font-bold text-tenue transition-colors peer-checked:bg-electrico peer-checked:text-noche peer-focus-visible:ring-2 peer-focus-visible:ring-blanco"
                    >
                      {n}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </section>

      <section aria-labelledby="cadena-entrenador" className="space-y-4">
        <div>
          <h2 id="cadena-entrenador" className="font-display text-xl font-bold uppercase italic">
            Tus notas (opcional)
          </h2>
          <p className="text-xs text-tenue">Lo único que tienes que escribir. Se guarda tal cual.</p>
        </div>
        <div>
          <label htmlFor="cad-observaciones" className="mb-1.5 block text-sm font-semibold">
            Observaciones del entrenador/a
          </label>
          <textarea
            id="cad-observaciones"
            rows={3}
            value={observaciones}
            maxLength={LIMITES_EVALUACION.observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className={`${claseCampo} h-auto py-3`}
          />
        </div>
        <div>
          <label htmlFor="cad-objetivo" className="mb-1.5 block text-sm font-semibold">
            Objetivo de trabajo
          </label>
          <input
            id="cad-objetivo"
            type="text"
            autoComplete="off"
            value={objetivo}
            maxLength={LIMITES_EVALUACION.objetivo.max}
            onChange={(e) => setObjetivo(e.target.value)}
            className={claseCampo}
          />
        </div>
      </section>

      <PropuestaInforme propuesta={propuesta} redaccion={redaccion} prefijo="cad" />

      {envio.estado === "error" && (
        <div ref={resultadoRef} tabIndex={-1} role="alert" className="space-y-3 rounded-2xl border border-naranja/40 bg-naranja/10 p-4 text-sm focus:outline-none">
          <p className="font-semibold text-naranja">{envio.mensaje}</p>
          {envio.existente && (
            <div className="flex flex-wrap gap-3">
              <Link href={`/evaluaciones/${envio.existente.id}`} className={claseBoton.secundario}>
                Ver la evaluación de hoy
              </Link>
              <Link href={`/evaluaciones/${envio.existente.id}/editar`} className={claseBoton.secundario}>
                Editarla
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-4 border-t border-noche-500 bg-noche/95 px-4 py-3 backdrop-blur md:bottom-0">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-xs leading-snug text-tenue sm:text-sm" aria-live="polite">
            {puntuadas.length}/{competencias.length} puntuadas
          </p>
          <button type="button" onClick={guardar} disabled={enviando || !!(envio.estado === "error" && envio.existente)} className={`${claseBoton.primario} shrink-0 whitespace-nowrap`}>
            {enviando ? "Guardando…" : envio.estado === "error" && envio.red ? "Reintentar" : "Guardar evaluación"}
          </button>
        </div>
      </div>
    </div>
  );
}
