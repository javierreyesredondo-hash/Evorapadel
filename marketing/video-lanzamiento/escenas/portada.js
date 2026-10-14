// Portada vertical del Reel (1080×1920): logo original, lema y el móvil con la
// evaluación en cadena REAL. Lo importante queda dentro del recorte 4:5 del
// perfil de Instagram (franja central de 1080×1350).

import { COLOR, css, el, imagen, titular } from "./motor.js";
import { crearLogo, crearMovil } from "./piezas.js";

export function crearPortada(capturas) {
  const raiz = el("div", "capa", { display: "none" });
  const halo = el("div", "", { position: "absolute", left: "60px", top: "760px", width: "960px", height: "1100px", borderRadius: "50%", background: "radial-gradient(closest-side, rgba(199,255,50,0.20), rgba(199,255,50,0.05) 55%, transparent)" });

  const logo = crearLogo({ ancho: 720, id: "logo-portada" });
  const cajaLogo = el("div", "", { position: "absolute", left: `${540 - logo.ancho / 2}px`, top: "300px", filter: "drop-shadow(0 0 26px rgba(199,255,50,0.25))" });
  cajaLogo.append(logo.raiz);
  const lema = titular([["OBSERVA.", "MIDE."], ["*HAZ", "*CRECER."]], { tam: 150, estilo: { top: "470px" } });

  const escenario = el("div", "escenario3d", { perspective: "1700px", perspectiveOrigin: "50% 62%" });
  const pagina = el("div", "p3d", { left: "590px", top: "930px", width: "440px", height: `${(440 * 2339) / 1654}px`, borderRadius: "10px", overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,0.6)", transform: "translateZ(-180px) rotateY(-16deg) rotateZ(5deg)" });
  pagina.append(imagen("../publico/capturas/informe-pdf-1.webp", "", { width: "440px" }));
  const soporte = el("div", "p3d", { left: "470px", top: "1255px", transform: "rotateX(6deg) rotateY(-16deg) rotateZ(-2deg)" });
  const movil = crearMovil({ anchoPantalla: 410, datos: capturas });
  soporte.append(movil.raiz);
  escenario.append(pagina, soporte);
  const vista = movil.vista("cadena-6");
  const sombra = el("div", "", { position: "absolute", left: "180px", top: "1700px", width: "560px", height: "80px", borderRadius: "50%", background: "radial-gradient(closest-side, rgba(0,0,0,0.6), transparent)", filter: "blur(10px)" });
  const pie = el("div", "", {
    position: "absolute", left: "60px", right: "60px", top: "1790px", textAlign: "center", fontFamily: "Inter", fontWeight: 600,
    fontSize: "30px", letterSpacing: "3px", textTransform: "uppercase", color: "rgba(255,255,255,0.8)",
  }, `Evaluaciones <span style="color:${COLOR.lima}">·</span> Informes <span style="color:${COLOR.lima}">·</span> Metodología`);

  raiz.append(halo, sombra, escenario, cajaLogo, lema.raiz, pie);

  return {
    raiz,
    dibujar() {
      css(raiz, { display: "block" });
      logo.estado({});
      lema.actualizar(10, 0, 99);
      vista.desplazar(250);
      movil.mostrar({ "cadena-6": 1 });
      movil.reflejo(0.35);
    },
  };
}
