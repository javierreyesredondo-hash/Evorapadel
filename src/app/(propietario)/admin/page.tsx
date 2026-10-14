import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RUTA_ACCESO, RUTA_SALIR } from "@/lib/acceso";
import type { EstadoInvitacion } from "@/lib/invitaciones";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { esAdministrador, obtenerSesion } from "@/lib/supabase/sesion";
import { Cabecera } from "@/components/ui";
import { ErrorCarga } from "@/components/gestion/Estados";
import { FilaEscuela, FormularioAltaEscuela, type EscuelaAdmin } from "@/components/admin/PanelEscuelas";

// Panel global del propietario: escuelas, invitaciones de directores y estado
// de acceso. Solo para administradores (privado.administradores). Para
// cualquier otra persona, la página no existe.

export const metadata: Metadata = { title: "Panel de ÉVORA PADEL", robots: { index: false, follow: false } };

export default async function Page() {
  const sesion = await obtenerSesion();
  if (sesion.estado === "sin_sesion") redirect(RUTA_ACCESO);
  if (sesion.estado !== "ok") return <ErrorCarga />;
  if (!(await esAdministrador())) return <NoDisponible />;

  const supabase = await crearClienteServidor();
  const { data, error } = (await supabase?.rpc("admin_listar_escuelas")) ?? { data: null, error: { code: "sin_conexion" } };
  if (error) {
    console.error("ÉVORA PADEL: error al listar escuelas", error.code);
    return <ErrorCarga mensaje="No se han podido cargar las escuelas. Vuelve a intentarlo en unos minutos." />;
  }
  const escuelas: EscuelaAdmin[] = ((data ?? []) as Record<string, unknown>[]).map((f) => ({
    id: f.escuela_id as string,
    nombre: f.escuela_nombre as string,
    estado: f.escuela_estado as "activa" | "suspendida",
    alta: f.alta as string,
    directores: f.directores as number,
    miembros: f.miembros as number,
    invitacion: f.invitacion_id
      ? {
          id: f.invitacion_id as string,
          email: f.invitacion_email as string,
          estado: f.invitacion_estado as EstadoInvitacion,
          creada: f.invitacion_creada as string,
          caduca: f.invitacion_caduca as string,
        }
      : null,
  }));

  return (
    <>
      <Cabecera
        titulo="Escuelas"
        subtitulo="Panel del propietario de ÉVORA PADEL"
        accion={
          <form method="post" action={RUTA_SALIR}>
            <button type="submit" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold ring-1 ring-noche-500 hover:bg-noche-600">
              Cerrar sesión
            </button>
          </form>
        }
      />
      <p className="mb-6 rounded-xl bg-noche-700 px-3 py-2 text-xs text-tenue ring-1 ring-noche-500">
        Todas las escuelas activas tienen las mismas funciones. Los pagos se gestionan fuera de la app (Bizum): aquí solo se
        suspende o reactiva el acceso, sin borrar datos. La app no envía correos: comparte tú el enlace de invitación.
      </p>
      <FormularioAltaEscuela />
      <section aria-labelledby="lista-escuelas" className="mt-8">
        <h2 id="lista-escuelas" className="mb-3 font-display text-xl font-bold uppercase italic tracking-wide">
          Escuelas ({escuelas.length})
        </h2>
        {escuelas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-noche-500 px-4 py-8 text-center text-sm text-tenue">Todavía no hay escuelas.</p>
        ) : (
          <ul aria-label="Escuelas" className="space-y-3">
            {escuelas.map((e) => (
              <FilaEscuela key={e.id} escuela={e} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** Para quien no es administrador: igual que una página inexistente. */
function NoDisponible() {
  return (
    <section className="py-10 text-center">
      <h1 className="font-display text-3xl font-extrabold uppercase italic">Página no encontrada</h1>
      <p className="mt-2 text-sm text-tenue">La página que buscas no existe.</p>
    </section>
  );
}
