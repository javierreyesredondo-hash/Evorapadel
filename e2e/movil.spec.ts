import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { clienteComo, unico } from "./credenciales";

/** Pantallas con datos reales (Supabase) y de la demostración (ficticias). */
const RUTAS: [string, RegExp][] = [
  ["/", /Datos reales de tu escuela/],
  ["/jugadores", /Datos reales de tu escuela/],
  ["/jugadores/nuevo", /Datos reales de tu escuela/],
  ["/grupos", /Datos reales de tu escuela/],
  ["/grupos/nuevo", /Datos reales de tu escuela/],
  ["/evaluaciones", /Datos reales de tu escuela/],
  ["/evaluaciones/nueva", /Datos reales de tu escuela/],
  ["/metodologia", /Datos reales de tu escuela/],
  ["/perfil", /Datos reales de tu escuela/],
  ["/entrenamiento", /Datos reales de tu escuela/],
  ["/demo", /Modo demostración/],
  ["/demo/jugadores", /Modo demostración/],
  ["/demo/jugadores/j1", /Modo demostración/],
  ["/demo/evaluaciones", /Modo demostración/],
  ["/demo/evaluaciones/nueva?jugador=j1", /Modo demostración/],
  ["/demo/objetivos", /Modo demostración/],
  ["/demo/objetivos/nuevo", /Modo demostración/],
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
  for (const [ruta, modo] of RUTAS) {
    test(`${ruta}: cabe en pantalla, barra inferior, indicador de modo, controles táctiles y accesibilidad`, async ({
      page,
    }) => {
      await page.goto(ruta);
      // Siempre queda claro si los datos son reales o de la demostración.
      await expect(page.getByText(modo)).toBeVisible();
      // Los datos reales llegan en streaming: esperar al contenido antes de medir.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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
    await page.goto("/demo/jugadores");
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
    await page.goto("/demo/evaluaciones/nueva");
    await page.getByRole("button", { name: "Guardar evaluación" }).click();
    await expect(page.getByText("Revisa los campos marcados.")).toBeVisible();
    await sinInfraccionesAxe(page, "evaluación con errores");

    await page.goto("/demo/objetivos/nuevo");
    await page.getByRole("button", { name: "Crear objetivo" }).click();
    await expect(page.getByText("Elige un área.")).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Área" })).toHaveAttribute("aria-invalid", "true");
    await sinInfraccionesAxe(page, "objetivo con errores");
  });

  test("tocar una nota la selecciona y los botones de progreso responden al tacto", async ({ page }) => {
    await page.goto("/demo/evaluaciones/nueva?jugador=j1");
    const nota = page.getByRole("radio", { name: "Golpes de fondo: 3 (Competente)" });
    await nota.tap();
    await expect(nota).toBeChecked();
    await expect(page.getByText("Puntúa de 1 a 5.")).toHaveCount(0);

    await page.goto("/demo/objetivos");
    const fila = page.getByRole("listitem").filter({ hasText: "Remates por 3 ganadores" });
    await fila.getByRole("button", { name: /Sumar 1/ }).tap();
    await expect(fila).toContainText("8 de 10");
  });

  test("la barra inferior no tapa los botones de guardar", async ({ page }) => {
    await page.goto("/demo/evaluaciones/nueva?jugador=j1");
    await noTapado(page, "Guardar evaluación");
    await page.goto("/demo/objetivos/nuevo");
    await noTapado(page, "Crear objetivo");
  });

  test("el foco va al primer error aunque esté bajo la barra fija", async ({ page }) => {
    await page.goto("/demo/evaluaciones/nueva?jugador=j1");
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
    // El alta cuelga de Jugadores: la pestaña sigue activa.
    await page.getByRole("link", { name: "Nuevo", exact: true }).tap();
    await expect(page).toHaveURL(/\/jugadores\/nuevo$/);
    await expect(barra.getByRole("link", { name: "Jugadores" })).toHaveAttribute("aria-current", "page");
    await barra.getByRole("link", { name: "Demo" }).tap();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(barra.getByRole("link", { name: "Demo" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("Evaluación e informe en el móvil @movil", () => {
  test("detalle, edición e informe: caben, controles táctiles y accesibilidad", async ({ page }) => {
    // Evaluación sintética del director A (misma sesión que estas pruebas).
    const sb = await clienteComo("DIRECTOR_A");
    const { data: esc } = await sb.from("escuelas").select("id").single();
    const { data: jugador } = await sb.from("jugadores").insert({ escuela_id: esc!.id, nombre: `Móvil ${unico()}` }).select("id").single();
    const { data: comps } = await sb.from("competencias").select("id").eq("activa", true).order("orden");
    const { data: id } = await sb.rpc("guardar_evaluacion", {
      p_escuela: esc!.id, p_id: null, p_clave_envio: crypto.randomUUID(), p_jugador: jugador!.id, p_grupo: null,
      p_tipo: "completa", p_fecha: new Date().toISOString().slice(0, 10), p_titulo: "Trimestral", p_fortalezas: "Constancia",
      p_mejoras: "Volea", p_observaciones: "Observación larga ".repeat(40), p_puntuaciones: comps!.map((c, i) => ({ competencia: c.id, puntuacion: (i % 5) + 1 })),
      p_objetivos: [{ descripcion: "Objetivo de prueba", plazo: null }],
    });
    for (const ruta of [`/evaluaciones/${id}`, `/evaluaciones/${id}/editar`, `/evaluaciones/${id}/informe`, `/jugadores/${jugador!.id}`]) {
      await page.goto(ruta);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      if (ruta.endsWith("/informe")) await expect(page.getByText("PDF listo.").filter({ visible: true })).toBeVisible();
      await sinDesbordamiento(page);
      expect(await controlesPequenos(page), `controles por debajo de 44 px en ${ruta}`).toEqual([]);
      await sinInfraccionesAxe(page, ruta);
    }
    // En el formulario, la barra inferior no tapa «Guardar cambios».
    await page.goto(`/evaluaciones/${id}/editar`);
    await noTapado(page, "Guardar cambios");
  });
});

test.describe("Escritorio @escritorio", () => {
  test("menú lateral visible, barra inferior oculta y sin infracciones de accesibilidad", async ({ page }) => {
    await page.goto("/");
    const navs = page.getByRole("navigation", { name: "Principal" });
    await expect(navs).toHaveCount(1); // solo la lateral es visible para la accesibilidad
    await navs.getByRole("link", { name: "Grupos" }).click();
    await expect(page).toHaveURL(/\/grupos$/);
    await expect(navs.getByRole("link", { name: "Grupos" })).toHaveAttribute("aria-current", "page");
    await sinDesbordamiento(page);
    await sinInfraccionesAxe(page, "escritorio /grupos");
  });
});
