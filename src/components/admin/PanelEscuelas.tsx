"use client";

import { useActionState, useState, useTransition } from "react";
import { cambiarEstadoEscuela, crearEscuela, invitarDirector, revocarInvitacion, type ResultadoInvitacion } from "@/app/acciones-invitaciones";
import { textoFecha } from "@/lib/format";
import { DIAS_INVITACION, TEXTO_ESTADO_INVITACION, type EstadoInvitacion } from "@/lib/invitaciones";
import { claseBoton } from "@/components/ui";
import { Campo, claseCampo } from "@/components/campos";
import { ErrorAccion, useAccion } from "@/components/gestion/Acciones";

export type EscuelaAdmin = {
  id: string;
  nombre: string;
  estado: "activa" | "suspendida";
  alta: string;
  directores: number;
  miembros: number;
  invitacion: { id: string; email: string; estado: EstadoInvitacion; creada: string; caduca: string } | null;
};

const fecha = (iso: string) => textoFecha(iso.slice(0, 10));
const SIN_CONEXION = "No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo.";

/** Alta de una escuela con la invitación de su director. */
export function FormularioAltaEscuela() {
  const [version, setVersion] = useState(0);
  return <Alta key={version} otra={() => setVersion((v) => v + 1)} />;
}

function Alta({ otra }: { otra: () => void }) {
  const [estado, accion, pendiente] = useActionState(async (previo: ResultadoInvitacion | null, datos: FormData) => {
    try {
      return await crearEscuela(previo, datos);
    } catch {
      return { ok: false, error: SIN_CONEXION } as ResultadoInvitacion;
    }
  }, null);
  if (estado?.ok) {
    return (
      <section aria-labelledby="alta-titulo" className="rounded-2xl bg-noche-700 p-4 ring-1 ring-electrico">
        <h2 id="alta-titulo" className="font-display text-xl font-bold uppercase italic">
          Escuela creada
        </h2>
        <EnlaceGenerado resultado={estado} />
        <button type="button" onClick={otra} className={`${claseBoton.secundario} mt-4`}>
          Crear otra escuela
        </button>
      </section>
    );
  }
  const err = (c: string) => (estado && !estado.ok ? estado.errores?.[c] : undefined);
  return (
    <section aria-labelledby="alta-titulo" className="rounded-2xl bg-noche-700 p-4 ring-1 ring-noche-500">
      <h2 id="alta-titulo" className="mb-3 font-display text-xl font-bold uppercase italic">
        Nueva escuela
      </h2>
      <form action={accion} noValidate className="space-y-4">
        <Campo id="alta-nombre" etiqueta="Nombre de la escuela" error={err("nombre")}>
          <input id="alta-nombre" name="nombre" type="text" autoComplete="off" maxLength={120} className={claseCampo} aria-invalid={!!err("nombre")} aria-describedby={err("nombre") ? "alta-nombre-error" : undefined} />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <Campo id="alta-email" etiqueta="Correo del director/a" error={err("email")}>
            <input id="alta-email" name="email" type="email" autoComplete="off" inputMode="email" className={claseCampo} aria-invalid={!!err("email")} aria-describedby={err("email") ? "alta-email-error" : undefined} />
          </Campo>
          <Campo id="alta-dias" etiqueta="Validez (días)" error={err("dias")}>
            <input id="alta-dias" name="dias" type="number" inputMode="numeric" min={DIAS_INVITACION.min} max={DIAS_INVITACION.max} defaultValue={DIAS_INVITACION.defecto} className={claseCampo} aria-invalid={!!err("dias")} aria-describedby={err("dias") ? "alta-dias-error" : undefined} />
          </Campo>
        </div>
        {estado && !estado.ok && estado.error && (
          <p role="alert" className="text-sm font-semibold text-naranja">
            {estado.error}
          </p>
        )}
        <button type="submit" disabled={pendiente} className={claseBoton.primario}>
          {pendiente ? "Creando…" : "Crear escuela e invitación"}
        </button>
      </form>
    </section>
  );
}

/** El enlace se muestra UNA sola vez: no se guarda en ningún sitio. */
function EnlaceGenerado({ resultado }: { resultado: Extract<ResultadoInvitacion, { ok: true }> }) {
  const [copiado, setCopiado] = useState(false);
  const asunto = encodeURIComponent(`Invitación a ÉVORA PADEL · ${resultado.escuela}`);
  const cuerpo = encodeURIComponent(
    `Hola:\n\nTe invito a dirigir «${resultado.escuela}» en ÉVORA PADEL. Abre este enlace (válido ${resultado.caduca} días, un solo uso) y entra o crea tu cuenta con este correo:\n\n${resultado.enlace}\n`,
  );
  return (
    <div className="mt-3 space-y-3 text-sm">
      <p>
        Invitación para <strong>{resultado.email}</strong> · válida {resultado.caduca} {resultado.caduca === 1 ? "día" : "días"} · un solo uso.
      </p>
      <label htmlFor="enlace-invitacion" className="block text-sm font-semibold">
        Enlace de invitación
      </label>
      <input id="enlace-invitacion" readOnly value={resultado.enlace} onFocus={(e) => e.currentTarget.select()} className={`${claseCampo} font-mono text-xs`} />
      <p role="note" className="rounded-xl border border-naranja/40 bg-naranja/10 px-3 py-2 text-xs font-semibold text-naranja">
        Solo se muestra ahora: no se guarda en ningún sitio. Envíalo únicamente al correo invitado. Si lo pierdes, vuelve a
        invitar (el anterior dejará de servir).
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={claseBoton.primario}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(resultado.enlace);
              setCopiado(true);
            } catch {
              setCopiado(false);
            }
          }}
        >
          {copiado ? "Copiado ✓" : "Copiar enlace"}
        </button>
        <a href={`mailto:${resultado.email}?subject=${asunto}&body=${cuerpo}`} className={claseBoton.secundario}>
          Preparar correo
        </a>
      </div>
    </div>
  );
}

const COLOR_ESTADO: Record<EstadoInvitacion, string> = {
  pendiente: "text-electrico",
  aceptada: "text-blanco",
  revocada: "text-tenue",
  caducada: "text-naranja",
  no_valida: "text-tenue",
};

/** Una escuela: estado, director/a, última invitación y acciones. */
export function FilaEscuela({ escuela: e }: { escuela: EscuelaAdmin }) {
  const { pendiente, error, ejecutar } = useAccion();
  const [invitando, setInvitando] = useState(false);
  const suspendida = e.estado === "suspendida";
  const inv = e.invitacion;
  return (
    <li aria-label={e.nombre} className={`rounded-2xl bg-noche-700 p-4 ring-1 ${suspendida ? "ring-naranja/60" : "ring-noche-500"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="min-w-0 font-semibold">{e.nombre}</h3>
        <span className={`text-xs font-bold ${suspendida ? "text-naranja" : "text-electrico"}`}>{suspendida ? "Suspendida" : "Activa"}</span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-tenue">
        <dt>Alta</dt>
        <dd className="text-blanco">{fecha(e.alta)}</dd>
        <dt>Dirección / miembros</dt>
        <dd className="text-blanco">
          {e.directores} / {e.miembros}
        </dd>
        <dt>Última invitación</dt>
        <dd className="min-w-0 break-words text-blanco">
          {inv ? (
            <>
              {inv.email} · <span className={`font-bold ${COLOR_ESTADO[inv.estado]}`}>{TEXTO_ESTADO_INVITACION[inv.estado]}</span>
              <span className="block text-tenue">
                {fecha(inv.creada)}
                {inv.estado === "pendiente" && ` · caduca el ${fecha(inv.caduca)}`}
              </span>
            </>
          ) : (
            "—"
          )}
        </dd>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setInvitando((v) => !v)} className={claseBoton.secundario} aria-expanded={invitando}>
          {inv?.estado === "pendiente" ? "Volver a invitar" : "Invitar director/a"}
        </button>
        {inv?.estado === "pendiente" && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => window.confirm(`¿Revocar la invitación de ${inv.email}? El enlace dejará de servir.`) && ejecutar(() => revocarInvitacion(inv.id))}
            className={claseBoton.secundario}
          >
            Revocar invitación
          </button>
        )}
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            window.confirm(
              suspendida
                ? `¿Reactivar «${e.nombre}»? Sus usuarios recuperan el acceso a todos sus datos.`
                : `¿Suspender «${e.nombre}»? Sus usuarios no podrán ver ni cambiar sus datos hasta reactivarla. No se borra nada.`,
            ) && ejecutar(() => cambiarEstadoEscuela(e.id, suspendida ? "activa" : "suspendida"))
          }
          className={suspendida ? claseBoton.primario : claseBoton.secundario}
        >
          {suspendida ? "Reactivar acceso" : "Suspender acceso"}
        </button>
      </div>
      <ErrorAccion error={error} />
      {invitando && <Invitar escuela={e} emailInicial={inv?.email ?? ""} />}
    </li>
  );
}

function Invitar({ escuela, emailInicial }: { escuela: EscuelaAdmin; emailInicial: string }) {
  const [email, setEmail] = useState(emailInicial);
  const [dias, setDias] = useState(String(DIAS_INVITACION.defecto));
  const [resultado, setResultado] = useState<ResultadoInvitacion | null>(null);
  const [pendiente, iniciar] = useTransition();
  if (resultado?.ok) return <EnlaceGenerado resultado={resultado} />;
  const err = (c: string) => (resultado && !resultado.ok ? resultado.errores?.[c] : undefined);
  const id = `inv-${escuela.id}`;
  return (
    <form
      noValidate
      className="mt-4 space-y-3 border-t border-noche-500 pt-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        iniciar(async () => {
          try {
            setResultado(await invitarDirector(escuela.id, escuela.nombre, email, dias));
          } catch {
            setResultado({ ok: false, error: SIN_CONEXION });
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <Campo id={`${id}-email`} etiqueta="Correo del director/a" error={err("email")}>
          <input id={`${id}-email`} type="email" inputMode="email" autoComplete="off" value={email} onChange={(x) => setEmail(x.target.value)} className={claseCampo} />
        </Campo>
        <Campo id={`${id}-dias`} etiqueta="Validez (días)" error={err("dias")}>
          <input id={`${id}-dias`} type="number" inputMode="numeric" min={DIAS_INVITACION.min} max={DIAS_INVITACION.max} value={dias} onChange={(x) => setDias(x.target.value)} className={claseCampo} />
        </Campo>
      </div>
      {resultado && !resultado.ok && resultado.error && (
        <p role="alert" className="text-sm font-semibold text-naranja">
          {resultado.error}
        </p>
      )}
      <p className="text-xs text-tenue">Si hay una invitación pendiente, dejará de servir.</p>
      <button type="submit" disabled={pendiente} className={claseBoton.primario}>
        {pendiente ? "Generando…" : "Generar invitación"}
      </button>
    </form>
  );
}
