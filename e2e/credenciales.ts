// Credenciales de los usuarios SINTÉTICOS del Supabase local (.env.e2e.local).
export type UsuarioPrueba = "DIRECTOR_A" | "ENTRENADOR_A" | "DIRECTOR_B" | "SIN_ESCUELA";

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
