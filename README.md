# ÉVORA PADEL

**Observa. Mide. Haz crecer.**

Plataforma internacional de metodología y desarrollo de jugadores de pádel.

## Estado: Fase 4 — jugadores y grupos reales

La app exige **iniciar sesión** (correo y contraseña de Supabase Auth) y
trabaja con la escuela del usuario, leída de su membresía en el servidor.

| Modo | Rutas | Datos |
|---|---|---|
| **Datos reales** (indicador verde) | `/`, `/jugadores…`, `/grupos…` | Supabase, con RLS |
| **Demostración** (aviso naranja) | `/demo…` | Ficticios, solo en el `localStorage` del navegador |

- **Jugadores:** lista con búsqueda y filtros, alta, edición, archivado y
  reactivación (no se borra nada). Campos = columnas de `public.jugadores`:
  nombre, fecha de nacimiento, mano, nivel, posición, foco.
- **Grupos:** lista, alta y edición (nombre y entrenador/a responsable), y
  asignación / desasignación de jugadores desde el grupo o desde la ficha.
- **Evaluaciones y objetivos** siguen solo en la demostración. Los datos
  ficticios nunca se suben a Supabase ni se mezclan con los reales.
- Las URL antiguas de la demo (`/evaluaciones`, `/objetivos`, `/jugadores/j1`…)
  redirigen a `/demo/…`.

Detalle de permisos y decisiones: `supabase/README.md` → «Jugadores y grupos (Fase 4)».

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
npm run test:db:mutaciones  # comprueba que las pruebas detectan fallos de seguridad
npm run supabase:local        # Supabase local (Docker) con usuarios y escuelas de prueba
npm run test:e2e   # compila y prueba acceso, RLS, jugadores/grupos y demo en Chromium (móvil y escritorio)
npm run supabase:local:parar  # detiene el Supabase local
npm run build
```

`npm run supabase:local` levanta PostgreSQL y Auth de Supabase en Docker,
PostgREST y una pasarela mínima, aplica las migraciones de `supabase/` y crea
datos **sintéticos** (dos escuelas «Demo», usuarios `@evora.invalid`). Escribe
`.env.e2e.local` (ignorado por git), que usa `npm run test:e2e`.

Stack: Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (`@supabase/ssr`).
