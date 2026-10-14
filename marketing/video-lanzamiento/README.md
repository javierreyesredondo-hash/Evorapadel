# ÉVORA PADEL · Vídeo de lanzamiento

Vídeo promocional vertical (Reels, TikTok, YouTube Shorts) de ÉVORA PADEL. Es un
proyecto **aislado**: no forma parte de la app, no tiene dependencias en ella
y no cambia su funcionamiento. Lo único que toma de la app son el logo original
(`src/components/marca/trazos.ts`) y capturas reales hechas en local.

| | |
|---|---|
| Formato | MP4 H.264 (High 4.2) + AAC 256 kbps, 1080 × 1920 (9:16), 30 fps |
| Duración | 28 s |
| Sonido | Música y efectos **originales**, sintetizados por `audio/componer.py`; sin voz |
| Sonoridad | −14 LUFS integrados, pico real ≤ −1 dBTP (estándar de redes) |
| Entregables | `salida/evora-padel-lanzamiento.mp4`, `salida/evora-padel-lanzamiento-preview.mp4` (540 × 960, ligero), `salida/portada-reel.jpg` |

## Guion (7 escenas, `linea-temporal.json`)

| Tiempo | Escena | Texto en pantalla |
|---|---|---|
| 0–3 s | Pista oscura, pala y pelota con luz lateral, partículas; el logo original emerge | EL PÁDEL ESTÁ EVOLUCIONANDO. |
| 3–6 s | Fichas, notas y datos sueltos alrededor de un entrenador; todo se ordena | ¿Y TU FORMA DE ENTRENAR? |
| 6–10 s | Escuela 3D desde arriba; jugadores, grupos, entrenamientos, evaluaciones e informes conectados | TODO TU CLUB. EN UN SOLO LUGAR. |
| 10–14 s | Móvil 3D con la evaluación en cadena real (escala 1–5); la propuesta automática se separa en capas | CONOCE A CADA JUGADOR. · EVALÚA. COMPRENDE. MEJORA. |
| 14–18 s | El informe PDF real sale del móvil; se resaltan fortalezas, aspectos a mejorar y objetivo | MENOS TIEMPO REDACTANDO. · MÁS TIEMPO ENTRENANDO. |
| 18–22 s | Evolución, competencias, decisión del entrenador (objetivo de trabajo) y pantallas de gestión | TU METODOLOGÍA. TU CRITERIO. TUS JUGADORES. |
| 22–28 s | Línea lima y logo original sobre azul noche | ÉVORA PADEL · OBSERVA. MIDE. HAZ CRECER. · LA EVOLUCIÓN DE TU ESCUELA EMPIEZA AQUÍ. |

Los textos quedan dentro de la zona segura de Instagram (lejos de la franja
inferior de controles y de la columna de botones de la derecha).

## Cómo volver a renderizarlo

Requisitos: **Node 22**, **Python 3** con `numpy` y `scipy`, **ffmpeg** y
Chromium (el de Playwright sirve; si está en otra ruta, `CHROMIUM=/ruta/chrome`).

```bash
cd marketing/video-lanzamiento
npm install                 # solo para este proyecto: fuentes (OFL) y playwright-core
pip install numpy scipy     # si no están
npm run musica              # → salida/musica.wav (síntesis determinista)
npm run render              # → MP4 final, previsualización y portada (≈ 10–20 min)
```

Otras opciones:

- `node render.mjs --rapido`: sin desenfoque de movimiento (la mitad de tiempo).
- `node render.mjs --instantes 1,6.5,12`: solo fotogramas sueltos en `salida/instantes/` (para revisar).
- `node render.mjs --portada`: solo la portada.
- `npm run vista`: abre `http://127.0.0.1:4173/escenas/?t=12.5` (un instante) o `?play` (reproducción aproximada en el navegador).

El render es **determinista**: cada fotograma se calcula solo a partir de su
instante, Chromium lo dibuja y ffmpeg lo codifica. Hay cuatro submuestras por
fotograma (obturador de 180°), que dan el desenfoque de movimiento.

## Capturas reales de la app

Las pantallas del vídeo son **capturas reales** de ÉVORA PADEL (en
`publico/capturas/`, ya incluidas). Se hicieron contra un Supabase **local** con
una escuela de demostración **ficticia** (nombres inventados, correos
`@evora.invalid`). Nunca contra producción. Para rehacerlas:

```bash
# En la raíz del repositorio:
npm run supabase:local            # Supabase local (Docker) con datos sintéticos
node marketing/video-lanzamiento/captura/sembrar-demo.mjs   # escuela «Altamar Pádel Club» (ficticia)
set -a && . ./.env.e2e.local && set +a && npx next build && npx next start -p 3100
CHROMIUM=/ruta/chrome node marketing/video-lanzamiento/captura/capturar.mjs
```

`sembrar-demo.mjs` y `capturar.mjs` se niegan a funcionar si la URL no es
`127.0.0.1`. Las evaluaciones de demostración usan el generador de redacción
real de la app (`src/lib/redaccion.ts`) y se guardan con su RPC
(`guardar_evaluacion`), con la sesión del director de demostración.

## Estructura

```
linea-temporal.json   tiempos de escenas y eventos (imagen y sonido sincronizados)
escenas/              página que dibuja cada fotograma (HTML, CSS 3D, SVG, canvas)
  motor.js            utilidades: curvas, titulares, imágenes, azar con semilla
  piezas.js           logo original animable, pista 3D, pala, pelota, móvil 3D
  ambiente.js         fondo, luces, partículas, destellos, grano y viñeta
  escenas/1…7-*.js    las siete escenas
  portada.js          portada del Reel
audio/componer.py     música y efectos (síntesis, sin muestras)
render.mjs            render fotograma a fotograma + codificación (ffmpeg)
servidor.mjs          servidor local (y logo original en /datos/marca.js)
captura/              capturas reales en local (Supabase local, datos ficticios)
publico/capturas/     capturas reales (WebP) y sus medidas
salida/               resultados (no se suben al repositorio)
```

## Licencias y contenido

- **Música y efectos**: compuestos por síntesis en `audio/componer.py` para este
  vídeo; no contienen muestras ni obras de terceros. Uso comercial libre para
  ÉVORA PADEL.
- **Tipografías**: Barlow Condensed, Inter y Caveat (SIL Open Font License 1.1,
  paquetes `@fontsource`).
- **Logo**: el original de la app, con sus trazos y proporciones exactas; solo se
  anima su aparición.
- **Pantallas**: capturas reales de la app con datos ficticios. Las gráficas de la
  escena 6 dibujan datos reales de esa escuela de demostración (medias de cada
  evaluación y su última evaluación). No se muestran funciones que la app no
  tenga (ni predicciones ni inteligencia artificial).
- Sin marcas de terceros (la pala y la pelota son genéricas).
