import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { nombreMiembro } from "@/lib/gestion";
import { contextoEscuela, listarGrupos, listarMiembros } from "@/lib/supabase/gestion";
import { Cabecera, EnlaceBoton, Lista, Vacio } from "@/components/ui";
import { Cargando, ErrorCarga, SoloDireccion } from "@/components/gestion/Estados";

export const metadata: Metadata = { title: "Grupos" };

export default function Page() {
  return (
    <>
      <Cabecera titulo="Grupos" subtitulo="Grupos de entrenamiento de tu escuela" />
      <Suspense fallback={<Cargando texto="Cargando grupos…" />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  const [grupos, miembros] = await Promise.all([listarGrupos(ctx), listarMiembros(ctx)]);
  const esDirector = ctx.rol === "director";
  const porId = new Map((miembros.ok ? miembros.datos : []).map((m) => [m.usuarioId, m]));

  return (
    <>
      <div className="mb-4">
        {esDirector ? (
          <EnlaceBoton href="/grupos/nuevo">Nuevo</EnlaceBoton>
        ) : (
          <SoloDireccion>Solo la dirección puede crear o editar grupos. Tú puedes añadir y quitar jugadores.</SoloDireccion>
        )}
      </div>
      {!grupos.ok ? (
        <ErrorCarga mensaje={grupos.mensaje} />
      ) : grupos.datos.length === 0 ? (
        <Vacio>Tu escuela todavía no tiene grupos.</Vacio>
      ) : (
        <Lista etiqueta="Grupos de tu escuela">
          {grupos.datos.map((g) => {
            const activos = g.jugadores.filter((j) => j.activo).length;
            const entrenador = g.entrenador_id ? porId.get(g.entrenador_id) : undefined;
            return (
              <li key={g.id}>
                <Link href={`/grupos/${g.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-noche-600">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{g.nombre}</p>
                    <p className="truncate text-xs text-tenue">
                      {entrenador ? nombreMiembro(entrenador, ctx.usuarioId) : "Sin entrenador/a"}
                    </p>
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="font-display text-2xl font-bold leading-none">{activos}</span>
                    <span className="block text-xs text-tenue">{activos === 1 ? "jugador" : "jugadores"}</span>
                  </p>
                </Link>
              </li>
            );
          })}
        </Lista>
      )}
    </>
  );
}
