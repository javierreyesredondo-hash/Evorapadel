"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, type RefObject } from "react";
import type { EstadoFormulario } from "@/app/acciones-gestion";
import { enfocarPrimerError } from "@/components/formularios/campos";
import { useAvisos } from "@/components/gestion/Avisos";

/**
 * Qué hacer cuando responde la Server Action de un formulario:
 *   * guardado → aviso y `alGuardar`, UNA sola vez;
 *   * errores  → foco en el primer campo marcado.
 *
 * Next 16 conserva ocultas las pantallas visitadas y vuelve a ejecutar sus
 * efectos al mostrarlas. Sin esta guarda, volver a «Nuevo jugador» repetía el
 * aviso y la redirección del guardado anterior. Al volver, se pide un
 * formulario limpio con `reiniciar`.
 */
export function useRespuestaFormulario(
  estado: EstadoFormulario,
  formRef: RefObject<HTMLFormElement | null>,
  alGuardar: (e: EstadoFormulario & { id: string }) => void,
  reiniciar: () => void,
) {
  const { avisar } = useAvisos();
  const atendido = useRef<EstadoFormulario | null>(null);

  const responder = useEffectEvent((e: EstadoFormulario) => {
    if (e.ok && e.id) {
      if (atendido.current === e) {
        reiniciar();
        return;
      }
      atendido.current = e;
      avisar(e.mensaje ?? "Guardado.");
      alGuardar(e as EstadoFormulario & { id: string });
    } else if (e.errores) {
      requestAnimationFrame(() => enfocarPrimerError(formRef.current));
    }
  });

  useEffect(() => responder(estado), [estado]);
}

/** Igual, navegando a `${destino}${id}` tras guardar. */
export function useTrasGuardar(
  estado: EstadoFormulario,
  destino: string,
  formRef: RefObject<HTMLFormElement | null>,
  reiniciar: () => void,
) {
  const router = useRouter();
  useRespuestaFormulario(estado, formRef, (e) => router.push(`${destino}${e.id}`), reiniciar);
}
