import type { Metadata } from "next";
import { Objetivos } from "@/components/vistas/Objetivos";

export const metadata: Metadata = { title: "Objetivos" };

export default function Page() {
  return <Objetivos />;
}
