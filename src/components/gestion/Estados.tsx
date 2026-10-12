import type { ReactNode } from "react";
import { EnlaceBoton } from "@/components/ui";

// Estados comunes de las pantallas con datos reales.

export function Cargando({ texto }: { texto: string }) {
  return (
    <p role="status" className="py-10 text-center text-sm text-tenue">
      {texto}
    </p>
  );
}

export function ErrorCarga({ mensaje }: { mensaje?: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-naranja/40 bg-naranja/10 p-4 text-sm text-naranja">
      <p className="font-bold">No se han podido cargar los datos.</p>
      <p className="mt-1">{mensaje ?? "Recarga la página o vuelve a iniciar sesión."}</p>
    </div>
  );
}

/** Mismo mensaje si no existe o es de otra escuela: no se revela cuál de los dos. */
export function NoEncontrado({ titulo, volver }: { titulo: string; volver: { href: string; texto: string } }) {
  return (
    <section className="py-10 text-center">
      <h1 className="font-display text-3xl font-extrabold uppercase italic">{titulo}</h1>
      <p className="mt-2 text-sm text-tenue">No existe o no pertenece a tu escuela.</p>
      <EnlaceBoton href={volver.href} className="mt-6">
        {volver.texto}
      </EnlaceBoton>
    </section>
  );
}

export function SoloDireccion({ children }: { children?: ReactNode }) {
  return (
    <p className="rounded-xl bg-noche-700 px-3 py-2 text-sm text-tenue ring-1 ring-noche-500">
      {children ?? "Solo la dirección de la escuela puede crear o editar grupos."}
    </p>
  );
}

/** Lista de datos «etiqueta: valor». */
export function Datos({ filas }: { filas: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {filas.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="rounded-2xl bg-noche-700 p-3 ring-1 ring-noche-500">
          <dt className="text-xs text-tenue">{etiqueta}</dt>
          <dd className="mt-0.5 font-semibold">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}
