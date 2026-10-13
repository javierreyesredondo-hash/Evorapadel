"use client";

import { useActionState, useRef } from "react";
import { guardarPerfil } from "@/app/acciones-evaluaciones";
import type { EstadoFormulario } from "@/app/acciones-gestion";
import { claseBoton } from "@/components/ui";
import { Campo, claseCampo } from "@/components/formularios/campos";
import { useRespuestaFormulario } from "@/components/gestion/useTrasGuardar";

export function FormularioPerfil({ nombre }: { nombre: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(guardarPerfil, {});
  useRespuestaFormulario(estado, formRef, () => {}, () => {});
  const err = estado.errores?.nombre_visible;
  return (
    <form ref={formRef} action={accion} noValidate className="space-y-4">
      <Campo id="nombre_visible" etiqueta="Tu nombre" error={err} ayuda="Aparece como entrenador/a en las evaluaciones y en los informes PDF.">
        <input
          id="nombre_visible"
          name="nombre_visible"
          type="text"
          autoComplete="name"
          maxLength={120}
          defaultValue={estado.valores?.nombre_visible ?? nombre}
          className={claseCampo}
          aria-invalid={!!err}
          aria-describedby={err ? "nombre_visible-error" : undefined}
        />
      </Campo>
      {estado.error && (
        <p role="alert" className="text-sm font-semibold text-naranja">
          {estado.error}
        </p>
      )}
      <button type="submit" disabled={pendiente} className={claseBoton.primario}>
        {pendiente ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
