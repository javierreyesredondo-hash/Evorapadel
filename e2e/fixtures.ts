import { expect, test as base, type Page } from "@playwright/test";

/**
 * Contenido en streaming (zona privada tras Suspense): React lo inserta primero
 * en un <div hidden id="S:…"> y lo coloca en su sitio poco después (React 19
 * agrupa esas apariciones). Mientras dura, el texto existe dos veces en el
 * DOM. page.goto/reload esperan a que termine antes de devolver el control.
 */
async function esperarStreaming(page: Page) {
  await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'));
}

// Todas las pruebas fallan si la página emite errores de consola o lanza
// excepciones no capturadas. Una prueba que espere un error concreto (p. ej.
// el 404 de un documento) lo declara con:
//   test.info().annotations.push({ type: "error-consola-esperado", description: "<texto>" });
export const test = base.extend<{ erroresConsola: string[] }>({
  page: async ({ page }, usar) => {
    const goto = page.goto.bind(page);
    const reload = page.reload.bind(page);
    page.goto = async (...args: Parameters<Page["goto"]>) => {
      const r = await goto(...args);
      await esperarStreaming(page);
      return r;
    };
    page.reload = async (...args: Parameters<Page["reload"]>) => {
      const r = await reload(...args);
      await esperarStreaming(page);
      return r;
    };
    await usar(page);
  },
  erroresConsola: [
    async ({ page }, use, info) => {
      const errores: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errores.push(m.text());
      });
      page.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));
      await use(errores);
      const esperados = info.annotations
        .filter((a) => a.type === "error-consola-esperado")
        .map((a) => a.description ?? "");
      const inesperados = errores.filter((e) => !esperados.some((t) => e.includes(t)));
      expect(inesperados, "errores de consola o de página inesperados").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** El navegador registra como error de consola la carga de un documento con 404. */
export function esperar404EnConsola() {
  test.info().annotations.push({ type: "error-consola-esperado", description: "status of 404" });
}
