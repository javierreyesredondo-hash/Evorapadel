# ÉVORA PADEL

**Observa. Mide. Haz crecer.**

Plataforma internacional de metodología y desarrollo de jugadores de pádel.

## Estado: Fase 2

Interfaz mobile-first con datos **ficticios** y flujos funcionales:

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

Todavía no hay base de datos, autenticación ni pagos.

**Base de datos (Fase 3, en preparación):** `supabase/` contiene la primera
migración (escuelas, perfiles, membresías, jugadores y grupos con RLS) lista
para revisar. **No está aplicada** y la app aún no la usa. Ver `supabase/README.md`. Los cambios se guardan
solo en el `localStorage` del navegador (`src/lib/almacen.tsx`) y se pueden
deshacer con «Restablecer». Lo guardado se valida por completo al cargar; si
algo no es válido, se descarta y se vuelve a los datos iniciales.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm test           # lógica (node --test)
npm run test:db    # migración SQL en un PostgreSQL local desechable
npm run test:e2e   # compila y prueba los flujos en Chromium (móvil y escritorio)
npm run build
```

Stack: Next.js (App Router) · TypeScript · Tailwind CSS.
