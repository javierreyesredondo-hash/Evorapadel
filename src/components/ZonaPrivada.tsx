import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { NOMBRE_ROL, RUTA_ACCESO, RUTA_SALIR, type Membresia } from "@/lib/acceso";
import { obtenerSesion } from "@/lib/supabase/sesion";

/** Comprueba la sesión en el servidor y solo entonces muestra la zona privada. */
export async function ZonaPrivada({ children }: { children: ReactNode }) {
  const sesion = await obtenerSesion();

  switch (sesion.estado) {
    case "sin_sesion":
      redirect(RUTA_ACCESO);
    case "sin_configurar":
      return (
        <Aviso titulo="Conexión no configurada">
          El servidor no tiene configurada la conexión con la base de datos. Avisa al administrador.
        </Aviso>
      );
    case "error":
      return (
        <Aviso titulo="No se ha podido cargar tu escuela">
          {sesion.esquema
            ? "La base de datos no tiene la estructura que espera la aplicación. Avisa al administrador."
            : "Ha fallado la conexión con la base de datos. Vuelve a intentarlo en unos minutos."}
          <BotonSalir />
        </Aviso>
      );
    case "ok":
      break;
  }

  const [principal, ...otras] = sesion.membresias;
  if (!principal) {
    return (
      <Aviso titulo="Tu cuenta no tiene escuela">
        Has iniciado sesión como <strong className="text-blanco">{sesion.email}</strong>, pero todavía no
        perteneces a ninguna escuela. Pide a la dirección de tu escuela que te dé acceso.
        <BotonSalir />
      </Aviso>
    );
  }

  return (
    <>
      <BarraEscuela membresia={principal} otras={otras.length} nombre={sesion.nombreVisible ?? sesion.email} />
      {children}
    </>
  );
}

function BarraEscuela({ membresia, otras, nombre }: { membresia: Membresia; otras: number; nombre: string | null }) {
  return (
    <section
      aria-label="Tu escuela"
      className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-noche-700 px-4 py-3 ring-1 ring-noche-500"
    >
      <div className="min-w-0">
        <p className="truncate font-semibold" data-prueba="escuela">
          {membresia.escuelaNombre}
        </p>
        <p className="truncate text-xs text-tenue">
          <span className="font-bold text-electrico" data-prueba="rol">
            {NOMBRE_ROL[membresia.rol]}
          </span>
          {nombre && <> · {nombre}</>}
          {otras > 0 && <> · y {otras} {otras === 1 ? "escuela más" : "escuelas más"}</>}
        </p>
      </div>
      <BotonSalir compacto />
    </section>
  );
}

function BotonSalir({ compacto = false }: { compacto?: boolean }) {
  return (
    <form method="post" action={RUTA_SALIR} className={compacto ? "shrink-0" : "mt-4"}>
      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-blanco ring-1 ring-noche-500 transition-colors hover:bg-noche-600"
      >
        Cerrar sesión
      </button>
    </form>
  );
}

function Aviso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section role="status" className="rounded-2xl bg-noche-700 p-5 ring-1 ring-noche-500">
      <h1 className="font-display text-2xl font-extrabold uppercase italic leading-none">{titulo}</h1>
      <div className="mt-3 text-sm text-tenue">{children}</div>
    </section>
  );
}

export function CargandoSesion() {
  return (
    <p role="status" className="py-10 text-center text-sm text-tenue">
      Comprobando tu sesión…
    </p>
  );
}
