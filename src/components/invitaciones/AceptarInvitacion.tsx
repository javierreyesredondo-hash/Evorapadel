"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { aceptarInvitacion, consultarInvitacion, crearCuentaYAceptar, type VistaInvitacion } from "@/app/acciones-invitaciones";
import { RUTA_ACCESO, RUTA_SALIR } from "@/lib/acceso";
import { esTokenValido, MIN_CONTRASENA, RUTA_INVITACION } from "@/lib/invitaciones";
import { claseBoton } from "@/components/ui";
import { Campo, claseCampo } from "@/components/campos";

// Página del enlace de invitación. El token llega en el fragmento («#…»): no
// viaja al servidor al cargar la página ni queda en sus registros. Se guarda
// en sessionStorage (solo esta pestaña) para sobrevivir al inicio de sesión y
// se quita de la barra de direcciones; al aceptar se borra.

const CLAVE = "evora-invitacion";
const SIN_CONEXION = "No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo.";

function leerToken(): string | null {
  try {
    const delEnlace = window.location.hash.slice(1);
    if (esTokenValido(delEnlace)) {
      sessionStorage.setItem(CLAVE, delEnlace);
      window.history.replaceState(null, "", RUTA_INVITACION);
      return delEnlace;
    }
    const guardado = sessionStorage.getItem(CLAVE);
    return esTokenValido(guardado) ? guardado : null;
  } catch {
    return null;
  }
}

function olvidarToken() {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: nada que borrar */
  }
}

type Estado = { cargando: true } | { cargando: false; token: string | null; vista: VistaInvitacion | null; errorRed: boolean };

export function AceptarInvitacion() {
  const [estado, setEstado] = useState<Estado>({ cargando: true });

  const cargar = useCallback(async () => {
    const token = leerToken();
    if (!token) return setEstado({ cargando: false, token: null, vista: null, errorRed: false });
    setEstado({ cargando: true });
    try {
      setEstado({ cargando: false, token, vista: await consultarInvitacion(token), errorRed: false });
    } catch {
      setEstado({ cargando: false, token, vista: null, errorRed: true });
    }
  }, []);

  useEffect(() => {
    // Leer el fragmento y sessionStorage solo es posible en el navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  if (estado.cargando) {
    return (
      <p role="status" className="py-6 text-center text-sm text-tenue">
        Comprobando la invitación…
      </p>
    );
  }
  if (!estado.token) {
    return (
      <Tarjeta titulo="Invitación">
        <p>Abre el enlace completo que te enviaron (incluida la parte final, después de «#»).</p>
      </Tarjeta>
    );
  }
  if (estado.errorRed || !estado.vista) {
    return (
      <Tarjeta titulo="Invitación">
        <p role="alert">{SIN_CONEXION}</p>
        <button type="button" onClick={() => void cargar()} className={`${claseBoton.primario} mt-4`}>
          Reintentar
        </button>
      </Tarjeta>
    );
  }

  const v = estado.vista;
  const irAlAcceso = (
    <Link href={`${RUTA_ACCESO}?siguiente=${encodeURIComponent(RUTA_INVITACION)}`} className={`${claseBoton.secundario} w-full`}>
      Ya tengo cuenta: iniciar sesión
    </Link>
  );

  if (v.estado === "requiere_sesion") {
    return (
      <Tarjeta titulo="Tienes una invitación">
        <p>{v.mensaje}</p>
        <p className="mt-2">¿Todavía no tienes cuenta? Pide a ÉVORA PADEL que la cree para el correo invitado.</p>
        <div className="mt-4">{irAlAcceso}</div>
      </Tarjeta>
    );
  }
  if (v.estado !== "pendiente") {
    return (
      <Tarjeta titulo="Invitación no disponible">
        <p role="alert">{v.mensaje}</p>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo="Invitación">
      <p>
        ÉVORA PADEL te invita a dirigir <strong className="text-blanco">{v.escuela}</strong>.
      </p>
      <p className="mt-1">
        Correo invitado: <strong className="text-blanco">{v.email}</strong>
      </p>
      {v.sesion ? (
        v.sesion.coincide ? (
          <Aceptar token={estado.token} />
        ) : (
          <div className="mt-4 space-y-3">
            <p role="alert" className="font-semibold text-naranja">
              Has iniciado sesión como {v.sesion.email}, pero la invitación es para otro correo. Cierra sesión, entra con el
              correo invitado y vuelve a abrir el enlace.
            </p>
            <form method="post" action={RUTA_SALIR}>
              <button type="submit" className={`${claseBoton.secundario} w-full`}>
                Cerrar sesión
              </button>
            </form>
          </div>
        )
      ) : (
        <div className="mt-5 space-y-5">
          {irAlAcceso}
          {v.puedeCrearCuenta ? (
            <CrearCuenta token={estado.token} />
          ) : (
            <p>¿No tienes cuenta? Pide a ÉVORA PADEL que la cree para este correo y después inicia sesión.</p>
          )}
        </div>
      )}
    </Tarjeta>
  );
}

function Aceptar({ token }: { token: string }) {
  const router = useRouter();
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function aceptar() {
    if (pendiente) return;
    setPendiente(true);
    setError(null);
    try {
      const r = await aceptarInvitacion(token);
      if (r.ok) {
        olvidarToken();
        router.replace("/");
        return;
      }
      setError(r.error);
    } catch {
      setError(SIN_CONEXION);
    }
    setPendiente(false);
  }
  return (
    <div className="mt-5">
      <button type="button" onClick={aceptar} disabled={pendiente} className={`${claseBoton.primario} w-full`}>
        {pendiente ? "Aceptando…" : "Aceptar invitación"}
      </button>
      {error && (
        <p role="alert" className="mt-3 font-semibold text-naranja">
          {error}
        </p>
      )}
    </div>
  );
}

function CrearCuenta({ token }: { token: string }) {
  const router = useRouter();
  const [contrasena, setContrasena] = useState("");
  const [repetida, setRepetida] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (pendiente) return;
    setPendiente(true);
    setError(null);
    setErrores({});
    try {
      const r = await crearCuentaYAceptar(token, contrasena, repetida);
      if (r.ok) {
        olvidarToken();
        router.replace("/");
        return;
      }
      setError(r.error);
      setErrores(r.errores ?? {});
    } catch {
      setError(SIN_CONEXION);
    }
    setPendiente(false);
  }

  return (
    <form onSubmit={crear} noValidate className="space-y-4 border-t border-noche-500 pt-5">
      <p className="font-semibold text-blanco">¿Primera vez? Crea tu cuenta con el correo invitado</p>
      <Campo id="inv-contrasena" etiqueta="Contraseña nueva" error={errores.contrasena} ayuda={`Al menos ${MIN_CONTRASENA} caracteres.`}>
        <input
          id="inv-contrasena"
          type="password"
          autoComplete="new-password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          aria-invalid={!!errores.contrasena}
          aria-describedby={errores.contrasena ? "inv-contrasena-error" : undefined}
          className={claseCampo}
        />
      </Campo>
      <Campo id="inv-repetida" etiqueta="Repite la contraseña" error={errores.repetida}>
        <input
          id="inv-repetida"
          type="password"
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
          aria-invalid={!!errores.repetida}
          aria-describedby={errores.repetida ? "inv-repetida-error" : undefined}
          className={claseCampo}
        />
      </Campo>
      {error && (
        <p role="alert" className="font-semibold text-naranja">
          {error}
        </p>
      )}
      <button type="submit" disabled={pendiente} className={`${claseBoton.primario} w-full`}>
        {pendiente ? "Creando tu cuenta…" : "Crear cuenta y aceptar"}
      </button>
    </form>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby="invitacion-titulo" className="rounded-2xl bg-noche-700 p-5 text-sm text-tenue ring-1 ring-noche-500">
      <h1 id="invitacion-titulo" className="mb-3 font-display text-2xl font-extrabold uppercase italic leading-none text-blanco">
        {titulo}
      </h1>
      {children}
    </section>
  );
}
