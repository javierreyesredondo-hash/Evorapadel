"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { actualizarJugador, crearJugador, type EstadoFormulario } from "@/app/acciones-gestion";
import {
  LIMITES,
  MANO_TEXTO,
  MANOS_BD,
  NIVEL_TEXTO,
  NIVELES_BD,
  POSICION_TEXTO,
  POSICIONES_BD,
  type JugadorReal,
} from "@/lib/gestion";
import { claseBoton } from "@/components/ui";
import { Campo, claseCampo } from "@/components/formularios/campos";
import { useTrasGuardar } from "@/components/gestion/useTrasGuardar";

type Props = { jugador?: JugadorReal; hoy: string };

/** Alta (sin `jugador`) o edición de un jugador real. Campos = columnas de public.jugadores. */
export function FormularioJugador(props: Props) {
  // Cambiar la clave da un formulario nuevo (ver useTrasGuardar).
  const [version, setVersion] = useState(0);
  return <Formulario key={version} {...props} reiniciar={() => setVersion((v) => v + 1)} />;
}

function Formulario({ jugador, hoy, reiniciar }: Props & { reiniciar: () => void }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, accion, pendiente] = useActionState<EstadoFormulario, FormData>(
    jugador ? actualizarJugador : crearJugador,
    {},
  );

  useTrasGuardar(estado, "/jugadores/", formRef, reiniciar);

  // Tras un error se conserva lo escrito; si no, los datos guardados.
  const v = (campo: keyof JugadorReal & string) => estado.valores?.[campo] ?? (jugador?.[campo] as string | null) ?? "";
  const err = (campo: string) => estado.errores?.[campo];
  const invalido = (campo: string) => ({
    "aria-invalid": !!err(campo),
    "aria-describedby": err(campo) ? `${campo}-error` : undefined,
  });
  // Bloquea reenvíos mientras se guarda y después de guardar (hasta navegar).
  const bloqueado = pendiente || !!estado.ok;

  return (
    <form ref={formRef} action={accion} noValidate className="space-y-5">
      {jugador && <input type="hidden" name="id" value={jugador.id} />}

      <Campo id="nombre" etiqueta="Nombre y apellidos" error={err("nombre")}>
        <input
          id="nombre"
          name="nombre"
          type="text"
          autoComplete="off"
          maxLength={LIMITES.nombreJugador.max}
          defaultValue={v("nombre")}
          className={claseCampo}
          {...invalido("nombre")}
        />
      </Campo>

      {estado.homonimo && (
        <label className="flex min-h-11 items-start gap-3 rounded-2xl bg-naranja/10 p-3 text-sm ring-1 ring-naranja/40">
          <input type="checkbox" name="confirmar_homonimo" value="si" className="mt-0.5 size-5 accent-electrico" />
          <span>
            Es otra persona distinta de «{estado.homonimo}». Guardarlo de todas formas.
          </span>
        </label>
      )}

      <Campo
        id="fecha_nacimiento"
        etiqueta="Fecha de nacimiento (opcional)"
        error={err("fecha_nacimiento")}
        ayuda="Puede ser un menor: guarda solo lo necesario."
      >
        <input
          id="fecha_nacimiento"
          name="fecha_nacimiento"
          type="date"
          min={LIMITES.fechaMinima}
          max={hoy}
          defaultValue={v("fecha_nacimiento")}
          className={claseCampo}
          {...invalido("fecha_nacimiento")}
        />
      </Campo>

      <div className="grid gap-5 sm:grid-cols-3">
        <Campo id="nivel" etiqueta="Nivel" error={err("nivel")}>
          <select id="nivel" name="nivel" defaultValue={v("nivel")} className={claseCampo} {...invalido("nivel")}>
            <option value="">Sin indicar</option>
            {NIVELES_BD.map((n) => (
              <option key={n} value={n}>
                {NIVEL_TEXTO[n]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="posicion" etiqueta="Posición" error={err("posicion")}>
          <select id="posicion" name="posicion" defaultValue={v("posicion")} className={claseCampo} {...invalido("posicion")}>
            <option value="">Sin indicar</option>
            {POSICIONES_BD.map((p) => (
              <option key={p} value={p}>
                {POSICION_TEXTO[p]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="mano" etiqueta="Mano dominante" error={err("mano")}>
          <select id="mano" name="mano" defaultValue={v("mano")} className={claseCampo} {...invalido("mano")}>
            <option value="">Sin indicar</option>
            {MANOS_BD.map((m) => (
              <option key={m} value={m}>
                {MANO_TEXTO[m]}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo id="foco" etiqueta="Foco de trabajo (opcional)" error={err("foco")} ayuda={`Hasta ${LIMITES.foco.max} caracteres. Ej.: «Bandeja profunda»`}>
        <input
          id="foco"
          name="foco"
          type="text"
          autoComplete="off"
          maxLength={LIMITES.foco.max}
          defaultValue={v("foco")}
          className={claseCampo}
          {...invalido("foco")}
        />
      </Campo>

      {estado.error && (
        <p role="alert" className="rounded-xl border border-naranja/40 bg-naranja/10 px-3 py-2 text-sm font-semibold text-naranja">
          {estado.error}
        </p>
      )}
      {estado.errores && !estado.error && (
        <p className="text-sm font-semibold text-naranja">Revisa los campos marcados.</p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={bloqueado} aria-disabled={bloqueado} className={claseBoton.primario}>
          {pendiente ? "Guardando…" : jugador ? "Guardar cambios" : "Crear jugador"}
        </button>
        <button type="button" onClick={() => router.back()} className={claseBoton.secundario}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
