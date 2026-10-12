import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { hoyIso, textoFecha } from "@/lib/format";
import { edad, MANO_TEXTO, NIVEL_TEXTO, POSICION_TEXTO } from "@/lib/gestion";
import { contextoEscuela, listarGrupos, obtenerJugador } from "@/lib/supabase/gestion";
import { Avatar, EnlaceBoton, Lista, Seccion, Vacio } from "@/components/ui";
import { Asignar, BotonEstadoJugador, BotonQuitar } from "@/components/gestion/Acciones";
import { Cargando, Datos, ErrorCarga, NoEncontrado } from "@/components/gestion/Estados";

export const metadata: Metadata = { title: "Jugador" };

export default function Page(props: PageProps<"/jugadores/[id]">) {
  return (
    <Suspense fallback={<Cargando texto="Cargando jugador…" />}>
      <Ficha params={props.params} />
    </Suspense>
  );
}

async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  const [r, grupos] = await Promise.all([obtenerJugador(ctx, id), listarGrupos(ctx)]);
  if (!r.ok) return <ErrorCarga mensaje={r.mensaje} />;
  const j = r.datos;
  if (!j) return <NoEncontrado titulo="Jugador no encontrado" volver={{ href: "/jugadores", texto: "Ver jugadores" }} />;

  const hoy = hoyIso();
  const anos = edad(j.fecha_nacimiento, hoy);
  const enGrupos = new Set(j.grupos.map((g) => g.id));
  const disponibles = grupos.ok ? grupos.datos.filter((g) => !enGrupos.has(g.id)).map((g) => ({ id: g.id, nombre: g.nombre })) : [];

  return (
    <>
      <header className="flex items-center gap-4">
        <Avatar nombre={j.nombre} grande />
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-extrabold uppercase italic leading-none">{j.nombre}</h1>
          <p className="mt-1 text-sm text-tenue">
            {j.activo ? (
              "Activo"
            ) : (
              <span className="font-bold text-naranja" data-prueba="archivado">
                Archivado
              </span>
            )}
          </p>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap gap-3">
        <EnlaceBoton href={`/jugadores/${j.id}/editar`}>Editar</EnlaceBoton>
        <BotonEstadoJugador id={j.id} nombre={j.nombre} activo={j.activo} />
      </div>

      <Seccion titulo="Datos">
        <Datos
          filas={[
            ["Nivel", j.nivel ? NIVEL_TEXTO[j.nivel] : "Sin indicar"],
            ["Posición", j.posicion ? POSICION_TEXTO[j.posicion] : "Sin indicar"],
            ["Mano", j.mano ? MANO_TEXTO[j.mano] : "Sin indicar"],
            ["Nacimiento", j.fecha_nacimiento ? `${textoFecha(j.fecha_nacimiento)} (${anos} años)` : "Sin indicar"],
            ["Foco", j.foco ?? "Sin indicar"],
          ]}
        />
      </Seccion>

      <Seccion titulo="Grupos">
        {j.grupos.length > 0 ? (
          <Lista etiqueta="Grupos del jugador">
            {j.grupos.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <Link href={`/grupos/${g.id}`} className="flex min-h-11 min-w-0 items-center font-semibold hover:text-electrico">
                  <span className="truncate">{g.nombre}</span>
                </Link>
                <BotonQuitar grupoId={g.id} jugadorId={j.id} etiqueta={`Quitar del grupo ${g.nombre}`} />
              </li>
            ))}
          </Lista>
        ) : (
          <Vacio>No está en ningún grupo.</Vacio>
        )}
        <div className="mt-4">
          {!grupos.ok ? (
            <ErrorCarga mensaje={grupos.mensaje} />
          ) : !j.activo ? (
            <p className="text-sm text-tenue">Reactívalo para poder añadirlo a un grupo.</p>
          ) : grupos.datos.length === 0 ? (
            <p className="text-sm text-tenue">Tu escuela todavía no tiene grupos.</p>
          ) : (
            <Asignar modo="grupo" fijo={j.id} opciones={disponibles} />
          )}
        </div>
      </Seccion>

      <Seccion titulo="Evaluaciones y objetivos">
        <Vacio>Todavía no se guardan en la base de datos. Por ahora solo existen en la demostración, con datos ficticios.</Vacio>
      </Seccion>
    </>
  );
}
