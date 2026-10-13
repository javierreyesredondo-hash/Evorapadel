import type { ReactNode } from "react";
import { CATEGORIA_TEXTO, type ContenidoMetodologia } from "@/lib/metodologias/modelo";

// Contenido guardado de una metodología importada (solo lectura).

type Contenido = ContenidoMetodologia;

export function VistaMetodologia({ contenido: c }: { contenido: Contenido }) {
  const grupos = new Map<string, Contenido["competencias"]>();
  for (const x of c.competencias) grupos.set(x.grupo, [...(grupos.get(x.grupo) ?? []), x]);

  return (
    <div className="space-y-8">
      {c.fases.length > 0 && (
        <Bloque titulo="Fases">
          <ol className="grid gap-3 sm:grid-cols-2">
            {c.fases.map((f, i) => (
              <li key={i} className="rounded-2xl bg-noche-700 p-3 ring-1 ring-noche-500">
                <p className="font-bold">
                  {f.numero !== null && <span className="mr-2 text-electrico">{String(f.numero).padStart(2, "0")}</span>}
                  {f.nombre}
                </p>
                {f.descripcion && <p className="mt-1 text-sm text-blanco/80">{f.descripcion}</p>}
              </li>
            ))}
          </ol>
        </Bloque>
      )}

      {c.principios.length > 0 && (
        <Bloque titulo="Principios">
          <ul className="space-y-2">
            {c.principios.map((x, i) => (
              <li key={i} className="rounded-2xl bg-noche-700 p-3 ring-1 ring-noche-500">
                <p className="font-bold">{x.nombre}</p>
                {x.descripcion && <p className="mt-1 text-sm text-blanco/80">{x.descripcion}</p>}
              </li>
            ))}
          </ul>
        </Bloque>
      )}

      <Bloque titulo="Escala">
        {c.escala.length === 0 ? (
          <p className="text-sm text-tenue">Sin escala propia: se usa la de ÉVORA.</p>
        ) : (
          <dl className="space-y-2">
            {c.escala.map((n) => (
              <div key={n.valor} className="flex gap-3 rounded-2xl bg-noche-700 p-3 ring-1 ring-noche-500">
                <dt className="font-display text-2xl font-extrabold text-electrico">{n.valor}</dt>
                <dd>
                  <p className="font-bold">{n.nombre}</p>
                  {n.descripcion && <p className="text-sm text-blanco/80">{n.descripcion}</p>}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Bloque>

      <Bloque titulo="Áreas, competencias e indicadores">
        {[...grupos].map(([grupo, lista]) => (
          <div key={grupo} className="rounded-2xl bg-noche-700 p-3 ring-1 ring-noche-500">
            <h3 className="font-display text-lg font-bold uppercase italic">{grupo}</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {lista.map((x) => (
                <li key={x.nombre} className="flex flex-wrap justify-between gap-x-3">
                  <span>{x.nombre}</span>
                  <span className={`text-xs font-bold ${x.evaluable ? "text-electrico" : "text-tenue"}`}>
                    {x.evaluable ? "Se evalúa 1–5" : x.puntuable ? "1–5 en la ficha" : "Observación"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Bloque>

      {c.fichas.length > 0 && (
        <Bloque titulo="Fichas">
          {c.fichas.map((f, i) => (
            <details key={i} className="rounded-2xl bg-noche-700 ring-1 ring-noche-500">
              <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-2 font-bold">
                {f.numero !== null && <span className="text-electrico">Ficha {String(f.numero).padStart(2, "0")}</span>}
                {f.titulo}
              </summary>
              <div className="space-y-3 border-t border-noche-500 p-4 text-sm">
                {f.descripcion && <p className="text-blanco/80">{f.descripcion}</p>}
                {f.secciones.map((s, j) => (
                  <div key={j}>
                    <p className="font-bold">
                      {s.titulo}
                      {s.categoria && <span className="ml-2 text-xs font-normal text-tenue">{CATEGORIA_TEXTO[s.categoria]}</span>}
                    </p>
                    <ul className="mt-1 list-disc pl-5 text-blanco/80">
                      {s.campos.map((campo, k) => (
                        <li key={k}>
                          {campo.etiqueta}
                          {campo.tipo === "escala" && " (1–5)"}
                          {campo.tipo === "opciones" && campo.opciones && `: ${campo.opciones.join(" / ")}`}
                          {campo.tipo === "tabla" && campo.filas && `: ${campo.filas.join(", ")}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </Bloque>
      )}

      {c.textos.length > 0 && (
        <Bloque titulo="Textos">
          {c.textos.map((t, i) => (
            <div key={i}>
              <h3 className="font-bold">{t.titulo}</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-blanco/80">{t.texto}</p>
            </div>
          ))}
        </Bloque>
      )}
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-bold uppercase italic tracking-wide">{titulo}</h2>
      {children}
    </section>
  );
}

export const ESTADO_TEXTO = { borrador: "Borrador", activa: "Activa", archivada: "Archivada" } as const;
