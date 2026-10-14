// Motor de animación determinista: cada fotograma se calcula solo a partir del
// tiempo t (segundos). Sin transiciones CSS ni requestAnimationFrame: el mismo
// t produce siempre la misma imagen, lo que permite renderizar fotograma a
// fotograma con el navegador sin saltos.

export const W = 1080;
export const H = 1920;

export const COLOR = {
  noche: "#101B2C",
  noche700: "#16243A",
  noche600: "#1D2E48",
  noche500: "#2A3D5C",
  lima: "#C7FF32",
  naranja: "#FF824C",
  blanco: "#FFFFFF",
  tenue: "#A9B4C6",
};

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
/** Progreso 0→1 de t entre a y b (con límites). */
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const mix = (a, b, p) => a.map((v, i) => lerp(v, b[i], p));

export const ease = {
  lineal: (p) => p,
  outCubic: (p) => 1 - (1 - p) ** 3,
  inCubic: (p) => p ** 3,
  inOutCubic: (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
  outQuart: (p) => 1 - (1 - p) ** 4,
  inQuart: (p) => p ** 4,
  outExpo: (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)),
  inExpo: (p) => (p <= 0 ? 0 : 2 ** (10 * p - 10)),
  inOutExpo: (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? 2 ** (20 * p - 10) / 2 : (2 - 2 ** (-20 * p + 10)) / 2),
  inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  outBack: (p, s = 1.70158) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2,
  /** Muelle amortiguado (rebote suave), 0→1. */
  muelle: (p, rebote = 0.35, frecuencia = 2.4) =>
    p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6 * p) * Math.cos(frecuencia * Math.PI * p * (1 + rebote)),
};

/** Valor animado: tramos [[t0, v0], [t1, v1], …] con su curva. */
export function tramos(t, puntos, curva = ease.inOutCubic) {
  if (t <= puntos[0][0]) return puntos[0][1];
  for (let i = 1; i < puntos.length; i++) {
    const [t1, v1, c] = puntos[i];
    const [t0, v0] = puntos[i - 1];
    if (t <= t1) return lerp(v0, v1, (c ?? curva)(prog(t, t0, t1)));
  }
  return puntos[puntos.length - 1][1];
}

/**
 * Curva suave que pasa por todos los puntos [[t, v], …] sin pasarse
 * (interpolación cúbica monótona de Fritsch–Carlson): para desplazamientos
 * continuos que no se paran en cada punto.
 */
export function suave(t, puntos) {
  const n = puntos.length;
  if (t <= puntos[0][0]) return puntos[0][1];
  if (t >= puntos[n - 1][0]) return puntos[n - 1][1];
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((puntos[i + 1][1] - puntos[i][1]) / (puntos[i + 1][0] - puntos[i][0]));
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  m[0] = 0;
  m[n - 1] = 0;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  let i = 0;
  while (t > puntos[i + 1][0]) i++;
  const [t0, v0] = puntos[i];
  const [t1, v1] = puntos[i + 1];
  const h = t1 - t0;
  const s = (t - t0) / h;
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1;
  const h10 = s ** 3 - 2 * s ** 2 + s;
  const h01 = -2 * s ** 3 + 3 * s ** 2;
  const h11 = s ** 3 - s ** 2;
  return h00 * v0 + h10 * h * m[i] + h01 * v1 + h11 * h * m[i + 1];
}

/** Entrada y salida: 0 antes de a, 1 entre a+entra y b−sale, 0 después de b. */
export function ventana(t, a, b, entra = 0.4, sale = 0.4, curva = ease.outCubic) {
  if (t < a || t > b) return 0;
  const i = entra > 0 ? curva(prog(t, a, a + entra)) : 1;
  const o = sale > 0 ? 1 - ease.inCubic(prog(t, b - sale, b)) : 1;
  return Math.min(i, o);
}

/** Generador pseudoaleatorio con semilla (mulberry32). */
export function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruido suave 1D determinista (para flotaciones orgánicas). */
export function ondular(t, semilla = 0, velocidad = 1) {
  const s = semilla * 12.9898;
  return (
    Math.sin(t * 0.9 * velocidad + s) * 0.5 +
    Math.sin(t * 1.7 * velocidad + s * 1.3) * 0.3 +
    Math.sin(t * 2.9 * velocidad + s * 0.7) * 0.2
  );
}

/** Crea un elemento con clase, estilos y contenido. */
export function el(etiqueta, clase = "", estilos = {}, html = "") {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  Object.assign(e.style, estilos);
  if (html) e.innerHTML = html;
  return e;
}

export function svg(etiqueta, atributos = {}) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", etiqueta);
  for (const [k, v] of Object.entries(atributos)) e.setAttribute(k, v);
  return e;
}

/** Aplica estilos solo si cambian (evita trabajo de estilo innecesario). */
export function css(e, estilos) {
  for (const [k, v] of Object.entries(estilos)) {
    const valor = typeof v === "number" && k !== "opacity" && k !== "zIndex" ? `${v}px` : String(v);
    if (e.style[k] !== valor) e.style[k] = valor;
  }
}

export const visible = (e, si) => css(e, { visibility: si ? "inherit" : "hidden" });

/** Imagen precargada y decodificada (para que ningún fotograma salga a medias). */
const pendientes = [];
export function imagen(src, clase = "", estilos = {}) {
  const i = el("img", clase, estilos);
  i.decoding = "sync";
  i.src = src;
  // Espera a que cargue (y, si el navegador puede, a que esté decodificada).
  pendientes.push(
    new Promise((ok, mal) => {
      i.onload = () => i.decode().then(ok, ok);
      i.onerror = () => mal(new Error(`No se pudo cargar ${src}`));
    }),
  );
  return i;
}
export const imagenesListas = () => Promise.all(pendientes);

/**
 * Titular con entrada palabra a palabra (máscara + desenfoque) y salida hacia
 * arriba. `lineas`: [["EL", "PÁDEL"], ["ESTÁ"]…]; una palabra que empieza por
 * «*» va en lima.
 */
export function titular(lineas, { tam = 128, interlineado = 0.94, estilo = {} } = {}) {
  const raiz = el("div", "titular", { fontSize: `${tam}px`, lineHeight: interlineado, ...estilo });
  const palabras = [];
  for (const linea of lineas) {
    const fila = el("div", "titular-linea");
    for (const p of linea) {
      // «*palabra» en lima; «!palabra» en naranja (acento, con moderación).
      const lima = p.startsWith("*");
      const naranja = p.startsWith("!");
      const caja = el("span", "titular-mascara");
      const palabra = el("span", `titular-palabra${lima ? " lima" : naranja ? " naranja" : ""}`, {}, p.replace(/^[*!]/, ""));
      caja.append(palabra);
      fila.append(caja, document.createTextNode(" "));
      palabras.push(palabra);
    }
    raiz.append(fila);
  }
  return {
    raiz,
    palabras,
    /** entra en t0 (escalonado), sale en t1. */
    actualizar(t, t0, t1, { escalon = 0.07, dur = 0.55, salida = 0.35, tiempos = null } = {}) {
      palabras.forEach((p, i) => {
        // `tiempos`: instante de entrada de cada palabra (para ir al compás).
        const ti = tiempos ? tiempos[i] : t0 + i * escalon;
        const a = ease.outExpo(prog(t, ti, ti + dur));
        const s = ease.inCubic(prog(t, t1 - salida + i * 0.025, t1 + i * 0.025));
        const y = (1 - a) * 105 - s * 60;
        const desenfoque = (1 - a) * 14 + s * 18;
        css(p, {
          transform: `translate3d(0, ${y}%, 0) skewX(${(1 - a) * -8}deg)`,
          filter: desenfoque > 0.05 ? `blur(${desenfoque.toFixed(2)}px)` : "none",
          opacity: Math.min(a, 1 - s),
        });
      });
      css(raiz, { visibility: t >= t0 - 0.05 && t <= t1 + 0.3 ? "inherit" : "hidden" });
    },
  };
}
