import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente con la clave SECRETA de Supabase, SOLO EN EL SERVIDOR y SOLO para una
// cosa: crear la cuenta de un director que abre una invitación válida (el
// correo sale de la invitación, nunca del navegador) y leer esa invitación.
//
// Es OPCIONAL: sin SUPABASE_SECRET_KEY en el servidor, la app no crea cuentas y
// el director invitado debe tener una (creada por el propietario en Supabase).
// La clave no lleva el prefijo NEXT_PUBLIC_: Next nunca la envía al navegador.
// No se usa para nada más (la prueba src/lib/sin-registro.test.ts lo vigila).

export function clienteAdministracion(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !clave) return null;
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

/**
 * Crea la cuenta (correo ya confirmado: la invitación, de un solo uso, prueba
 * que el propietario autorizó ese correo). «existe»: ya hay una cuenta.
 */
export async function crearCuentaInvitada(
  cliente: SupabaseClient,
  email: string,
  contrasena: string,
): Promise<{ ok: true } | { ok: false; existe: boolean }> {
  const { error } = await cliente.auth.admin.createUser({ email, password: contrasena, email_confirm: true });
  if (!error) return { ok: true };
  const existe = error.code === "email_exists" || error.status === 422 || /already/i.test(error.message);
  // Sin datos personales en el registro: solo el código.
  console.error("ÉVORA PADEL: no se ha podido crear la cuenta invitada", error.code ?? error.status);
  return { ok: false, existe };
}
