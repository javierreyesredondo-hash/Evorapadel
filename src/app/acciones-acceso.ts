"use server";

import { redirect } from "next/navigation";
import { destinoTrasAcceso, mensajeErrorAuth, validarCredenciales } from "@/lib/acceso";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoAcceso = {
  email?: string;
  errores?: Partial<Record<"email" | "contrasena", string>>;
  error?: string;
};

/**
 * Inicio de sesión con correo y contraseña. Corre en el servidor: la
 * contraseña no se guarda ni se registra, y las cookies de sesión las escribe
 * @supabase/ssr. No hay registro público: solo entran usuarios ya creados.
 */
export async function iniciarSesion(_previo: EstadoAcceso, datos: FormData): Promise<EstadoAcceso> {
  const email = datos.get("email");
  const r = validarCredenciales(email, datos.get("contrasena"));
  if (!r.ok) return { email: typeof email === "string" ? email : "", errores: r.errores };

  const supabase = await crearClienteServidor();
  if (!supabase) {
    return {
      email: r.valor.email,
      error: "La conexión con la base de datos no está configurada. Avisa al administrador.",
    };
  }

  let mensaje: string | null = null;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: r.valor.email, password: r.valor.contrasena });
    if (error) mensaje = mensajeErrorAuth(error);
  } catch {
    mensaje = mensajeErrorAuth({});
  }
  if (mensaje) return { email: r.valor.email, error: mensaje };

  // redirect() lanza una excepción controlada: fuera del try.
  redirect(destinoTrasAcceso(datos.get("siguiente")));
}
