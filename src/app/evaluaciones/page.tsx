import type { Metadata } from "next";
import { Evaluaciones } from "@/components/vistas/Evaluaciones";

export const metadata: Metadata = { title: "Evaluaciones" };

export default function Page() {
  return <Evaluaciones />;
}
