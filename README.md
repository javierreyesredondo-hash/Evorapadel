# ÉVORA PADEL

**Observa. Mide. Haz crecer.**

Plataforma internacional de metodología y desarrollo de jugadores de pádel.

## Estado: evaluaciones reales e informes PDF

La app exige **iniciar sesión** (correo y contraseña de Supabase Auth) y
trabaja con la escuela del usuario, leída de su membresía en el servidor.

| Modo | Rutas | Datos |
|---|---|---|
| **Datos reales** (indicador verde) | `/`, `/jugadores…`, `/grupos…`, `/entrenamiento`, `/evaluaciones…`, `/metodologia`, `/perfil` | Supabase, con RLS |
| **Demostración** (aviso naranja) | `/demo…` | Ficticios, solo en el `localStorage` del navegador |

- **Roles:** una misma persona puede **dirigir y entrenar** con una sola cuenta y
  sesión. «Entrenar» (`/entrenamiento`) reúne sus grupos, jugadores y
  evaluaciones; la sección «Dirección» del inicio, la gestión. Los permisos se
  comprueban en el servidor y con RLS (ver `supabase/README.md` → Roles).
- **Jugadores y grupos:** alta, edición, archivado, grupos y asignaciones.
- **Metodología:** competencias de la escuela (la dirección las define o carga
  la metodología base ÉVORA y la adapta). Escala fija de 1 a 5.
- **Evaluaciones:** rápidas (en el entrenamiento, algunas competencias) o
  completas (todas). Notas 1–5, fortalezas, áreas de mejora, observaciones y
  hasta 5 objetivos con plazo. Historial en la ficha y comparación con la
  evaluación anterior del mismo tipo (solo en competencias comunes).
- **Informe PDF** por evaluación: vista previa, descarga y compartir desde el
  menú del móvil (WhatsApp). Se genera con los datos guardados; no se almacena.
- El seguimiento de objetivos con progreso sigue solo en la demostración. Los
  datos ficticios nunca se suben a Supabase ni se mezclan con los reales.

Detalle de permisos y decisiones: `supabase/README.md` (Fase 4 y migración 3).

**Base de datos en producción:** las migraciones 1, 2 y 3 están aplicadas a mano
en Supabase. No ejecutar `supabase db push` sin reconciliar antes el historial
(ver `supabase/README.md` → «Migraciones aplicadas a mano y CLI de Supabase»).

### Sesión y acceso

- `src/proxy.ts` refresca la sesión en cada petición y redirige a `/acceso`
  si no hay sesión (primer filtro).
- `src/components/ZonaPrivada.tsx` vuelve a comprobarla en el servidor
  (`src/lib/supabase/sesion.ts`, con `getUser()`) antes de mostrar nada.
- La escuela y el rol salen de la tabla `membresias`, filtrada por el usuario
  verificado en el servidor; nunca de un dato enviado por el navegador. RLS
  impide además leer otras escuelas.
- En el navegador solo existen la URL y la clave pública. La app se niega a
  usar una clave secreta o `service_role`.
- Lecturas: `src/lib/supabase/gestion.ts` (`contextoEscuela()` + consultas que
  filtran siempre por la escuela activa). Escrituras: Server Actions de
  `src/app/acciones-gestion.ts`; la escuela nunca viene del formulario.
- Variables de entorno: ver `.env.example`.

### Demostración con datos ficticios (Fase 2, en `/demo`)

- Búsqueda (sin distinguir tildes) y filtros por nivel y posición.
- Ficha de cada jugador: datos, última evaluación por criterio, objetivos e historial.
- Formulario de evaluación: seis criterios con notas enteras de 1 a 5.
- Creación de objetivos individuales y actualización de su progreso.

**Puntuación:** cada criterio se puntúa con un entero de 1 a 5. La puntuación
global es `round(media exacta × 20)`, con rango **20–100** (nota 1 → 20, nota 5 → 100).
La media se muestra con un decimal; ver `src/lib/dominio.ts`.

**404:** `src/proxy.ts` devuelve un 404 real para fichas de jugadores que no
existen (con Cache Components, `notFound()` en la página llegaba tarde y el
código era 200).

Los cambios se guardan solo en el `localStorage` del navegador
(`src/lib/almacen.tsx`) y se pueden deshacer con «Restablecer». Lo guardado se
valida por completo al cargar; si algo no es válido, se descarta y se vuelve a
los datos iniciales.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # y rellenar la URL y la clave pública de Supabase
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm test           # lógica (node --test)
npm run test:db    # migración SQL en un PostgreSQL local desechable
npm run test:db:supabase    # misma prueba con la imagen oficial de Supabase (Docker)
npm run test:db:mutaciones  # comprueba que las pruebas detectan fallos de seguridad (34)
npm run supabase:local        # Supabase local (Docker) con usuarios y escuelas de prueba
npm run test:e2e   # compila y prueba acceso, RLS, jugadores/grupos, evaluaciones, PDF, roles y demo en Chromium (móvil y escritorio)
npm run supabase:local:parar  # detiene el Supabase local
npm run build
```

`npm run supabase:local` levanta PostgreSQL y Auth de Supabase en Docker,
PostgREST y una pasarela mínima, aplica las migraciones de `supabase/` y crea
datos **sintéticos** (tres escuelas «Demo», usuarios `@evora.invalid`). Escribe
`.env.e2e.local` (ignorado por git), que usa `npm run test:e2e`.

**Integración continua** (`.github/workflows/ci.yml`): en cada PR y en `main`,
GitHub Actions ejecuta `lint`, `typecheck`, `test`, `test:db` y
`test:db:mutaciones` sobre un PostgreSQL desechable del propio ejecutor. No usa
secretos ni se conecta a Supabase. Las E2E (Docker) se ejecutan en local.

Stack: Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (`@supabase/ssr`) ·
`pdf-lib` para los informes, con las fuentes de la marca de `@fontsource` (Barlow
e Inter, licencia SIL OFL 1.1). `pdfjs-dist` solo en pruebas (leer los PDF).
