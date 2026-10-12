// Lógica pura del acceso con Supabase (sin Next ni red), probada con node --test.

// ------------------------------------------------------------- Configuración

export type ConfigSupabase = { url: string; clavePublica: string };

export type ResultadoConfig =
  | { ok: true; config: ConfigSupabase }
  | { ok: false; motivo: string };

/** Lee el campo «role» de un JWT sin verificarlo (solo para detectar errores de configuración). */
function rolDeJwt(token: string): string | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  try {
    const base64 = partes[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
    const rol = (JSON.parse(json) as { role?: unknown }).role;
    return typeof rol === "string" ? rol : null;
  } catch {
    return null;
  }
}

/**
 * Valida la URL y la clave PÚBLICA de Supabase. Se niega a funcionar con una
 * clave secreta (sb_secret_… o un JWT con rol service_role): esa clave salta
 * RLS y nunca debe llegar a la app web.
 */
export function validarConfigSupabase(url: string | undefined, clave: string | undefined): ResultadoConfig {
  if (!url || !clave) {
    return { ok: false, motivo: "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY." };
  }
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, motivo: "NEXT_PUBLIC_SUPABASE_URL no es una URL válida." };
  }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(local && u.protocol === "http:")) {
    return { ok: false, motivo: "NEXT_PUBLIC_SUPABASE_URL debe usar https." };
  }
  if (clave.startsWith("sb_secret_") || rolDeJwt(clave) === "service_role") {
    return { ok: false, motivo: "La clave configurada es SECRETA (service_role). Usa la clave pública (publishable/anon)." };
  }
  return { ok: true, config: { url: u.origin, clavePublica: clave } };
}

// ------------------------------------------------------------- Formulario

export const MAX_EMAIL = 254;
/** Supabase Auth (bcrypt) ignora lo que pase de 72 bytes. */
export const MAX_CONTRASENA = 72;

export type Credenciales = { email: string; contrasena: string };

export type ResultadoCredenciales =
  | { ok: true; valor: Credenciales }
  | { ok: false; errores: Partial<Record<"email" | "contrasena", string>> };

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarCredenciales(email: unknown, contrasena: unknown): ResultadoCredenciales {
  const errores: Partial<Record<"email" | "contrasena", string>> = {};
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  const c = typeof contrasena === "string" ? contrasena : "";

  if (e === "") errores.email = "Escribe tu correo electrónico.";
  else if (e.length > MAX_EMAIL || !PATRON_EMAIL.test(e)) errores.email = "Escribe un correo electrónico válido.";

  if (c === "") errores.contrasena = "Escribe tu contraseña.";
  else if (new TextEncoder().encode(c).length > MAX_CONTRASENA) {
    errores.contrasena = `La contraseña no puede superar ${MAX_CONTRASENA} caracteres.`;
  }

  return Object.keys(errores).length > 0 ? { ok: false, errores } : { ok: true, valor: { email: e, contrasena: c } };
}

/** Traduce un error de Supabase Auth a un mensaje en español, sin revelar si la cuenta existe. */
export function mensajeErrorAuth(error: { code?: string | null; status?: number | null; name?: string | null }): string {
  switch (error.code) {
    case "invalid_credentials":
    case "user_not_found":
      return "Correo o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Tienes que confirmar tu correo antes de entrar. Revisa tu bandeja de entrada.";
    case "user_banned":
      return "Esta cuenta está desactivada. Habla con la dirección de tu escuela.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Demasiados intentos. Espera unos minutos y vuelve a probar.";
  }
  if (error.status === 429) return "Demasiados intentos. Espera unos minutos y vuelve a probar.";
  if (error.status === 400 || error.status === 401) return "Correo o contraseña incorrectos.";
  return "No se ha podido iniciar sesión. Inténtalo de nuevo en unos minutos.";
}

// ------------------------------------------------------------- Rutas

export const RUTA_ACCESO = "/acceso";

/** Rutas accesibles sin sesión. */
/** Route Handler de cierre de sesión (POST). */
export const RUTA_SALIR = "/salir";

export function esRutaPublica(pathname: string): boolean {
  return pathname === RUTA_ACCESO || pathname.startsWith(`${RUTA_ACCESO}/`);
}

/**
 * Destino tras iniciar sesión. Solo rutas internas («/algo»): evita
 * redirecciones abiertas a otros dominios (//evil.com, /\evil.com, https://…).
 */
export function destinoTrasAcceso(siguiente: unknown): string {
  if (typeof siguiente !== "string" || siguiente.length > 512) return "/";
  if (!siguiente.startsWith("/") || siguiente.startsWith("//") || siguiente.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\\]/.test(siguiente)) return "/";
  try {
    const u = new URL(siguiente, "http://interno.invalid");
    if (u.origin !== "http://interno.invalid") return "/";
    if (esRutaPublica(u.pathname)) return "/";
    return `${u.pathname}${u.search}`;
  } catch {
    return "/";
  }
}

// ------------------------------------------------------------- Membresías

export type Rol = "director" | "entrenador";
export type Membresia = { escuelaId: string; escuelaNombre: string; rol: Rol };

export const NOMBRE_ROL: Record<Rol, string> = { director: "Director/a", entrenador: "Entrenador/a" };

/**
 * Convierte la respuesta de PostgREST («rol, escuela:escuelas(id, nombre)») en
 * membresías válidas, descartando filas incompletas. Ordena por nombre de escuela.
 */
export function normalizarMembresias(filas: unknown): Membresia[] {
  if (!Array.isArray(filas)) return [];
  const resultado: Membresia[] = [];
  for (const fila of filas) {
    if (typeof fila !== "object" || fila === null) continue;
    const { rol, escuela } = fila as { rol?: unknown; escuela?: unknown };
    if (rol !== "director" && rol !== "entrenador") continue;
    const e = Array.isArray(escuela) ? escuela[0] : escuela;
    if (typeof e !== "object" || e === null) continue;
    const { id, nombre } = e as { id?: unknown; nombre?: unknown };
    if (typeof id !== "string" || typeof nombre !== "string" || nombre.trim() === "") continue;
    resultado.push({ escuelaId: id, escuelaNombre: nombre, rol });
  }
  return resultado.sort((a, b) => a.escuelaNombre.localeCompare(b.escuelaNombre, "es"));
}

/** Errores de PostgREST/PostgreSQL que indican que el esquema no es el esperado. */
export function esErrorDeEsquema(error: { code?: string | null } | null | undefined): boolean {
  return !!error?.code && ["PGRST200", "PGRST204", "PGRST205", "42P01", "42703"].includes(error.code);
}
