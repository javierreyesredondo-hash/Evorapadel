import { defineConfig, devices } from "@playwright/test";

// Pruebas de extremo a extremo sobre la build de producción, contra el
// Supabase LOCAL (npm run supabase:local). Ejecutar con `npm run test:e2e`.
const PUERTO = 3100;
export const SESION_DIRECTOR_A = "e2e/.auth/director-a.json";

const conSesion = { storageState: SESION_DIRECTOR_A };
const sinSesion = /(acceso|rls|gestion|evaluaciones|roles|metodologias|cadena|invitaciones)\.spec\.ts|sesion\.setup\.ts/;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: "retain-on-failure",
  },
  projects: [
    // Inicia sesión una vez (director de la Escuela Demo A) y guarda la sesión.
    { name: "sesion", testMatch: /sesion\.setup\.ts/ },
    // Acceso, aislamiento entre escuelas y datos reales (jugadores, grupos, evaluaciones):
    // cada prueba inicia sesión con el usuario que necesita.
    { name: "acceso", testMatch: /(acceso|rls|gestion|evaluaciones|roles|metodologias|cadena|invitaciones)\.spec\.ts/, use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    // Pantallas de la app, ya con sesión (director A). Chromium es el único navegador instalado.
    { name: "movil", dependencies: ["sesion"], testIgnore: sinSesion,
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, ...conSesion } },
    { name: "movil-pequeno", dependencies: ["sesion"], testIgnore: sinSesion, grep: /@movil/,
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 640 }, ...conSesion } },
    { name: "escritorio", dependencies: ["sesion"], testIgnore: sinSesion, grep: /@escritorio/,
      use: { ...devices["Desktop Chrome"], ...conSesion } },
  ],
  webServer: {
    command: `npx next start -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}/acceso`,
    // Nunca reutilizar un servidor previo: podría servir una build antigua.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
