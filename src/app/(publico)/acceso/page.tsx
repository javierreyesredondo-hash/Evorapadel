import type { Metadata } from "next";
import { Suspense } from "react";
import { FormularioAcceso } from "@/components/FormularioAcceso";

export const metadata: Metadata = { title: "Acceso" };

export default function Page() {
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold uppercase italic leading-none tracking-tight">
        Iniciar sesión
      </h1>
      <p className="mb-6 mt-2 text-sm text-tenue">
        Entra con el correo y la contraseña que te ha dado tu escuela.
      </p>
      {/* useSearchParams («siguiente») necesita Suspense con Cache Components. */}
      <Suspense>
        <FormularioAcceso />
      </Suspense>
    </>
  );
}
