import Link from "next/link";
import { Suspense } from "react";
import { contextoEscuela, listarGrupos, listarJugadores } from "@/lib/supabase/gestion";
import { NOMBRE_ROL } from "@/lib/acceso";
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
          {ctx.escuelaNombre} · {NOMBRE_ROL[ctx.rol]}
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

      <Seccion titulo="Acciones rápidas">
        <div className="flex flex-wrap gap-3">
          <EnlaceBoton href="/jugadores/nuevo">Nuevo jugador</EnlaceBoton>
          {ctx.rol === "director" && (
            <EnlaceBoton href="/grupos/nuevo" variante="secundario">
              Nuevo grupo
            </EnlaceBoton>
          )}
        </div>
      </Seccion>

      <Seccion titulo="Demostración">
        <Link href="/demo" className="block rounded-2xl border border-naranja/40 bg-naranja/10 p-4 text-sm transition-colors hover:bg-naranja/15">
          <p className="font-bold text-naranja">Evaluaciones y objetivos (datos ficticios)</p>
          <p className="mt-1 text-blanco/80">
            Prueba cómo funcionarán con jugadores inventados. No se mezclan con los datos reales.
          </p>
        </Link>
      </Seccion>
    </>
  );
}
