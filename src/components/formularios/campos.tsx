import type { ReactNode } from "react";

export const claseCampo =
  "h-12 w-full rounded-2xl bg-noche-700 px-4 text-base text-blanco ring-1 ring-noche-500 placeholder:text-tenue focus:outline-none focus:ring-2 focus:ring-electrico aria-[invalid=true]:ring-naranja";

export function Campo({
  id,
  etiqueta,
  error,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {etiqueta}
      </label>
      {children}
      {ayuda && !error && <p className="mt-1 text-xs text-tenue">{ayuda}</p>}
      <MensajeError id={`${id}-error`} error={error} />
    </div>
  );
}

export function MensajeError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} className="mt-1 text-xs font-semibold text-naranja">
      {error}
    </p>
  );
}

/** Lleva el foco al primer campo con error (en orden del formulario). */
export function enfocarPrimerError(form: HTMLFormElement | null) {
  const campo = form?.querySelector<HTMLElement>("[aria-invalid=true]");
  campo?.focus();
  campo?.scrollIntoView({ block: "center", behavior: "smooth" });
}
