"use client";

import { useActionState, useRef, useState } from "react";
import { cambiarEstadoCompetencia, cargarMetodologiaBase, guardarCompetencia } from "@/app/acciones-evaluaciones";
import type { EstadoFormulario } from "@/app/acciones-gestion";
import type { Competencia } from "@/lib/evaluaciones";
import { AREA_TEXTO, AREAS_COMPETENCIA } from "@/lib/metodologia";
import { claseBoton } from "@/components/ui";
import { Campo, claseCampo } from "@/components/campos";
import { ErrorAccion, useAccion } from "@/components/gestion/Acciones";
import { useRespuestaFormulario } from "@/components/gestion/useTrasGuardar";

type PropsFormulario = { competencia?: Competencia; ordenSiguiente: number; alTerminar?: () => void };

/** Alta (sin `competencia`) o edición de una competencia. Solo la dirección (RLS). */
export function FormularioCompetencia(props: PropsFormulario) {
  const [version, setVersion] = useState(0);
  return <Formulario key={version} {...props} reiniciar={() => setVersion((v) => v + 1)} />;
}

function Formulario({ competencia, ordenSiguiente, alTerminar, reiniciar }: PropsFormulario & { reiniciar: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(guardarCompetencia, {});
  // Tras guardar: el alta vuelve a quedar vacía; la edición se cierra.
  useRespuestaFormulario(estado, formRef, () => (competencia ? alTerminar?.() : reiniciar()), reiniciar);

  const prefijo = competencia ? `c-${competencia.id}` : "nueva";
  const v = (campo: string, inicial: string) => estado.valores?.[campo] ?? inicial;
  const err = (campo: string) => estado.errores?.[campo];
  const invalido = (campo: string) => ({
    "aria-invalid": !!err(campo),
    "aria-describedby": err(campo) ? `${prefijo}-${campo}-error` : undefined,
  });

  return (
    <form ref={formRef} action={accion} noValidate className="space-y-4">
      {competencia && <input type="hidden" name="id" value={competencia.id} />}
      {competencia && <input type="hidden" name="activa" value={competencia.activa ? "si" : "no"} />}
      <Campo id={`${prefijo}-nombre`} etiqueta="Nombre de la competencia" error={err("nombre")}>
        <input id={`${prefijo}-nombre`} name="nombre" type="text" autoComplete="off" maxLength={80} defaultValue={v("nombre", competencia?.nombre ?? "")} className={claseCampo} {...invalido("nombre")} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Campo id={`${prefijo}-area`} etiqueta="Área" error={err("area")}>
          <select id={`${prefijo}-area`} name="area" defaultValue={v("area", competencia?.area ?? "")} className={claseCampo} {...invalido("area")}>
            <option value="">Elige un área…</option>
            {AREAS_COMPETENCIA.map((a) => (
              <option key={a} value={a}>
                {AREA_TEXTO[a]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id={`${prefijo}-orden`} etiqueta="Orden" error={err("orden")}>
          <input id={`${prefijo}-orden`} name="orden" type="number" inputMode="numeric" min={0} max={999} defaultValue={v("orden", String(competencia?.orden ?? ordenSiguiente))} className={claseCampo} {...invalido("orden")} />
        </Campo>
      </div>
      <Campo id={`${prefijo}-descripcion`} etiqueta="Qué se observa (opcional)" error={err("descripcion")} ayuda="Criterio observable, hasta 300 caracteres.">
        <textarea id={`${prefijo}-descripcion`} name="descripcion" rows={2} maxLength={300} defaultValue={v("descripcion", competencia?.descripcion ?? "")} className={`${claseCampo} h-auto py-3`} {...invalido("descripcion")} />
      </Campo>
      {estado.error && (
        <p role="alert" className="text-sm font-semibold text-naranja">
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pendiente} className={claseBoton.primario}>
          {pendiente ? "Guardando…" : competencia ? "Guardar competencia" : "Añadir competencia"}
        </button>
        {competencia && (
          <button type="button" onClick={alTerminar} className={claseBoton.secundario}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

/** Una competencia de la lista; la dirección la edita o la (des)activa. */
export function FilaCompetencia({ competencia: c, esDirector }: { competencia: Competencia; esDirector: boolean }) {
  const [editando, setEditando] = useState(false);
  const { pendiente, error, ejecutar } = useAccion();
  if (editando) {
    return (
      <li className="p-4">
        <FormularioCompetencia competencia={c} ordenSiguiente={c.orden} alTerminar={() => setEditando(false)} />
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {c.nombre}
          {!c.activa && <span className="ml-2 text-xs font-bold text-naranja">Desactivada</span>}
        </p>
        <p className="text-xs text-tenue">
          {AREA_TEXTO[c.area]} · orden {c.orden}
        </p>
      </div>
      {esDirector && (
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setEditando(true)} aria-label={`Editar ${c.nombre}`} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-electrico hover:bg-noche-600">
            Editar
          </button>
          <button
            type="button"
            disabled={pendiente}
            aria-label={`${c.activa ? "Desactivar" : "Activar"} ${c.nombre}`}
            onClick={() => ejecutar(() => cambiarEstadoCompetencia(c.id, !c.activa))}
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-tenue hover:bg-noche-600 disabled:opacity-40"
          >
            {c.activa ? "Desactivar" : "Activar"}
          </button>
        </div>
      )}
      <div className="w-full">
        {c.descripcion && <p className="text-sm text-blanco/80">{c.descripcion}</p>}
        <ErrorAccion error={error} />
      </div>
    </li>
  );
}

export function BotonCargarBase() {
  const { pendiente, error, ejecutar } = useAccion();
  return (
    <div>
      <button type="button" disabled={pendiente} onClick={() => ejecutar(cargarMetodologiaBase)} className={claseBoton.primario}>
        {pendiente ? "Cargando…" : "Cargar metodología base ÉVORA"}
      </button>
      <ErrorAccion error={error} />
    </div>
  );
}
