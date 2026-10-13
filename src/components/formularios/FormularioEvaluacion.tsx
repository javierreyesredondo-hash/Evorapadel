"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  CRITERIOS,
  ESCALA,
  jugadores,
  jugadorPorId,
  TIPOS_EVALUACION,
  type CriterioId,
  type Nota,
} from "@/lib/demo-data";
import { nuevoId, useAlmacen } from "@/lib/almacen";
import { esNota, MAX_COMENTARIO, mediaNotas, puntuacionGlobal, validarEvaluacion } from "@/lib/dominio";
import { hoyIso, textoMedia } from "@/lib/format";
import { Cabecera, claseBoton, EtiquetaFicticio } from "@/components/ui";
import { Campo, claseCampo, enfocarPrimerError, MensajeError } from "@/components/formularios/campos";

const NOTAS: Nota[] = [1, 2, 3, 4, 5];

function sinClave(errores: Record<string, string>, clave: string) {
  const copia = { ...errores };
  delete copia[clave];
  return copia;
}

export function NuevaEvaluacion() {
  // La clave fuerza un formulario limpio si cambian los parámetros de la URL.
  const params = useSearchParams();
  return <FormularioEvaluacion key={params.toString()} />;
}

function FormularioEvaluacion() {
  const router = useRouter();
  const params = useSearchParams();
  const { estado, despachar, mostrarAviso } = useAlmacen();
  const formRef = useRef<HTMLFormElement>(null);

  const pendiente = estado.pendientes.find((p) => p.id === params.get("pendiente"));
  const jugadorInicial = pendiente?.jugadorId ?? (jugadorPorId(params.get("jugador") ?? "")?.id || "");

  const [jugadorId, setJugadorId] = useState(jugadorInicial);
  const [tipo, setTipo] = useState(pendiente?.tipo ?? "");
  const [notas, setNotas] = useState<Partial<Record<string, Nota>>>({});
  const [comentario, setComentario] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});

  const valoradas = CRITERIOS.filter((c) => esNota(notas[c.id])).length;
  const media = mediaNotas(notas);
  const completa = valoradas === CRITERIOS.length;

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const r = validarEvaluacion(
      { jugadorId, tipo, notas, comentario },
      { id: nuevoId("ev"), fecha: hoyIso() },
    );
    if (!r.ok) {
      setErrores(r.errores);
      requestAnimationFrame(() => enfocarPrimerError(formRef.current));
      return;
    }
    // Solo cuenta como la pendiente si es del mismo jugador.
    const pendienteId = pendiente && pendiente.jugadorId === jugadorId ? pendiente.id : undefined;
    despachar({ tipo: "registrarEvaluacion", evaluacion: r.valor, pendienteId });
    mostrarAviso("Evaluación guardada en la demo (solo en este navegador)");
    router.push(`/demo/jugadores/${jugadorId}`);
  }

  const jugador = jugadorPorId(jugadorId);
  const hayErrores = Object.keys(errores).length > 0;

  return (
    <>
      <Cabecera titulo="Evaluar" subtitulo="Puntúa cada criterio con un número entero del 1 al 5." />

      <form ref={formRef} onSubmit={enviar} noValidate className="space-y-5">
        <Campo id="jugador" etiqueta="Jugador" error={errores.jugadorId}>
          <select
            id="jugador"
            value={jugadorId}
            onChange={(e) => setJugadorId(e.target.value)}
            aria-invalid={!!errores.jugadorId}
            aria-describedby={errores.jugadorId ? "jugador-error" : undefined}
            className={claseCampo}
          >
            <option value="">Elige un jugador…</option>
            {jugadores.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nombre} (ficticio)
              </option>
            ))}
          </select>
        </Campo>
        {jugador && (
          <p className="-mt-3 flex items-center gap-2 text-xs text-tenue">
            <EtiquetaFicticio /> {jugador.nivel} · {jugador.posicion} · Foco: {jugador.foco}
          </p>
        )}

        <Campo id="tipo" etiqueta="Tipo de evaluación" error={errores.tipo}>
          <select
            id="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            aria-invalid={!!errores.tipo}
            aria-describedby={errores.tipo ? "tipo-error" : undefined}
            className={claseCampo}
          >
            <option value="">Elige el tipo…</option>
            {TIPOS_EVALUACION.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Campo>

        <div className="space-y-3">
          {CRITERIOS.map((c) => {
            const valor = notas[c.id];
            const error = errores[c.id];
            return (
              <fieldset
                key={c.id}
                role="radiogroup"
                aria-labelledby={`${c.id}-nombre`}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${c.id}-error` : undefined}
                className={`rounded-2xl bg-noche-700 p-4 ring-1 ${error ? "ring-naranja" : "ring-noche-500"}`}
              >
                <legend id={`${c.id}-nombre`} className="sr-only">
                  {c.nombre}
                </legend>
                <div aria-hidden="true" className="mb-3 flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{c.nombre}</span>
                  <span className="text-xs text-tenue">{valor ? `${valor} · ${ESCALA[valor]}` : c.area}</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {NOTAS.map((n) => (
                    <label key={n} className="relative">
                      <input
                        type="radio"
                        name={c.id}
                        value={n}
                        checked={valor === n}
                        onChange={() => {
                          setNotas((prev) => ({ ...prev, [c.id]: n }));
                          setErrores((prev) => sinClave(prev, c.id));
                        }}
                        aria-label={`${c.nombre}: ${n} (${ESCALA[n]})`}
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
                <MensajeError id={`${c.id}-error`} error={error} />
              </fieldset>
            );
          })}
        </div>

        <Campo
          id="comentario"
          etiqueta="Comentario (opcional)"
          error={errores.comentario}
          ayuda={`${comentario.length}/${MAX_COMENTARIO}`}
        >
          <textarea
            id="comentario"
            rows={3}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            aria-invalid={!!errores.comentario}
            maxLength={MAX_COMENTARIO + 50}
            className={`${claseCampo} h-auto py-3`}
          />
        </Campo>

        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-4 border-t border-noche-500 bg-noche/95 px-4 py-3 backdrop-blur md:bottom-0">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-xs leading-snug text-tenue sm:text-sm" aria-live="polite">
              {valoradas}/{CRITERIOS.length} criterios
              {media !== null && (
                <>
                  {" · "}media <span className="font-bold text-blanco">{textoMedia(media)}</span>
                  {completa && (
                    <>
                      {" · "}
                      <span className="whitespace-nowrap">
                        <span className="font-bold text-blanco">
                          {puntuacionGlobal(notas as Record<CriterioId, Nota>)}
                        </span>{" "}
                        pts
                      </span>
                    </>
                  )}
                </>
              )}
            </p>
            <button type="submit" className={`${claseBoton.primario} shrink-0 whitespace-nowrap`}>
              Guardar evaluación
            </button>
          </div>
          {hayErrores && (
            <p role="alert" className="mt-2 text-xs font-semibold text-naranja">
              Revisa los campos marcados.
            </p>
          )}
        </div>
      </form>
    </>
  );
}
