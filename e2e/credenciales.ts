// Credenciales de los usuarios SINTÉTICOS del Supabase local (.env.e2e.local).
export type UsuarioPrueba = "DIRECTOR_A" | "ENTRENADOR_A" | "DIRECTOR_B" | "DIRECTOR_C" | "DIRECTOR_D" | "DIRECTOR_E" | "SIN_ESCUELA";

export function credenciales(usuario: UsuarioPrueba) {
  const email = process.env[`E2E_EMAIL_${usuario}`];
  const contrasena = process.env.E2E_CONTRASENA;
  if (!email || !contrasena) {
    throw new Error("Faltan las credenciales de prueba: arranca `npm run supabase:local` y usa `npm run test:e2e`.");
  }
  return { email, contrasena };
}

export function configSupabaseLocal() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) throw new Error("Falta la configuración del Supabase local.");
  return { url, clave };
}

/** Cliente de Supabase con la clave pública y la sesión de `usuario` (la misma vía que la app). */
export async function clienteComo(usuario: UsuarioPrueba) {
  const { createClient } = await import("@supabase/supabase-js");
  const { url, clave } = configSupabaseLocal();
  const cliente = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  const { email, contrasena } = credenciales(usuario);
  const { error } = await cliente.auth.signInWithPassword({ email, password: contrasena });
  if (error) throw new Error(`No se pudo iniciar sesión como ${usuario}: ${error.message}`);
  return cliente;
}

/** Sufijo único: las pruebas corren en paralelo sobre la misma base de datos. */
export function unico(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
