import type { Metadata } from "next";
import { AceptarInvitacion } from "@/components/invitaciones/AceptarInvitacion";

// Enlace de invitación (con o sin sesión: lo permite el proxy). El token va en
// el fragmento «#» y lo lee el navegador; el servidor solo recibe su comprobación.
export const metadata: Metadata = { title: "Invitación", robots: { index: false, follow: false } };

export default function Page() {
  return <AceptarInvitacion />;
}
