import { defineConfig, devices } from "@playwright/test";

// Pruebas de extremo a extremo sobre la build de producción.
// Ejecutar con `npm run test:e2e` (compila y luego prueba).
const PUERTO = 3100;

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
    // Viewport móvil principal (390 × 844, táctil). Chromium es el único navegador instalado.
    { name: "movil", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "movil-pequeno", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 640 } }, grep: /@movil/ },
    { name: "escritorio", use: { ...devices["Desktop Chrome"] }, grep: /@escritorio/ },
  ],
  webServer: {
    command: `npx next start -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
