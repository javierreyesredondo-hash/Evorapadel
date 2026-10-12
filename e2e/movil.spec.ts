import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const RUTAS = [
  "/",
  "/jugadores",
  "/jugadores/j1",
  "/evaluaciones",
  "/evaluaciones/nueva?jugador=j1",
  "/objetivos",
  "/objetivos/nuevo",
];

/** Zona táctil mínima: 44 × 44 px (recomendación de Apple/WCAG 2.5.5). */
const MIN_TACTIL = 44;

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

/** Controles visibles más pequeños que el mínimo táctil. */
async function controlesPequenos(page: Page): Promise<string[]> {
  return page.evaluate((min) => {
    const fuera: string[] = [];
    document.querySelectorAll<HTMLElement>("a, button, input, select, textarea").forEach((el) => {
      if (!el.checkVisibility()) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.width < min || r.height < min) {
        const nombre = (el.innerText || el.getAttribute("aria-label") || el.id || el.tagName).trim().slice(0, 40);
        fuera.push(`${el.tagName.toLowerCase()} «${nombre}» ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
    });
    return fuera;
  }, MIN_TACTIL);
}

async function sinInfraccionesAxe(page: Page, contexto: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const resumen = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(resumen, `infracciones de accesibilidad en ${contexto}`).toEqual([]);
}

test.describe("Experiencia móvil @movil", () => {
  for (const ruta of RUTAS) {
    test(`${ruta}: cabe en pantalla, barra inferior, aviso de demo, controles táctiles y accesibilidad`, async ({
      page,
    }) => {
      await page.goto(ruta);
      await expect(page.getByText(/Modo demostración/)).toBeVisible();
      const barra = page.getByRole("navigation", { name: "Principal" });
      await expect(barra).toBeVisible();
      const caja = await barra.boundingBox();
      const alto = page.viewportSize()!.height;
      expect(caja!.y + caja!.height).toBeCloseTo(alto, 0);

      await sinDesbordamiento(page);
      expect(await controlesPequenos(page), "controles por debajo de 44 px").toEqual([]);
      await sinInfraccionesAxe(page, ruta);
      // Los errores de consola los comprueba la fixture común al terminar.
    });
  }

  test("filtros activos y página 404 también cumplen tamaño táctil y accesibilidad", async ({ page }) => {
    await page.goto("/jugadores");
    await page.getByRole("button", { name: "Avanzado" }).click();
    await page.getByRole("searchbox", { name: "Buscar jugador" }).fill("lu");
    await expect(page.getByRole("button", { name: "Limpiar filtros" })).toBeVisible();
    expect(await controlesPequenos(page)).toEqual([]);
    await sinInfraccionesAxe(page, "/jugadores con filtros");

    test.info().annotations.push({ type: "error-consola-esperado", description: "status of 404" });
    await page.goto("/jugadores/no-existe");
    await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
    expect(await controlesPequenos(page)).toEqual([]);
    await sinInfraccionesAxe(page, "404");
  });

  test("formularios con errores siguen siendo accesibles", async ({ page }) => {
    await page.goto("/evaluaciones/nueva");
    await page.getByRole("button", { name: "Guardar evaluación" }).click();
    await expect(page.getByText("Revisa los campos marcados.")).toBeVisible();
    await sinInfraccionesAxe(page, "evaluación con errores");

    await page.goto("/objetivos/nuevo");
    await page.getByRole("button", { name: "Crear objetivo" }).click();
    await expect(page.getByText("Elige un área.")).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Área" })).toHaveAttribute("aria-invalid", "true");
    await sinInfraccionesAxe(page, "objetivo con errores");
  });

  test("tocar una nota la selecciona y los botones de progreso responden al tacto", async ({ page }) => {
    await page.goto("/evaluaciones/nueva?jugador=j1");
    const nota = page.getByRole("radio", { name: "Golpes de fondo: 3 (Competente)" });
    await nota.tap();
    await expect(nota).toBeChecked();
    await expect(page.getByText("Puntúa de 1 a 5.")).toHaveCount(0);

    await page.goto("/objetivos");
    const fila = page.getByRole("listitem").filter({ hasText: "Remates por 3 ganadores" });
    await fila.getByRole("button", { name: /Sumar 1/ }).tap();
    await expect(fila).toContainText("8 de 10");
  });

  test("la barra inferior no tapa los botones de guardar", async ({ page }) => {
    await page.goto("/evaluaciones/nueva?jugador=j1");
    await noTapado(page, "Guardar evaluación");
    await page.goto("/objetivos/nuevo");
    await noTapado(page, "Crear objetivo");
  });

  test("el foco va al primer error aunque esté bajo la barra fija", async ({ page }) => {
    await page.goto("/evaluaciones/nueva?jugador=j1");
    await page.getByLabel("Tipo de evaluación").selectOption("Seguimiento");
    for (const c of ["Golpes de fondo", "Juego en la red", "Juego aéreo", "Lectura táctica", "Condición física"]) {
      await page.getByRole("radio", { name: new RegExp(`^${c}: 3 `) }).check();
    }
    // Falta solo «Fortaleza mental», el último criterio.
    await page.getByRole("button", { name: "Guardar evaluación" }).click();
    const primera = page.getByRole("radio", { name: "Fortaleza mental: 1 (Inicial)" });
    await expect(primera).toBeFocused();
    await expect(primera).toBeInViewport();
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
  test("menú lateral visible, barra inferior oculta y sin infracciones de accesibilidad", async ({ page }) => {
    await page.goto("/");
    const navs = page.getByRole("navigation", { name: "Principal" });
    await expect(navs).toHaveCount(1); // solo la lateral es visible para la accesibilidad
    await navs.getByRole("link", { name: "Objetivos" }).click();
    await expect(page).toHaveURL(/\/objetivos$/);
    await expect(navs.getByRole("link", { name: "Objetivos" })).toHaveAttribute("aria-current", "page");
    await sinDesbordamiento(page);
    await sinInfraccionesAxe(page, "escritorio /objetivos");
  });
});
