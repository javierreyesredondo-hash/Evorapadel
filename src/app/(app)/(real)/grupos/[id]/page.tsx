import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { nombreMiembro } from "@/lib/gestion";
import { contextoEscuela, listarJugadores, listarMiembros, obtenerGrupo } from "@/lib/supabase/gestion";
import { EnlaceBoton, Lista, Seccion, Vacio } from "@/components/ui";
import { Asignar, BotonQuitar } from "@/components/gestion/Acciones";
import { Cargando, ErrorCarga, NoEncontrado } from "@/components/gestion/Estados";

export const metadata: Metadata = { title: "Grupo" };

export default function Page(props: PageProps<"/grupos/[id]">) {
  return (
    <Suspense fallback={<Cargando texto="Cargando grupo…" />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  const [r, miembros, jugadores] = await Promise.all([obtenerGrupo(ctx, id), listarMiembros(ctx), listarJugadores(ctx)]);
  if (!r.ok) return <ErrorCarga mensaje={r.mensaje} />;
  const g = r.datos;
  if (!g) return <NoEncontrado titulo="Grupo no encontrado" volver={{ href: "/grupos", texto: "Ver grupos" }} />;

  const entrenador = miembros.ok ? miembros.datos.find((m) => m.usuarioId === g.entrenador_id) : undefined;
  const enGrupo = new Set(g.jugadores.map((j) => j.id));
  const disponibles = jugadores.ok
    ? jugadores.datos.filter((j) => j.activo && !enGrupo.has(j.id)).map((j) => ({ id: j.id, nombre: j.nombre }))
    : [];

  return (
    <>
      <header>
        <h1 className="font-display text-4xl font-extrabold uppercase italic leading-none tracking-tight">{g.nombre}</h1>
        <p className="mt-2 text-sm text-tenue">
          {entrenador ? nombreMiembro(entrenador, ctx.usuarioId) : "Sin entrenador/a"}
        </p>
      </header>
      {ctx.rol === "director" && (
        <div className="mt-5">
          <EnlaceBoton href={`/grupos/${g.id}/editar`} variante="secundario">
            Editar grupo
          </EnlaceBoton>
        </div>
      )}

      <Seccion titulo={`Jugadores (${g.jugadores.length})`}>
        {g.jugadores.length > 0 ? (
          <Lista etiqueta="Jugadores del grupo">
            {g.jugadores.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <Link href={`/jugadores/${j.id}`} className="flex min-h-11 min-w-0 items-center gap-2 font-semibold hover:text-electrico">
                  <span className="truncate">{j.nombre}</span>
                  {!j.activo && <span className="shrink-0 text-xs font-bold text-naranja">Archivado</span>}
                </Link>
                <BotonQuitar grupoId={g.id} jugadorId={j.id} etiqueta={`Quitar a ${j.nombre} del grupo`} />
              </li>
            ))}
          </Lista>
        ) : (
          <Vacio>Este grupo todavía no tiene jugadores.</Vacio>
        )}
        <div className="mt-4">
          {jugadores.ok ? <Asignar modo="jugador" fijo={g.id} opciones={disponibles} /> : <ErrorCarga mensaje={jugadores.mensaje} />}
        </div>
      </Seccion>
    </>
  );
}
