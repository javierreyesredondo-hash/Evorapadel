// Invitaciones privadas para dirigir una escuela (lógica pura, sin Next ni
// Supabase; probada con node --test).
//
// El token es aleatorio (32 bytes, Web Crypto) y solo viaja en el ENLACE, en el
// fragmento «#…»: el navegador no lo envía al servidor al abrir la página, así
// que no aparece en los registros de peticiones. La base de datos guarda solo
// su SHA-256. Nunca se registra en logs.

import { MAX_CONTRASENA, MAX_EMAIL } from "./acceso.ts";
import type { Validacion } from "./gestion.ts";

export const DIAS_INVITACION = { defecto: 7, min: 1, max: 30 } as const;
export const MIN_CONTRASENA = 10;
export const RUTA_INVITACION = "/invitacion";

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATRON_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Token de invitación: 32 bytes aleatorios en base64url (43 caracteres). */
export function generarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function esTokenValido(t: unknown): t is string {
  return typeof t === "string" && PATRON_TOKEN.test(t);
}

/** SHA-256 (hex) del token: lo único que se guarda en la base de datos. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Enlace que el propietario entrega al director (el token va en el fragmento). */
export function enlaceInvitacion(origen: string, token: string): string {
  return `${origen.replace(/\/+$/, "")}${RUTA_INVITACION}#${token}`;
}

/** «n***a@evora.invalid»: identifica el correo sin mostrarlo entero. */
export function enmascararEmail(email: string): string {
  const [usuario, dominio] = email.split("@");
  if (!usuario || !dominio) return "***";
  const visible = usuario.length <= 2 ? `${usuario[0]}***` : `${usuario[0]}***${usuario[usuario.length - 1]}`;
  return `${visible}@${dominio}`;
}

export function normalizarEmail(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

export type DatosInvitacion = { email: string; dias: number };
export type DatosAltaEscuela = DatosInvitacion & { nombre: string };

export function validarInvitacion(entrada: { email?: unknown; dias?: unknown }): Validacion<DatosInvitacion> {
  const errores: Record<string, string> = {};
  const email = normalizarEmail(entrada.email);
  if (email === "") errores.email = "Escribe el correo del director/a.";
  else if (email.length > MAX_EMAIL || !PATRON_EMAIL.test(email)) errores.email = "Escribe un correo electrónico válido.";
  const textoDias = typeof entrada.dias === "string" ? entrada.dias.trim() : String(entrada.dias ?? "");
  const dias = textoDias === "" ? DIAS_INVITACION.defecto : Number(textoDias);
  if (!Number.isInteger(dias) || dias < DIAS_INVITACION.min || dias > DIAS_INVITACION.max) {
    errores.dias = `Entre ${DIAS_INVITACION.min} y ${DIAS_INVITACION.max} días.`;
  }
  return Object.keys(errores).length > 0 ? { ok: false, errores } : { ok: true, valor: { email, dias } };
}

export function validarAltaEscuela(entrada: { nombre?: unknown; email?: unknown; dias?: unknown }): Validacion<DatosAltaEscuela> {
  const nombre = typeof entrada.nombre === "string" ? entrada.nombre.trim().replace(/\s+/g, " ") : "";
  const r = validarInvitacion(entrada);
  const errores: Record<string, string> = r.ok ? {} : { ...r.errores };
  if (nombre.length < 2) errores.nombre = "Escribe el nombre de la escuela (al menos 2 caracteres).";
  else if (nombre.length > 120) errores.nombre = "Máximo 120 caracteres.";
  if (Object.keys(errores).length > 0 || !r.ok) return { ok: false, errores };
  return { ok: true, valor: { nombre, ...r.valor } };
}

/** Contraseña de una cuenta nueva (la elige el director al aceptar). */
export function validarContrasenaNueva(contrasena: unknown, repetida: unknown): Validacion<string> {
  const c = typeof contrasena === "string" ? contrasena : "";
  const errores: Record<string, string> = {};
  if (c.length < MIN_CONTRASENA) errores.contrasena = `Al menos ${MIN_CONTRASENA} caracteres.`;
  else if (new TextEncoder().encode(c).length > MAX_CONTRASENA) errores.contrasena = `Máximo ${MAX_CONTRASENA} caracteres.`;
  else if (c !== repetida) errores.repetida = "Las contraseñas no coinciden.";
  return Object.keys(errores).length > 0 ? { ok: false, errores } : { ok: true, valor: c };
}

export type EstadoInvitacion = "pendiente" | "aceptada" | "revocada" | "caducada" | "no_valida";

export const TEXTO_ESTADO_INVITACION: Record<EstadoInvitacion, string> = {
  pendiente: "Pendiente",
  aceptada: "Aceptada",
  revocada: "Revocada",
  caducada: "Caducada",
  no_valida: "No válida",
};

/** Mensaje claro para cada motivo por el que no se puede aceptar (no revela nada más). */
export function mensajeInvitacion(codigo: string | null | undefined): string {
  switch (codigo) {
    case "caducada":
    case "INVITACION_CADUCADA":
      return "Esta invitación ha caducado. Pide a ÉVORA PADEL que te envíe una nueva.";
    case "revocada":
    case "INVITACION_REVOCADA":
      return "Esta invitación ya no es válida (se ha anulado o sustituido por otra). Pide una nueva a ÉVORA PADEL.";
    case "aceptada":
    case "INVITACION_USADA":
      return "Esta invitación ya se ha usado.";
    case "INVITACION_OTRO_CORREO":
      return "Esta invitación es para otro correo. Cierra sesión y entra con el correo al que se envió.";
    default:
      return "El enlace de invitación no es válido. Comprueba que lo has copiado completo.";
  }
}

/** Código de una invitación rechazada por la base de datos (el mensaje del error es el código). */
export function codigoErrorInvitacion(error: { message?: string | null } | null | undefined): string | null {
  const m = /INVITACION_[A-Z_]+/.exec(error?.message ?? "");
  return m ? m[0] : null;
}
