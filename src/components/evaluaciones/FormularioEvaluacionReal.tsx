"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { guardarEvaluacion } from "@/app/acciones-evaluaciones";
import type { EstadoFormulario } from "@/app/acciones-gestion";
import {
  LIMITES_EVALUACION,
  media,
  textoMediaEvaluacion,
  TIPO_AYUDA,
  TIPO_TEXTO,
  type Competencia,
  type ObjetivoEvaluacion,
  type TipoEvaluacion,
} from "@/lib/evaluaciones";
import { ESCALA_NOTAS, etiquetaGrupo, type Escala } from "@/lib/metodologia";
import { escalaDescrita, generarRedaccion, type EscalaDescrita } from "@/lib/redaccion";
import { PropuestaInforme, useRedaccion } from "@/components/evaluaciones/PropuestaInforme";
import { claseBoton } from "@/components/ui";
import { Campo, claseCampo, MensajeError } from "@/components/campos";
import { useTrasGuardar } from "@/components/gestion/useTrasGuardar";

export type JugadorEvaluable = { id: string; nombre: string; grupos: { id: string; nombre: string }[] };

export type InicialEvaluacion = {
  id?: string;
  jugadorId: string;
  tipo: TipoEvaluacion;
  fecha: string;
  grupoId: string;
  titulo: string;
  fortalezas: string;
  mejoras: string;
  interpretacion: string;
  observaciones: string;
  notas: Record<string, string>;
  objetivos: ObjetivoEvaluacion[];
};

type Props = {
  /** Alta: jugadores activos para elegir. Edición: solo el de la evaluación. */
  jugadores: JugadorEvaluable[];
  competencias: Competencia[];
  inicial: InicialEvaluacion;
  hoy: string;
  /** Escala de la metodología con la que se evalúa (por defecto, la de ÉVORA). */
  escala?: Escala;
  /** La misma escala con las descripciones de cada nivel (para la propuesta de informe). */
  niveles?: EscalaDescrita;
};

const NOTAS = [1, 2, 3, 4, 5] as const;

/** Identificador único del envío (evita duplicados si se reenvía). */
function nuevaClave(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function FormularioEvaluacionReal(props: Props) {
  // Cambiar la clave da un formulario nuevo (ver useTrasGuardar).
  const [version, setVersion] = useState(0);
  return <Formulario key={version} {...props} reiniciar={() => setVersion((v) => v + 1)} />;
}

function Formulario({ jugadores, competencias, inicial, hoy, escala = ESCALA_NOTAS, niveles, reiniciar }: Props & { reiniciar: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const claveRef = useRef<string | null>(null);
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(guardarEvaluacion, {});
  useTrasGuardar(estado, "/evaluaciones/", formRef, reiniciar);

  const editando = !!inicial.id;
  const [jugadorId, setJugadorId] = useState(inicial.jugadorId);
  const [grupoId, setGrupoId] = useState(inicial.grupoId);
  const [tipo, setTipo] = useState<TipoEvaluacion>(inicial.tipo);
  // Todo controlado: React reinicia los campos no controlados tras cada envío.
  const [fecha, setFecha] = useState(inicial.fecha);
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [notas, setNotas] = useState<Record<string, string>>(inicial.notas);
  const [objetivos, setObjetivos] = useState<ObjetivoEvaluacion[]>(
    inicial.objetivos.length > 0 ? inicial.objetivos : [{ descripcion: "", plazo: null }],
  );
  const [observaciones, setObservaciones] = useState(inicial.observaciones);
  const escalaConNiveles = useMemo(() => niveles ?? escalaDescrita(escala), [niveles, escala]);
  const propuesta = useMemo(
    () =>
      generarRedaccion({
        notas: competencias
          .filter((c) => notas[c.id])
          .map((c) => ({ nombre: c.nombre, grupo: c.grupo ?? null, descripcion: c.descripcion, orden: c.orden, puntuacion: Number(notas[c.id]) as 1 })),
        totalCompetencias: tipo === "completa" ? competencias.filter((c) => c.activa).length : competencias.length,
        escala: escalaConNiveles,
        observaciones,
        objetivo: objetivos[0]?.descripcion,
      }),
    [competencias, notas, tipo, escalaConNiveles, observaciones, objetivos],
  );
  // Al editar, lo guardado se respeta (no se sustituye por la propuesta).
  const redaccion = useRedaccion(
    propuesta,
    editando ? { fortalezas: inicial.fortalezas, mejoras: inicial.mejoras, interpretacion: inicial.interpretacion } : undefined,
  );

  const jugador = jugadores.find((j) => j.id === jugadorId);
  const err = (campo: string) => estado.errores?.[campo];
  const invalido = (campo: string) => ({
    "aria-invalid": !!err(campo),
    "aria-describedby": err(campo) ? `${campo}-error` : undefined,
  });
  const puntuadas = competencias.filter((c) => notas[c.id]);
  const mediaActual = media(puntuadas.map((c) => ({ puntuacion: Number(notas[c.id]) })));
  const activas = competencias.filter((c) => c.activa).length;
  const bloqueado = pendiente || !!estado.ok;

  function enviar(datos: FormData) {
    // La misma clave para todos los reenvíos de ESTE formulario: si el primero
    // llegó a guardarse, la base de datos devuelve esa evaluación en vez de duplicarla.
    claveRef.current ??= nuevaClave();
    datos.set("clave_envio", claveRef.current);
    accion(datos);
  }

  return (
    <form ref={formRef} action={enviar} noValidate className="space-y-5">
      {editando && <input type="hidden" name="id" value={inicial.id} />}

      {editando ? (
        <p className="rounded-2xl bg-noche-700 px-4 py-3 text-sm ring-1 ring-noche-500">
          Jugador: <strong>{jugador?.nombre}</strong>
        </p>
      ) : (
        <Campo id="jugador" etiqueta="Jugador" error={err("jugador")}>
          <select
            id="jugador"
            name="jugador"
            value={jugadorId}
            onChange={(e) => {
              setJugadorId(e.target.value);
              setGrupoId(jugadores.find((j) => j.id === e.target.value)?.grupos[0]?.id ?? "");
            }}
            className={claseCampo}
            {...invalido("jugador")}
          >
            <option value="">Elige un jugador…</option>
            {jugadores.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nombre}
              </option>
            ))}
          </select>
        </Campo>
      )}

      <Campo id="grupo" etiqueta="Grupo" error={err("grupo")} ayuda={jugador && jugador.grupos.length === 0 ? "Este jugador no está en ningún grupo." : undefined}>
        <select id="grupo" name="grupo" value={grupoId} onChange={(e) => setGrupoId(e.target.value)} className={claseCampo} {...invalido("grupo")}>
          <option value="">Sin grupo</option>
          {(jugador?.grupos ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
          {/* Al editar se conserva el grupo histórico aunque el jugador ya no esté en él. */}
          {grupoId && jugador && !jugador.grupos.some((g) => g.id === grupoId) && <option value={grupoId}>Grupo anterior</option>}
        </select>
      </Campo>

      <fieldset role="radiogroup" aria-labelledby="tipo-leyenda" className="space-y-2" {...invalido("tipo")}>
        <legend id="tipo-leyenda" className="mb-1.5 text-sm font-semibold">
          Tipo de evaluación
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["rapida", "completa"] as const).map((t) => (
            <label key={t} className="relative block">
              <input
                type="radio"
                name="tipo"
                value={t}
                checked={tipo === t}
                onChange={() => setTipo(t)}
                className="peer absolute inset-0 size-full cursor-pointer opacity-0"
              />
              <span className="block min-h-11 rounded-2xl bg-noche-700 px-4 py-3 ring-1 ring-noche-500 transition-colors peer-checked:bg-electrico peer-checked:text-noche peer-focus-visible:ring-2 peer-focus-visible:ring-blanco">
                <span className="block font-bold">{TIPO_TEXTO[t]}</span>
                <span className="block text-xs opacity-80">{TIPO_AYUDA[t]}</span>
              </span>
            </label>
          ))}
        </div>
        <MensajeError id="tipo-error" error={err("tipo")} />
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="fecha" etiqueta="Fecha" error={err("fecha")}>
          <input id="fecha" name="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} min={LIMITES_EVALUACION.fechaMinima} max={hoy} className={claseCampo} {...invalido("fecha")} />
        </Campo>
        <Campo id="titulo" etiqueta="Título (opcional)" error={err("titulo")} ayuda="Ej.: «Trimestral de otoño»">
          <input id="titulo" name="titulo" type="text" autoComplete="off" maxLength={LIMITES_EVALUACION.titulo} value={titulo} onChange={(e) => setTitulo(e.target.value)} className={claseCampo} {...invalido("titulo")} />
        </Campo>
      </div>

      <section aria-labelledby="competencias-titulo" className="space-y-3">
        <div>
          <h2 id="competencias-titulo" className="font-display text-xl font-bold uppercase italic">
            Competencias
          </h2>
          <p className="text-xs text-tenue">
            {tipo === "completa" ? "Puntúa todas de 1 a 5." : "Puntúa de 1 a 5 solo lo que hayas observado."} Escala:{" "}
            {Object.entries(escala).map(([n, t]) => `${n} ${t}`).join(" · ")}.
          </p>
        </div>
        {err("notas") && (
          <p id="notas-error" role="alert" className="text-sm font-semibold text-naranja">
            {err("notas")}
          </p>
        )}
        {competencias.map((c) => {
          const valor = notas[c.id] ?? "";
          const error = err(`nota_${c.id}`);
          return (
            <fieldset
              key={c.id}
              role="radiogroup"
              aria-labelledby={`c-${c.id}-nombre`}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `nota_${c.id}-error` : undefined}
              className={`rounded-2xl bg-noche-700 p-4 ring-1 ${error ? "ring-naranja" : "ring-noche-500"}`}
            >
              <legend id={`c-${c.id}-nombre`} className="sr-only">
                {c.nombre}
              </legend>
              <div aria-hidden="true" className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{c.nombre}</span>
                <span className="shrink-0 text-xs text-tenue">
                  {valor ? `${valor} · ${escala[Number(valor) as 1]}` : `${etiquetaGrupo(c)}${c.activa ? "" : " · desactivada"}`}
                </span>
              </div>
              {c.descripcion && <p className="mt-1 text-xs text-tenue">{c.descripcion}</p>}
              <div className="mt-3 grid grid-cols-5 gap-2">
                {NOTAS.map((n) => (
                  <label key={n} className="relative">
                    <input
                      type="radio"
                      name={`nota_${c.id}`}
                      value={n}
                      checked={valor === String(n)}
                      onChange={() => setNotas((prev) => ({ ...prev, [c.id]: String(n) }))}
                      aria-label={`${c.nombre}: ${n} (${escala[n]})`}
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
              {valor && tipo === "rapida" && (
                <button
                  type="button"
                  onClick={() => setNotas((prev) => ({ ...prev, [c.id]: "" }))}
                  className="-mb-2 mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-tenue underline underline-offset-2"
                >
                  Quitar nota de {c.nombre}
                </button>
              )}
              <MensajeError id={`nota_${c.id}-error`} error={error} />
            </fieldset>
          );
        })}
      </section>

      <Campo id="observaciones" etiqueta="Observaciones del entrenador/a (opcional)" error={err("observaciones")} ayuda={`${observaciones.length}/${LIMITES_EVALUACION.observaciones}`}>
        <textarea
          id="observaciones"
          name="observaciones"
          rows={4}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          maxLength={LIMITES_EVALUACION.observaciones}
          className={`${claseCampo} h-auto py-3`}
          {...invalido("observaciones")}
        />
      </Campo>

      <section aria-labelledby="objetivos-titulo" className="space-y-3">
        <div>
          <h2 id="objetivos-titulo" className="font-display text-xl font-bold uppercase italic">
            Objetivos de mejora (opcional)
          </h2>
          <p className="text-xs text-tenue">Hasta {LIMITES_EVALUACION.objetivos}, con plazo si lo hay.</p>
        </div>
        {objetivos.map((o, i) => (
          <div key={i} className="grid gap-3 rounded-2xl bg-noche-700 p-4 ring-1 ring-noche-500 sm:grid-cols-[1fr_11rem]">
            <Campo id={`objetivo_${i}`} etiqueta={`Objetivo ${i + 1}`} error={err(`objetivo_${i}`)}>
              <input
                id={`objetivo_${i}`}
                name={`objetivo_${i}`}
                type="text"
                autoComplete="off"
                maxLength={LIMITES_EVALUACION.objetivo.max}
                value={o.descripcion}
                onChange={(e) => setObjetivos((l) => l.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))}
                className={claseCampo}
                {...invalido(`objetivo_${i}`)}
              />
            </Campo>
            <Campo id={`plazo_${i}`} etiqueta="Plazo (opcional)" error={err(`plazo_${i}`)}>
              <input
                id={`plazo_${i}`}
                name={`plazo_${i}`}
                type="date"
                value={o.plazo ?? ""}
                onChange={(e) => setObjetivos((l) => l.map((x, j) => (j === i ? { ...x, plazo: e.target.value || null } : x)))}
                className={claseCampo}
                {...invalido(`plazo_${i}`)}
              />
            </Campo>
            {objetivos.length > 1 && (
              <button
                type="button"
                onClick={() => setObjetivos((l) => l.filter((_, j) => j !== i))}
                className="-my-2 inline-flex min-h-11 items-center justify-self-start text-sm font-semibold text-naranja"
              >
                Quitar objetivo {i + 1}
              </button>
            )}
          </div>
        ))}
        {objetivos.length < LIMITES_EVALUACION.objetivos && (
          <button type="button" onClick={() => setObjetivos((l) => [...l, { descripcion: "", plazo: null }])} className={claseBoton.secundario}>
            Añadir objetivo
          </button>
        )}
      </section>

      <PropuestaInforme
        propuesta={propuesta}
        redaccion={redaccion}
        prefijo="ev"
        errores={{ fortalezas: err("fortalezas"), mejoras: err("mejoras"), interpretacion: err("interpretacion") }}
      />
      <input type="hidden" name="propuesta" value={redaccion.propuestaJson} />

      {estado.error && (
        <p role="alert" className="rounded-xl border border-naranja/40 bg-naranja/10 px-3 py-2 text-sm font-semibold text-naranja">
          {estado.error}
        </p>
      )}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-4 border-t border-noche-500 bg-noche/95 px-4 py-3 backdrop-blur md:bottom-0">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-xs leading-snug text-tenue sm:text-sm" aria-live="polite">
            {puntuadas.length}/{tipo === "completa" ? activas : competencias.length} competencias
            {mediaActual !== null && (
              <>
                {" · "}media <span className="font-bold text-blanco">{textoMediaEvaluacion(mediaActual)}</span>
              </>
            )}
          </p>
          <button type="submit" disabled={bloqueado} className={`${claseBoton.primario} shrink-0 whitespace-nowrap`}>
            {pendiente ? "Guardando…" : editando ? "Guardar cambios" : "Guardar evaluación"}
          </button>
        </div>
        {estado.errores && (
          <p role="alert" className="mt-2 text-xs font-semibold text-naranja">
            Revisa los campos marcados.
          </p>
        )}
      </div>
    </form>
  );
}
