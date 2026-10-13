"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AREAS, jugadores, jugadorPorId } from "@/lib/demo-data";
import { nuevoId, useAlmacen } from "@/lib/almacen";
import { LARGO_TITULO, MAX_META, validarObjetivo } from "@/lib/dominio";
import { Cabecera, claseBoton } from "@/components/ui";
import { Campo, claseCampo, enfocarPrimerError, MensajeError } from "@/components/formularios/campos";

export function NuevoObjetivo() {
  const params = useSearchParams();
  return <FormularioObjetivo key={params.toString()} />;
}

function FormularioObjetivo() {
  const router = useRouter();
  const params = useSearchParams();
  const { despachar, mostrarAviso } = useAlmacen();
  const formRef = useRef<HTMLFormElement>(null);

  const [jugadorId, setJugadorId] = useState(jugadorPorId(params.get("jugador") ?? "")?.id ?? "");
  const [titulo, setTitulo] = useState("");
  const [area, setArea] = useState("");
  const [meta, setMeta] = useState("");
  const [progreso, setProgreso] = useState("0");
  const [errores, setErrores] = useState<Record<string, string>>({});

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const r = validarObjetivo({ jugadorId, titulo, area, meta, progreso }, { id: nuevoId("obj") });
    if (!r.ok) {
      setErrores(r.errores);
      requestAnimationFrame(() => enfocarPrimerError(formRef.current));
      return;
    }
    despachar({ tipo: "crearObjetivo", objetivo: r.valor });
    mostrarAviso("Objetivo creado en la demo (solo en este navegador)");
    router.push(`/demo/jugadores/${jugadorId}`);
  }

  const invalido = (campo: string) => ({
    "aria-invalid": !!errores[campo],
    "aria-describedby": errores[campo] ? `${campo}-error` : undefined,
  });

  return (
    <>
      <Cabecera titulo="Nuevo objetivo" subtitulo="Un objetivo medible para un jugador." />

      <form ref={formRef} onSubmit={enviar} noValidate className="space-y-5">
        <Campo id="jugador" etiqueta="Jugador" error={errores.jugadorId}>
          <select
            id="jugador"
            value={jugadorId}
            onChange={(e) => setJugadorId(e.target.value)}
            className={claseCampo}
            {...invalido("jugadorId")}
            aria-describedby={errores.jugadorId ? "jugador-error" : undefined}
          >
            <option value="">Elige un jugador…</option>
            {jugadores.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nombre} (ficticio)
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          id="titulo"
          etiqueta="Objetivo"
          error={errores.titulo}
          ayuda={`Entre ${LARGO_TITULO.min} y ${LARGO_TITULO.max} caracteres. Ej.: «Voleas seguidas sin error»`}
        >
          <input
            id="titulo"
            type="text"
            autoComplete="off"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className={claseCampo}
            {...invalido("titulo")}
          />
        </Campo>

        <fieldset
          role="radiogroup"
          aria-labelledby="area-nombre"
          aria-invalid={errores.area ? true : undefined}
          aria-describedby={errores.area ? "area-error" : undefined}
        >
          <legend id="area-nombre" className="mb-1.5 text-sm font-semibold">
            Área
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {AREAS.map((a) => (
              <label key={a} className="relative">
                <input
                  type="radio"
                  name="area"
                  value={a}
                  checked={area === a}
                  onChange={() => setArea(a)}
                  className="peer absolute inset-0 size-full cursor-pointer opacity-0"
                />
                <span className="grid h-11 place-items-center rounded-xl bg-noche-700 text-sm font-semibold text-tenue ring-1 ring-noche-500 transition-colors peer-checked:bg-electrico peer-checked:text-noche peer-checked:ring-electrico peer-focus-visible:ring-2 peer-focus-visible:ring-blanco">
                  {a}
                </span>
              </label>
            ))}
          </div>
          <MensajeError id="area-error" error={errores.area} />
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Campo id="meta" etiqueta="Meta" error={errores.meta} ayuda={`Entero, 1–${MAX_META}`}>
            <input
              id="meta"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              className={claseCampo}
              {...invalido("meta")}
            />
          </Campo>
          <Campo id="progreso" etiqueta="Progreso actual" error={errores.progreso}>
            <input
              id="progreso"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={progreso}
              onChange={(e) => setProgreso(e.target.value)}
              className={claseCampo}
              {...invalido("progreso")}
            />
          </Campo>
        </div>

        <div className="flex flex-col gap-2">
          <button type="submit" className={`${claseBoton.primario} w-full`}>
            Crear objetivo
          </button>
          {Object.keys(errores).length > 0 && (
            <p role="alert" className="text-center text-xs font-semibold text-naranja">
              Revisa los campos marcados.
            </p>
          )}
        </div>
      </form>
    </>
  );
}
