# ÉVORA PADEL

**Observa. Mide. Haz crecer.**

Plataforma internacional de metodología y desarrollo de jugadores de pádel.

## Estado: Fase 3 — conexión con Supabase e inicio de sesión

La app exige **iniciar sesión** (correo y contraseña de Supabase Auth). Tras
entrar muestra la escuela y el rol del usuario, leídos de la base de datos con
RLS. No hay registro público: las cuentas y las escuelas se crean a mano (ver
`supabase/README.md`).

Las pantallas (jugadores, evaluaciones, objetivos) siguen usando los datos
**ficticios** de la Fase 2: su migración a la base de datos es la siguiente fase.

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
- Variables de entorno: ver `.env.example`.

### Datos ficticios (Fase 2)

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
npm run test:e2e   # compila y prueba acceso, RLS y flujos en Chromium (móvil y escritorio)
npm run supabase:local:parar  # detiene el Supabase local
npm run build
```

`npm run supabase:local` levanta PostgreSQL y Auth de Supabase en Docker,
PostgREST y una pasarela mínima, aplica las migraciones de `supabase/` y crea
datos **sintéticos** (dos escuelas «Demo», usuarios `@evora.invalid`). Escribe
`.env.e2e.local` (ignorado por git), que usa `npm run test:e2e`.

Stack: Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (`@supabase/ssr`).
