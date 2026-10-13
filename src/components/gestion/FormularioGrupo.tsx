"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { actualizarGrupo, crearGrupo, type EstadoFormulario } from "@/app/acciones-gestion";
import { LIMITES, nombreMiembro, type GrupoReal, type Miembro } from "@/lib/gestion";
import { claseBoton } from "@/components/ui";
import { Campo, claseCampo } from "@/components/campos";
import { useTrasGuardar } from "@/components/gestion/useTrasGuardar";

type Props = { grupo?: GrupoReal; miembros: Miembro[]; usuarioId: string };

/** Alta (sin `grupo`) o edición de un grupo. Solo la dirección (RLS). */
export function FormularioGrupo(props: Props) {
  // Cambiar la clave da un formulario nuevo (ver useTrasGuardar).
  const [version, setVersion] = useState(0);
  return <Formulario key={version} {...props} reiniciar={() => setVersion((v) => v + 1)} />;
}

function Formulario({ grupo, miembros, usuarioId, reiniciar }: Props & { reiniciar: () => void }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(grupo ? actualizarGrupo : crearGrupo, {});

  useTrasGuardar(estado, "/grupos/", formRef, reiniciar);

  const err = (campo: string) => estado.errores?.[campo];
  const invalido = (campo: string) => ({
    "aria-invalid": !!err(campo),
    "aria-describedby": err(campo) ? `${campo}-error` : undefined,
  });
  const bloqueado = pendiente || !!estado.ok;

  return (
    <form ref={formRef} action={accion} noValidate className="space-y-5">
      {grupo && <input type="hidden" name="id" value={grupo.id} />}

      <Campo id="nombre" etiqueta="Nombre del grupo" error={err("nombre")} ayuda="Ej.: «Tecnificación A» o «Adultos martes»">
        <input
          id="nombre"
          name="nombre"
          type="text"
          autoComplete="off"
          maxLength={LIMITES.nombreGrupo.max}
          defaultValue={estado.valores?.nombre ?? grupo?.nombre ?? ""}
          className={claseCampo}
          {...invalido("nombre")}
        />
      </Campo>

      <Campo id="entrenador_id" etiqueta="Entrenador/a responsable" error={err("entrenador_id")}>
        <select
          id="entrenador_id"
          name="entrenador_id"
          defaultValue={estado.valores?.entrenador_id ?? grupo?.entrenador_id ?? ""}
          className={claseCampo}
          {...invalido("entrenador_id")}
        >
          <option value="">Sin asignar</option>
          {miembros.map((m) => (
            <option key={m.usuarioId} value={m.usuarioId}>
              {nombreMiembro(m, usuarioId)}
            </option>
          ))}
        </select>
      </Campo>

      {estado.error && (
        <p role="alert" className="rounded-xl border border-naranja/40 bg-naranja/10 px-3 py-2 text-sm font-semibold text-naranja">
          {estado.error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={bloqueado} aria-disabled={bloqueado} className={claseBoton.primario}>
          {pendiente ? "Guardando…" : grupo ? "Guardar cambios" : "Crear grupo"}
        </button>
        <button type="button" onClick={() => router.back()} className={claseBoton.secundario}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
