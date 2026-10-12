# ÉVORA PADEL

**Observa. Mide. Haz crecer.**

Plataforma internacional de metodología y desarrollo de jugadores de pádel.

## Estado: Fase 2

Interfaz mobile-first con datos **ficticios** y flujos funcionales:

- Búsqueda (sin distinguir tildes) y filtros por nivel y posición.
- Ficha de cada jugador: datos, última evaluación por criterio, objetivos e historial.
- Formulario de evaluación: seis criterios con notas enteras de 1 a 5.
- Creación de objetivos individuales y actualización de su progreso.

Todavía no hay base de datos, autenticación ni pagos. Los cambios se guardan
solo en el `localStorage` del navegador (`src/lib/almacen.tsx`) y se pueden
deshacer con «Restablecer».

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm test           # lógica (node --test)
npm run test:e2e   # compila y prueba los flujos en Chromium (móvil y escritorio)
npm run build
```

Stack: Next.js (App Router) · TypeScript · Tailwind CSS.
