// Ambiente común a todas las escenas: fondo con luces, partículas, destellos
// de transición y viñeta. El grano de película lo añade ffmpeg al codificar
// (render.mjs), después del desenfoque de movimiento.

import { W, H, azar, css, el, ease, ondular, prog, ventana } from "./motor.js";

export function crearAmbiente(lienzo, escenasRaiz) {
  const fondo = el("div", "capa", {
    background: "radial-gradient(120% 70% at 50% 38%, #1a2c47 0%, #101b2c 55%, #0a1220 100%)",
  });
  const luzA = el("div", "capa", {
    width: "1400px", height: "1400px", left: "-500px", top: "-300px", borderRadius: "50%",
    background: "radial-gradient(circle, rgba(199,255,50,0.10) 0%, rgba(199,255,50,0.03) 35%, transparent 68%)",
  });
  const luzB = el("div", "capa", {
    width: "1600px", height: "1600px", left: "200px", top: "900px", borderRadius: "50%",
    background: "radial-gradient(circle, rgba(70,120,200,0.16) 0%, rgba(40,70,120,0.06) 40%, transparent 70%)",
  });
  // Partículas en dos capas: el polvo, DETRÁS de las escenas (no tapa las
  // pantallas); las estelas de la escena 1, delante.
  const particulas = el("canvas", "capa");
  particulas.width = W;
  particulas.height = H;
  const delante = el("canvas", "capa");
  delante.width = W;
  delante.height = H;
  lienzo.append(fondo, luzA, luzB, particulas, escenasRaiz);
  const destello = el("div", "capa", { background: "radial-gradient(70% 55% at 50% 50%, #ffffff 0%, rgba(240,255,215,0.85) 35%, rgba(199,255,50,0) 85%)", opacity: 0, mixBlendMode: "screen" });
  // Destellos de lente horizontales (anamórficos) en los golpes de la música.
  const lentes = [
    { t: 0.0, x: 540, y: 1000, fuerza: 0.7 },
    { t: 1.15, x: 245, y: 499, fuerza: 0.9 }, // la bola del logo se posa
    { t: 6.0, x: 540, y: 1105, fuerza: 1 },
    { t: 22.05, x: 540, y: 960, fuerza: 1 },
    { t: 22.375, x: 540, y: 830, fuerza: 0.8 }, // la línea lima descubre el logo
  ].map((l) => {
    const raya = el("div", "", {
      position: "absolute", pointerEvents: "none", left: "-260px", width: "1600px", height: "8px", top: `${l.y - 4}px`, opacity: 0, mixBlendMode: "screen",
      background: `radial-gradient(50% 50% at ${((l.x + 260) / 1600) * 100}% 50%, #ffffff 0%, rgba(220,255,140,0.9) 10%, rgba(199,255,50,0.35) 40%, transparent 75%)`,
      filter: "blur(1.5px)",
    });
    const halo = el("div", "", {
      position: "absolute", pointerEvents: "none", left: `${l.x - 260}px`, top: `${l.y - 260}px`, width: "520px", height: "520px", opacity: 0, mixBlendMode: "screen",
      background: "radial-gradient(closest-side, rgba(255,255,255,0.9), rgba(199,255,50,0.35) 30%, transparent 70%)",
    });
    return { ...l, raya, halo };
  });
  const vineta = el("div", "capa", {
    background: "radial-gradient(115% 80% at 50% 45%, transparent 55%, rgba(3,6,12,0.55) 88%, rgba(3,6,12,0.85) 100%)",
  });
  lienzo.append(delante, ...lentes.flatMap((l) => [l.halo, l.raya]), destello, vineta);

  // Partículas: polvo luminoso con profundidad.
  const r = azar(7);
  const polvo = Array.from({ length: 150 }, () => ({
    x: r() * W, y: r() * H, z: r() ** 1.6, vx: (r() - 0.5) * 18, vy: 12 + r() * 30, fase: r() * 10, lima: r() < 0.55,
  }));
  // Estelas verdes que recorren la pista en la escena 1.
  const estelas = Array.from({ length: 34 }, () => ({
    y: 1080 + r() * 760, v: 900 + r() * 1100, x0: -400 - r() * 1600, largo: 120 + r() * 300, grosor: 1 + r() * 2.6, a: 0.35 + r() * 0.6,
  }));
  const ctx = particulas.getContext("2d");
  const ctxD = delante.getContext("2d");

  return function actualizar(t) {
    // Luces de fondo que respiran.
    css(luzA, { transform: `translate3d(${ondular(t, 1, 0.35) * 160}px, ${ondular(t, 2, 0.3) * 200 + t * 6}px, 0)` });
    css(luzB, { transform: `translate3d(${ondular(t, 3, 0.3) * -200}px, ${ondular(t, 4, 0.25) * 160 - t * 10}px, 0)` });

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    const densidad = 0.55 + 0.45 * ventana(t, 5.8, 22.4, 0.6, 0.6) + 0.4 * ventana(t, 22, 28.5, 1, 0.1);
    for (const p of polvo) {
      const x = (((p.x + p.vx * t + ondular(t, p.fase, 0.4) * 30) % W) + W) % W;
      const y = (((p.y - p.vy * t * (0.4 + p.z)) % H) + H) % H;
      const tam = 1.2 + p.z * 7;
      const alfa = (0.08 + p.z * 0.42) * densidad * (0.65 + 0.35 * Math.sin(t * 2.3 + p.fase));
      const g = ctx.createRadialGradient(x, y, 0, x, y, tam * 2.2);
      const c = p.lima ? "199,255,50" : "220,235,255";
      g.addColorStop(0, `rgba(${c},${alfa})`);
      g.addColorStop(0.35, `rgba(${c},${alfa * 0.45})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - tam * 2.2, y - tam * 2.2, tam * 4.4, tam * 4.4);
    }
    ctx.globalCompositeOperation = "source-over";
    // Estelas: solo en la escena de marca, sobre la pista.
    ctxD.clearRect(0, 0, W, H);
    const fuerza = ventana(t, 0.15, 3.25, 0.5, 0.5);
    if (fuerza > 0) {
      const ctx = ctxD;
      ctx.globalCompositeOperation = "lighter";
      for (const e of estelas) {
        const x = e.x0 + e.v * t;
        if (x < -e.largo || x > W + e.largo) continue;
        const g = ctx.createLinearGradient(x - e.largo, e.y, x, e.y);
        g.addColorStop(0, "rgba(199,255,50,0)");
        g.addColorStop(1, `rgba(199,255,50,${e.a * fuerza})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = e.grosor;
        ctx.beginPath();
        ctx.moveTo(x - e.largo, e.y);
        ctx.lineTo(x, e.y);
        ctx.stroke();
        ctx.fillStyle = `rgba(230,255,170,${e.a * fuerza})`;
        ctx.beginPath();
        ctx.arc(x, e.y, e.grosor * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // Destellos de transición (sincronizados con los golpes de la música).
    // Ataque muy corto antes del golpe y caída tras él.
    const golpe = (c, d = 0.35) => (t < c ? Math.max(0, 1 - (c - t) / 0.05) : Math.max(0, 1 - (t - c) / d) ** 2.2);
    const flash = Math.max(golpe(0.02, 0.4) * 0.3, golpe(3.0, 0.2) * 0.4, golpe(6.0, 0.22) * 0.55, golpe(10.0, 0.16) * 0.3, golpe(14.0, 0.16) * 0.3, golpe(18.0, 0.16) * 0.3, golpe(22.05, 0.24) * 0.55);
    css(destello, { opacity: flash.toFixed(3) });
    for (const l of lentes) {
      const e = t < l.t ? Math.max(0, 1 - (l.t - t) / 0.04) : Math.max(0, 1 - (t - l.t) / 0.7) ** 1.8;
      css(l.raya, { opacity: (e * l.fuerza).toFixed(3), transform: `scaleX(${(0.6 + 0.6 * (1 - e)).toFixed(3)}) scaleY(${(0.6 + e).toFixed(3)})` });
      css(l.halo, { opacity: (e * l.fuerza * 0.8).toFixed(3), transform: `scale(${(0.5 + 0.7 * (1 - e)).toFixed(3)})` });
    }
    // Sacudida de cámara en los impactos (decae en ~0,4 s).
    const sacude = (c, fuerza, dur = 0.42) => (t >= c && t < c + dur ? fuerza * (1 - (t - c) / dur) ** 2 : 0);
    const s = Math.max(sacude(0.0, 8), sacude(3.0, 7), sacude(6.0, 16), sacude(10.0, 5), sacude(14.0, 5), sacude(18.0, 5), sacude(22.05, 18), sacude(23.25, 6));
    css(escenasRaiz, {
      transform: s > 0.05 ? `translate3d(${(Math.sin(t * 173) * s).toFixed(2)}px, ${(Math.cos(t * 131) * s * 0.8).toFixed(2)}px, 0) rotate(${(Math.sin(t * 97) * s * 0.03).toFixed(3)}deg)` : "none",
    });

    css(fondo, { filter: `brightness(${(0.25 + 0.75 * ease.outCubic(prog(t, 0, 0.9))).toFixed(3)})` });
  };
}
