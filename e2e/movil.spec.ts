import { expect, test, type Page } from "@playwright/test";

const RUTAS = [
  "/",
  "/jugadores",
  "/jugadores/j1",
  "/evaluaciones",
  "/evaluaciones/nueva?jugador=j1",
  "/objetivos",
  "/objetivos/nuevo",
];

/** Tamaño mínimo razonable para tocar con el dedo (WCAG 2.5.8 pide 24 px; usamos 40). */
const MIN_TACTIL = 40;

async function sinDesbordamiento(page: Page) {
  const { ancho, visible } = await page.evaluate(() => ({
    ancho: document.documentElement.scrollWidth,
    visible: window.innerWidth,
  }));
  expect(ancho, "no debe haber scroll horizontal").toBeLessThanOrEqual(visible);
}

/** El centro del elemento no lo tapa nada (p. ej. la barra inferior fija). */
async function noTapado(page: Page, nombre: string) {
  const boton = page.getByRole("button", { name: nombre });
  await boton.scrollIntoViewIfNeeded();
  const tapado = await boton.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const encima = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !(encima && (el === encima || el.contains(encima)));
  });
  expect(tapado, `«${nombre}» no debe quedar bajo otro elemento`).toBe(false);
}

test.describe("Experiencia móvil @movil", () => {
  for (const ruta of RUTAS) {
    test(`${ruta} cabe en pantalla, con barra inferior y aviso de demo`, async ({ page }) => {
      const errores: string[] = [];
      page.on("pageerror", (e) => errores.push(e.message));
      page.on("console", (m) => m.type() === "error" && errores.push(m.text()));

      await page.goto(ruta);
      await expect(page.getByText(/Modo demostración/)).toBeVisible();
      const barra = page.getByRole("navigation", { name: "Principal" });
      await expect(barra).toBeVisible();
      const caja = await barra.boundingBox();
      const alto = page.viewportSize()!.height;
      expect(caja!.y + caja!.height).toBeCloseTo(alto, 0);

      await sinDesbordamiento(page);
      expect(errores).toEqual([]);
    });
  }

  test("botones de nota y de progreso tienen tamaño táctil", async ({ page }) => {
    await page.goto("/evaluaciones/nueva?jugador=j1");
    const nota = page.getByRole("radio", { name: "Golpes de fondo: 3 (Competente)" });
    const cajaNota = await nota.boundingBox();
    expect(cajaNota!.height).toBeGreaterThanOrEqual(MIN_TACTIL);
    expect(cajaNota!.width).toBeGreaterThanOrEqual(MIN_TACTIL);

    // Tocar (tap) también selecciona.
    await nota.tap();
    await expect(nota).toBeChecked();

    await page.goto("/objetivos");
    const sumar = page.getByRole("button", { name: /Sumar 1/ }).first();
    const cajaSumar = await sumar.boundingBox();
    expect(cajaSumar!.height).toBeGreaterThanOrEqual(MIN_TACTIL);
    expect(cajaSumar!.width).toBeGreaterThanOrEqual(MIN_TACTIL);
  });

  test("la barra inferior no tapa los botones de guardar", async ({ page }) => {
    await page.goto("/evaluaciones/nueva?jugador=j1");
    await noTapado(page, "Guardar evaluación");
    await page.goto("/objetivos/nuevo");
    await noTapado(page, "Crear objetivo");
  });

  test("navegar con la barra inferior marca la pestaña activa", async ({ page }) => {
    await page.goto("/");
    const barra = page.getByRole("navigation", { name: "Principal" });
    await barra.getByRole("link", { name: "Jugadores" }).tap();
    await expect(page).toHaveURL(/\/jugadores$/);
    await expect(barra.getByRole("link", { name: "Jugadores" })).toHaveAttribute("aria-current", "page");
    // La ficha cuelga de Jugadores: la pestaña sigue activa.
    await page.getByRole("list", { name: "Resultados" }).getByRole("link").first().tap();
    await expect(barra.getByRole("link", { name: "Jugadores" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("Escritorio @escritorio", () => {
  test("menú lateral visible y barra inferior oculta", async ({ page }) => {
    await page.goto("/");
    const navs = page.getByRole("navigation", { name: "Principal" });
    await expect(navs).toHaveCount(1); // solo la lateral es visible para la accesibilidad
    await navs.getByRole("link", { name: "Objetivos" }).click();
    await expect(page).toHaveURL(/\/objetivos$/);
    await expect(navs.getByRole("link", { name: "Objetivos" })).toHaveAttribute("aria-current", "page");
    await sinDesbordamiento(page);
  });
});
