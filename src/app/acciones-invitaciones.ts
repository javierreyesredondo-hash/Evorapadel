"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import type { ResultadoAccion } from "@/app/acciones-gestion";
import { esUuid } from "@/lib/gestion";
import {
  codigoErrorInvitacion,
  enlaceInvitacion,
  enmascararEmail,
  esTokenValido,
  generarToken,
  hashToken,
  mensajeInvitacion,
  validarAltaEscuela,
  validarContrasenaNueva,
  validarInvitacion,
  type EstadoInvitacion,
} from "@/lib/invitaciones";
import { clienteAdministracion, crearCuentaInvitada } from "@/lib/supabase/administracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Alta de escuelas e invitaciones privadas.
//
// Seguridad:
//   * Las operaciones del panel las autoriza la BASE DE DATOS (funciones que
//     comprueban que quien llama está en privado.administradores). La app no
//     confía en ningún rol enviado por el navegador.
//   * El token se genera aquí (Web Crypto) y solo se devuelve UNA vez, dentro
//     del enlace; a la base de datos llega su SHA-256. Nunca se registra.
//   * CSRF: las Server Actions de Next solo aceptan peticiones del mismo origen.
//   * La clave secreta (opcional) solo se usa para crear la cuenta de un correo
//     que tiene una invitación pendiente (ver lib/supabase/administracion.ts).

const SIN_SESION = "Tu sesión ha caducado. Vuelve a iniciar sesión.";
const SOLO_ADMIN = "Solo el administrador de ÉVORA PADEL puede hacer esto.";

type ErrorBD = { code?: string; message?: string } | null;

function registrar(origen: string, error: ErrorBD) {
  // Solo el código: nunca tokens, correos ni mensajes con datos.
  console.error(`ÉVORA PADEL: error en ${origen}`, error?.code);
}

function mensajeAdmin(error: NonNullable<ErrorBD>): string {
  if (error.code === "42501") return SOLO_ADMIN;
  if (error.code === "22023" || error.code === "P0002") return error.message ?? "Revisa los datos.";
  if (error.code === "23505") return "No se ha podido generar la invitación. Inténtalo de nuevo.";
  return "No se ha podido completar la operación. Inténtalo de nuevo en unos minutos.";
}

/** Origen de la app para el enlace (el de la propia petición). */
async function origen(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto.split(",")[0].trim()}://${host}`;
}

async function clienteConSesion() {
  const supabase = await crearClienteServidor();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, usuario: data.user } : null;
}

// ------------------------------------------------------------ panel global

export type ResultadoInvitacion =
  | { ok: true; enlace: string; email: string; escuela: string; caduca: number }
  | { ok: false; error?: string; errores?: Record<string, string> };

/** Crea una escuela y la invitación de su director. Devuelve el enlace UNA vez. */
export async function crearEscuela(_previo: ResultadoInvitacion | null, datos: FormData): Promise<ResultadoInvitacion> {
  const s = await clienteConSesion();
  if (!s) return { ok: false, error: SIN_SESION };
  const v = validarAltaEscuela({ nombre: datos.get("nombre"), email: datos.get("email"), dias: datos.get("dias") });
  if (!v.ok) return { ok: false, errores: v.errores };
  const token = generarToken();
  const { error } = await s.supabase.rpc("admin_crear_escuela", {
    p_nombre: v.valor.nombre,
    p_email: v.valor.email,
    p_token_hash: await hashToken(token),
    p_dias: v.valor.dias,
  });
  if (error) {
    registrar("alta de escuela", error);
    return { ok: false, error: mensajeAdmin(error) };
  }
  refresh();
  return { ok: true, enlace: enlaceInvitacion(await origen(), token), email: v.valor.email, escuela: v.valor.nombre, caduca: v.valor.dias };
}

/** Nueva invitación para dirigir una escuela (revoca la pendiente anterior). */
export async function invitarDirector(escuelaId: string, escuelaNombre: string, email: string, dias: string): Promise<ResultadoInvitacion> {
  const s = await clienteConSesion();
  if (!s) return { ok: false, error: SIN_SESION };
  if (!esUuid(escuelaId)) return { ok: false, error: "Escuela no encontrada." };
  const v = validarInvitacion({ email, dias });
  if (!v.ok) return { ok: false, errores: v.errores };
  const token = generarToken();
  const { error } = await s.supabase.rpc("admin_invitar", {
    p_escuela: escuelaId,
    p_email: v.valor.email,
    p_token_hash: await hashToken(token),
    p_dias: v.valor.dias,
  });
  if (error) {
    registrar("invitación", error);
    return { ok: false, error: mensajeAdmin(error) };
  }
  refresh();
  return { ok: true, enlace: enlaceInvitacion(await origen(), token), email: v.valor.email, escuela: String(escuelaNombre).slice(0, 120), caduca: v.valor.dias };
}

export async function revocarInvitacion(invitacionId: string): Promise<ResultadoAccion> {
  const s = await clienteConSesion();
  if (!s) return { ok: false, error: SIN_SESION };
  if (!esUuid(invitacionId)) return { ok: false, error: "Invitación no encontrada." };
  const { error } = await s.supabase.rpc("admin_revocar_invitacion", { p_invitacion: invitacionId });
  if (error) {
    registrar("revocar invitación", error);
    return { ok: false, error: mensajeAdmin(error) };
  }
  refresh();
  return { ok: true, mensaje: "Invitación revocada: el enlace ya no sirve." };
}

export async function cambiarEstadoEscuela(escuelaId: string, estado: "activa" | "suspendida"): Promise<ResultadoAccion> {
  const s = await clienteConSesion();
  if (!s) return { ok: false, error: SIN_SESION };
  if (!esUuid(escuelaId) || (estado !== "activa" && estado !== "suspendida")) return { ok: false, error: "Escuela no encontrada." };
  const { error } = await s.supabase.rpc("admin_cambiar_estado_escuela", { p_escuela: escuelaId, p_estado: estado });
  if (error) {
    registrar("estado de escuela", error);
    return { ok: false, error: mensajeAdmin(error) };
  }
  refresh();
  return { ok: true, mensaje: estado === "suspendida" ? "Escuela suspendida. Sus datos se conservan." : "Escuela reactivada." };
}

// -------------------------------------------------------------- invitado

export type VistaInvitacion =
  | {
      estado: EstadoInvitacion;
      escuela: string | null;
      /** Correo invitado, enmascarado. */
      email: string | null;
      /** Sesión actual y si su correo es el invitado. */
      sesion: { email: string; coincide: boolean } | null;
      /** El servidor puede crear la cuenta (clave secreta configurada). */
      puedeCrearCuenta: boolean;
      mensaje: string | null;
    }
  | { estado: "requiere_sesion"; puedeCrearCuenta: false; mensaje: string };

type FilaInvitacion = { estado: EstadoInvitacion; escuela_nombre: string | null; email: string | null };

/** Lo que se puede mostrar de una invitación a quien tiene el enlace. */
export async function consultarInvitacion(token: string): Promise<VistaInvitacion> {
  const noValida = { estado: "no_valida" as const, escuela: null, email: null, sesion: null, puedeCrearCuenta: false, mensaje: mensajeInvitacion(null) };
  if (!esTokenValido(token)) return noValida;
  const hash = await hashToken(token);
  const s = await clienteConSesion();
  const admin = clienteAdministracion();
  const cliente = s?.supabase ?? admin;
  if (!cliente) {
    return {
      estado: "requiere_sesion",
      puedeCrearCuenta: false,
      mensaje: "Inicia sesión con el correo al que te enviaron la invitación para verla y aceptarla.",
    };
  }
  const { data, error } = await cliente.rpc("consultar_invitacion", { p_token_hash: hash }).maybeSingle<FilaInvitacion>();
  if (error || !data) {
    registrar("consulta de invitación", error);
    return { ...noValida, mensaje: "No se ha podido comprobar la invitación. Inténtalo de nuevo en unos minutos." };
  }
  const email = data.email ?? null;
  return {
    estado: data.estado,
    escuela: data.estado === "no_valida" ? null : data.escuela_nombre,
    email: email ? enmascararEmail(email) : null,
    sesion: s ? { email: s.usuario.email ?? "", coincide: !!email && (s.usuario.email ?? "").toLowerCase() === email } : null,
    puedeCrearCuenta: !s && !!admin && data.estado === "pendiente",
    mensaje: data.estado === "pendiente" ? null : mensajeInvitacion(data.estado),
  };
}

export type ResultadoAceptar = { ok: true } | { ok: false; error: string; errores?: Record<string, string> };

/** Acepta la invitación con la cuenta de la sesión (la base de datos comprueba el correo). */
export async function aceptarInvitacion(token: string): Promise<ResultadoAceptar> {
  if (!esTokenValido(token)) return { ok: false, error: mensajeInvitacion(null) };
  const s = await clienteConSesion();
  if (!s) return { ok: false, error: SIN_SESION };
  const { error } = await s.supabase.rpc("aceptar_invitacion", { p_token_hash: await hashToken(token) });
  if (error) {
    registrar("aceptar invitación", error);
    const codigo = codigoErrorInvitacion(error);
    return { ok: false, error: codigo ? mensajeInvitacion(codigo) : "No se ha podido aceptar la invitación. Inténtalo de nuevo." };
  }
  refresh();
  return { ok: true };
}

/**
 * Director sin cuenta: crea la cuenta del correo INVITADO (nunca de otro), con
 * la contraseña que elige, inicia su sesión y acepta. Requiere la clave secreta
 * en el servidor; sin ella, el propietario crea la cuenta en Supabase.
 */
export async function crearCuentaYAceptar(token: string, contrasena: string, repetida: string): Promise<ResultadoAceptar> {
  if (!esTokenValido(token)) return { ok: false, error: mensajeInvitacion(null) };
  const v = validarContrasenaNueva(contrasena, repetida);
  if (!v.ok) return { ok: false, error: "Revisa la contraseña.", errores: v.errores };
  const admin = clienteAdministracion();
  if (!admin) return { ok: false, error: "La app no puede crear cuentas: pide a ÉVORA PADEL que cree la tuya y después inicia sesión." };

  const hash = await hashToken(token);
  const { data, error } = await admin.rpc("consultar_invitacion", { p_token_hash: hash }).maybeSingle<FilaInvitacion>();
  if (error || !data) {
    registrar("consulta de invitación", error);
    return { ok: false, error: "No se ha podido comprobar la invitación. Inténtalo de nuevo." };
  }
  if (data.estado !== "pendiente" || !data.email) return { ok: false, error: mensajeInvitacion(data.estado) };

  const cuenta = await crearCuentaInvitada(admin, data.email, v.valor);
  if (!cuenta.ok) {
    return {
      ok: false,
      error: cuenta.existe
        ? "Ya existe una cuenta con este correo: inicia sesión con ella para aceptar la invitación."
        : "No se ha podido crear la cuenta. Inténtalo de nuevo en unos minutos.",
    };
  }
  const supabase = await crearClienteServidor();
  if (!supabase) return { ok: false, error: "La conexión con la base de datos no está configurada." };
  const { error: errorSesion } = await supabase.auth.signInWithPassword({ email: data.email, password: v.valor });
  if (errorSesion) {
    registrar("inicio de sesión tras crear la cuenta", { code: errorSesion.code });
    return { ok: false, error: "Tu cuenta se ha creado, pero no se ha podido iniciar sesión. Entra desde «Iniciar sesión» y vuelve a abrir el enlace." };
  }
  const { error: errorAceptar } = await supabase.rpc("aceptar_invitacion", { p_token_hash: hash });
  if (errorAceptar) {
    registrar("aceptar invitación", errorAceptar);
    return { ok: false, error: mensajeInvitacion(codigoErrorInvitacion(errorAceptar)) };
  }
  refresh();
  return { ok: true };
}
