import Link from "next/link";
import { Suspense } from "react";
import { contextoEscuela, listarGrupos, listarJugadores } from "@/lib/supabase/gestion";
import { textoFunciones } from "@/lib/gestion";
import { EnlaceBoton, Seccion } from "@/components/ui";
import { Cargando, ErrorCarga } from "@/components/gestion/Estados";

export default function Page() {
  return (
    <Suspense fallback={<Cargando texto="Cargando tu escuela…" />}>
      <Inicio />
    </Suspense>
  );
}

async function Inicio() {
  const ctx = await contextoEscuela();
  if (!ctx) return <ErrorCarga />;
  const [jugadores, grupos] = await Promise.all([listarJugadores(ctx), listarGrupos(ctx)]);
  // Grupos que entrena (filtrados de los ya leídos por su id de sesión).
  const misGrupos = grupos.ok ? grupos.datos.filter((g) => g.entrenador_id === ctx.usuarioId) : [];
  if (!jugadores.ok || !grupos.ok) return <ErrorCarga mensaje={!jugadores.ok ? jugadores.mensaje : !grupos.ok ? grupos.mensaje : undefined} />;

  const activos = jugadores.datos.filter((j) => j.activo);
  const sinGrupo = activos.filter((j) => j.grupos.length === 0).length;
  const datos = [
    { valor: activos.length, texto: "Jugadores activos", href: "/jugadores" },
    { valor: grupos.datos.length, texto: "Grupos", href: "/grupos" },
    { valor: sinGrupo, texto: "Activos sin grupo", href: "/jugadores" },
  ];

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl bg-electrico p-5 text-noche">
        <p className="text-sm font-semibold">
          {ctx.escuelaNombre} · <span data-prueba="funciones">{textoFunciones(ctx.rol, misGrupos.length)}</span>
        </p>
        <h1 className="mt-1 font-display text-4xl font-extrabold uppercase italic leading-[0.95] tracking-tight sm:text-5xl">
          Observa.
          <br />
          Mide.
          <br />
          Haz crecer.
        </h1>
        <span aria-hidden="true" className="absolute -right-8 -top-8 size-32 rounded-full border-[14px] border-noche/10" />
      </section>

      <ul className="mt-4 grid grid-cols-3 gap-3">
        {datos.map((d) => (
          <li key={d.texto}>
            <Link href={d.href} className="block h-full rounded-2xl bg-noche-700 p-3 ring-1 ring-noche-500 transition-colors hover:ring-electrico">
              <p className="font-display text-3xl font-bold leading-none">{d.valor}</p>
              <p className="mt-1 text-xs leading-tight text-tenue">{d.texto}</p>
            </Link>
          </li>
        ))}
      </ul>

      {/* Las tareas de entrenamiento y las de dirección, separadas pero en la misma
          sesión: un director que entrena ve las dos sin cambiar de cuenta. */}
      <Seccion titulo="Entrenamiento">
        <p className="mb-3 text-sm text-tenue">
          {misGrupos.length > 0
            ? `Entrenas ${misGrupos.length === 1 ? "1 grupo" : `${misGrupos.length} grupos`}: ${misGrupos.map((g) => g.nombre).join(", ")}.`
            : "No tienes grupos asignados como entrenador/a."}
        </p>
        <div className="flex flex-wrap gap-3">
          <EnlaceBoton href="/entrenamiento">Mi entrenamiento</EnlaceBoton>
          <EnlaceBoton href="/evaluaciones/nueva" variante="secundario">
            Nueva evaluación
          </EnlaceBoton>
          <EnlaceBoton href="/jugadores/nuevo" variante="secundario">
            Nuevo jugador
          </EnlaceBoton>
        </div>
      </Seccion>

      {ctx.rol === "director" && (
        <Seccion titulo="Dirección">
          <p className="mb-3 text-sm text-tenue">Gestión de la escuela: grupos y entrenadores, y metodología.</p>
          <div className="flex flex-wrap gap-3">
            <EnlaceBoton href="/grupos/nuevo">Nuevo grupo</EnlaceBoton>
            <EnlaceBoton href="/grupos" variante="secundario">
              Gestionar grupos
            </EnlaceBoton>
            <EnlaceBoton href="/metodologia" variante="secundario">
              Metodología
            </EnlaceBoton>
          </div>
        </Seccion>
      )}

      <Seccion titulo="Demostración">
        <Link href="/demo" className="block rounded-2xl border border-naranja/40 bg-naranja/10 p-4 text-sm transition-colors hover:bg-naranja/15">
          <p className="font-bold text-naranja">Seguimiento de objetivos con progreso (demostración)</p>
          <p className="mt-1 text-blanco/80">
            Todavía no está en la versión real. Se prueba con jugadores inventados y lo que hagas allí se
            guarda solo en este navegador: no forma parte de tu escuela. Tus evaluaciones reales están en
            «Entrenar» y en la ficha de cada jugador.
          </p>
        </Link>
      </Seccion>
    </>
  );
}
