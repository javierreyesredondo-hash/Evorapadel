"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { iniciarSesion, type EstadoAcceso } from "@/app/acciones-acceso";
import { MAX_CONTRASENA, MAX_EMAIL } from "@/lib/acceso";
import { claseBoton } from "@/components/ui";
import { Campo, claseCampo } from "@/components/formularios/campos";

export function FormularioAcceso() {
  const siguiente = useSearchParams().get("siguiente") ?? "";
  const [estado, accion, enviando] = useActionState<EstadoAcceso, FormData>(iniciarSesion, {});
  const e = estado.errores ?? {};

  return (
    <form action={accion} noValidate className="space-y-5">
      <input type="hidden" name="siguiente" value={siguiente} />
      <Campo id="email" etiqueta="Correo electrónico" error={e.email}>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={MAX_EMAIL}
          defaultValue={estado.email ?? ""}
          aria-invalid={!!e.email}
          aria-describedby={e.email ? "email-error" : undefined}
          autoFocus
          className={claseCampo}
        />
      </Campo>
      <Campo id="contrasena" etiqueta="Contraseña" error={e.contrasena}>
        <input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          maxLength={MAX_CONTRASENA}
          aria-invalid={!!e.contrasena}
          aria-describedby={e.contrasena ? "contrasena-error" : undefined}
          className={claseCampo}
        />
      </Campo>
      {estado.error && (
        <p role="alert" className="rounded-xl border border-naranja/40 bg-naranja/10 px-3 py-2 text-sm font-semibold text-naranja">
          {estado.error}
        </p>
      )}
      <button type="submit" disabled={enviando} className={`${claseBoton.primario} w-full`}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-center text-xs text-tenue">
        ¿No tienes cuenta? La crea la dirección de tu escuela.
      </p>
    </form>
  );
}
