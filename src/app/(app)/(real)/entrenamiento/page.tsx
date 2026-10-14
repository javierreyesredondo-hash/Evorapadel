import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { textoFunciones } from "@/lib/gestion";
import { contextoEscuela, listarMisGrupos } from "@/lib/supabase/gestion";
import { listarCompetencias, listarMisEvaluaciones } from "@/lib/supabase/evaluaciones";
import { Cabecera, EnlaceBoton, Seccion, Vacio } from "@/components/ui";
import { Cargando, ErrorCarga } from "@/components/gestion/Estados";
import { ListaEvaluaciones } from "@/components/evaluaciones/ListaEvaluaciones";

// Tareas de ENTRENAMIENTO: los grupos que entrena el usuario y sus jugadores,
// para evaluarlos. Igual para un entrenador que para un director que entrena:
// misma cuenta, misma sesión y sin cambiar permisos (las funciones de
// dirección siguen en Inicio → Dirección).

export const metadata: Metadata = { title: "Mi entrenamiento" };

export default function Page() {
  return (
    <>
      <Cabecera titulo="Mi entrenamiento" subtitulo="Tus grupos y tus evaluaciones" />
      <Suspense fallback={<Cargando texto="Cargando tus grupos…" />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  const [grupos, evaluaciones, competencias] = await Promise.all([listarMisGrupos(ctx), listarMisEvaluaciones(ctx), listarCompetencias(ctx)]);
  if (!grupos.ok) return <ErrorCarga mensaje={grupos.mensaje} />;
  const hayMetodologia = competencias.ok && competencias.datos.some((c) => c.activa);

  return (
    <>
      <p className="mb-4 text-sm font-semibold text-electrico" data-prueba="funciones">
        {textoFunciones(ctx.rol, grupos.datos.length)}
      </p>
      <div className="flex flex-wrap gap-3">
        {hayMetodologia && <EnlaceBoton href="/evaluaciones/nueva">Nueva evaluación</EnlaceBoton>}
        <EnlaceBoton href="/evaluaciones" variante="secundario">
          Todas las evaluaciones
        </EnlaceBoton>
      </div>

      <Seccion titulo="Tus grupos">
        {grupos.datos.length === 0 ? (
          <Vacio>
            No tienes grupos asignados como entrenador/a.{" "}
            {ctx.rol === "director"
              ? "Como director/a puedes asignártelos en Grupos → Editar grupo → Entrenador/a responsable."
              : "Pide a la dirección que te asigne tus grupos."}
          </Vacio>
        ) : (
          <div className="space-y-4">
            {grupos.datos.map((g) => {
              const activos = g.jugadores.filter((j) => j.activo);
              return (
                <section key={g.id} aria-label={`Grupo ${g.nombre}`} className="rounded-2xl bg-noche-700 ring-1 ring-noche-500">
                  <div className="flex items-center justify-between gap-3 px-4 pt-3">
                    <h3 className="min-w-0 truncate font-display text-lg font-bold uppercase italic">{g.nombre}</h3>
                    <Link href={`/grupos/${g.id}`} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-electrico">
                      Ver grupo
                    </Link>
                  </div>
                  {hayMetodologia && activos.length > 0 && (
                    <div className="px-4 pt-2">
                      <Link
                        href={`/entrenamiento/evaluar/${g.id}`}
                        aria-label={`Evaluar el grupo ${g.nombre}`}
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-electrico px-5 text-sm font-bold text-noche"
                      >
                        Evaluar el grupo ({activos.length})
                      </Link>
                    </div>
                  )}
                  {activos.length === 0 ? (
                    <p className="px-4 pb-4 text-sm text-tenue">Sin jugadores activos.</p>
                  ) : (
                    <ul aria-label={`Jugadores de ${g.nombre}`} className="divide-y divide-noche-500">
                      {activos.map((j) => (
                        <li key={j.id} className="flex items-center justify-between gap-3 px-4 py-1">
                          <Link href={`/jugadores/${j.id}`} className="flex min-h-11 min-w-0 items-center font-semibold hover:text-electrico">
                            <span className="truncate">{j.nombre}</span>
                          </Link>
                          {hayMetodologia && (
                            <Link
                              href={`/evaluaciones/nueva?jugador=${j.id}&tipo=rapida`}
                              aria-label={`Evaluar a ${j.nombre}`}
                              className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-bold text-electrico hover:bg-noche-600"
                            >
                              Evaluar
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Tus últimas evaluaciones">
        {!evaluaciones.ok ? (
          <ErrorCarga mensaje={evaluaciones.mensaje} />
        ) : evaluaciones.datos.length > 0 ? (
          <ListaEvaluaciones evaluaciones={evaluaciones.datos} etiqueta="Tus evaluaciones" conJugador />
        ) : (
          <Vacio>Todavía no has hecho ninguna evaluación.</Vacio>
        )}
      </Seccion>
    </>
  );
}
