import { BannerDemo, PuenteAvisosDemo } from "@/components/Demo";
import { ProveedorAlmacen } from "@/lib/almacen";

// Demostración (Fase 2): datos FICTICIOS guardados solo en el localStorage de
// este navegador. Vive bajo /demo y no comparte nada con los datos reales de
// la escuela: ni rutas, ni almacén, ni componentes de datos.
export default function LayoutDemo({ children }: LayoutProps<"/demo">) {
  return (
    <ProveedorAlmacen>
      <BannerDemo />
      {children}
      <PuenteAvisosDemo />
    </ProveedorAlmacen>
  );
}
