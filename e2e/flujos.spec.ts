import type { Page } from "@playwright/test";
import { esperar404EnConsola, expect, test } from "./fixtures";

// Cada test arranca con un navegador limpio (localStorage vacío), así que
// parte siempre de los datos ficticios iniciales.

const resultados = (page: Page) => page.getByRole("list", { name: "Resultados" }).getByRole("link");

test.describe("Búsqueda y filtrado de jugadores", () => {
  test("busca sin tildes y por grupo, filtra por nivel y posición, y limpia", async ({ page }) => {
    await page.goto("/demo/jugadores");
    await expect(resultados(page)).toHaveCount(6);

    const buscar = page.getByRole("searchbox", { name: "Buscar jugador" });
    await buscar.fill("lucia");
    await expect(resultados(page)).toHaveCount(1);
    await expect(resultados(page).first()).toContainText("Lucía Marván");

    await buscar.fill("adultos");
    await expect(resultados(page)).toHaveCount(2);

    await buscar.fill("");
    await page.getByRole("button", { name: "Intermedio" }).click();
    await expect(page.getByRole("button", { name: "Intermedio" })).toHaveAttribute("aria-pressed", "true");
    await expect(resultados(page)).toHaveCount(2);
    await page.getByRole("button", { name: "Revés" }).click();
    await expect(resultados(page)).toHaveCount(1);
    await expect(resultados(page).first()).toContainText("Irene Solana");

    // Pulsar de nuevo un filtro activo lo desactiva.
    await page.getByRole("button", { name: "Revés" }).click();
    await expect(resultados(page)).toHaveCount(2);

    await buscar.fill("zzz");
    await expect(page.getByText("Ningún jugador coincide con la búsqueda.")).toBeVisible();
    await expect(page.getByText("0 jugadores")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(resultados(page)).toHaveCount(6);
    await expect(buscar).toHaveValue("");
  });
});

test.describe("Ficha de jugador", () => {
  test("abre la ficha desde la lista con datos ficticios marcados", async ({ page }) => {
    await page.goto("/demo/jugadores");
    await page.getByRole("searchbox", { name: "Buscar jugador" }).fill("noa");
    await resultados(page).first().click();

    await expect(page).toHaveURL(/\/jugadores\/j3$/);
    await expect(page.getByRole("heading", { level: 1, name: "Noa Etxabe" })).toBeVisible();
    await expect(page.getByText("Ficticio", { exact: true })).toBeVisible();
    await expect(page.getByText("Bandeja profunda", { exact: true })).toBeVisible();
    // Última evaluación sembrada: 5,4,5,4,4,4 → media 4,3 → puntuación 87.
    await expect(page.getByRole("list", { name: "Notas por criterio" }).getByRole("listitem")).toHaveCount(6);
    await expect(page.getByText("Media 4,3")).toBeVisible();
    await expect(page.getByRole("list", { name: "Historial de evaluaciones" }).getByRole("listitem")).toHaveCount(2);
  });

  test("un jugador inexistente responde 404 real y muestra la página en español (regresión)", async ({ page }) => {
    esperar404EnConsola();
    // Antes: código 200 con la página de no encontrado en streaming.
    for (const ruta of ["/demo/jugadores/no-existe", "/demo/jugadores/J1", "/demo/jugadores/j1%20", "/demo/jugadores/%E0%A4%A", "/demo/jugadores/j1/extra", "/jugadores/no-existe", "/grupos/no-existe"]) {
      const respuesta = await page.goto(ruta);
      expect(respuesta?.status(), ruta).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: "Página no encontrada" })).toBeVisible();
      await expect(page).toHaveTitle("Página no encontrada · ÉVORA PADEL");
      await expect(page.getByRole("link", { name: "Ver jugadores" })).toBeVisible();
    }
    // Desde la 404 se vuelve a la app.
    await page.getByRole("link", { name: "Ver jugadores" }).click();
    await expect(page).toHaveURL(/\/jugadores$/);
  });

  test("las fichas existentes siguen respondiendo 200", async ({ page }) => {
    for (const id of ["j1", "j2", "j3", "j4", "j5", "j6"]) {
      const respuesta = await page.goto(`/demo/jugadores/${id}`);
      expect(respuesta?.status(), id).toBe(200);
      await expect(page.getByText("Ficticio", { exact: true })).toBeVisible();
    }
  });
});

test.describe("Evaluaciones", () => {
  test("completa una evaluación pendiente con notas de 1 a 5", async ({ page }) => {
    await page.goto("/demo/evaluaciones");
    await page.getByRole("link", { name: /Evaluar a Irene Solana/ }).click();
    await expect(page).toHaveURL(/\/evaluaciones\/nueva\?pendiente=e1/);

    // Viene precargada desde la pendiente.
    await expect(page.getByLabel("Jugador", { exact: true })).toHaveValue("j5");
    await expect(page.getByLabel("Tipo de evaluación")).toHaveValue("Evaluación técnica");

    // Enviar sin notas: un error por criterio y el foco en el primero.
    await page.getByRole("button", { name: "Guardar evaluación" }).click();
    await expect(page.getByText("Revisa los campos marcados.")).toBeVisible();
    await expect(page.getByText("Puntúa de 1 a 5.")).toHaveCount(6);
    await expect(page.getByRole("radio", { name: "Golpes de fondo: 1 (Inicial)" })).toBeFocused();
    // El grupo entero se marca inválido y apunta a su mensaje.
    const grupo = page.getByRole("radiogroup", { name: "Golpes de fondo" });
    await expect(grupo).toHaveAttribute("aria-invalid", "true");
    await expect(grupo).toHaveAccessibleDescription("Puntúa de 1 a 5.");

    const notas = { "Golpes de fondo": 4, "Juego en la red": 3, "Juego aéreo": 3, "Lectura táctica": 4, "Condición física": 5, "Fortaleza mental": 4 };
    for (const [criterio, nota] of Object.entries(notas)) {
      await page.getByRole("radio", { name: new RegExp(`^${criterio}: ${nota} `) }).check();
    }
    await expect(page.getByText("Puntúa de 1 a 5.")).toHaveCount(0);
    await expect(page.getByText("6/6 criterios")).toBeVisible();
    // Media mostrada con un decimal (3,8); puntos con la media exacta 23/6 → 77.
    await expect(page.getByText(/media\s*3,8\s*·\s*77\s*pts/)).toBeVisible();

    await page.getByLabel("Comentario (opcional)").fill("Buena sesión de prueba.");
    await page.getByRole("button", { name: "Guardar evaluación" }).click();

    // Vuelve a la ficha con la nueva evaluación como la última.
    await expect(page).toHaveURL(/\/jugadores\/j5$/);
    await expect(page.getByRole("status")).toHaveText("Evaluación guardada en la demo (solo en este navegador)");
    await expect(page.getByText("Media 3,8")).toBeVisible();
    await expect(page.getByText("«Buena sesión de prueba.»")).toBeVisible();
    await expect(page.getByRole("list", { name: "Historial de evaluaciones" }).getByRole("listitem")).toHaveCount(3);
    // 23/6 × 20 = 76,7 → 77; la anterior era 57 → +20.
    await expect(page.getByRole("definition").filter({ hasText: /^77$/ })).toBeVisible();
    await expect(page.getByText("+20")).toBeVisible();

    // La pendiente desaparece.
    await page.goto("/demo/evaluaciones");
    await expect(page.getByRole("link", { name: /Evaluar a Irene Solana/ })).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Evaluaciones pendientes" }).getByRole("listitem")).toHaveCount(3);
  });

  test("nueva evaluación sin jugador ni tipo pide ambos", async ({ page }) => {
    await page.goto("/demo/evaluaciones/nueva");
    await page.getByRole("button", { name: "Guardar evaluación" }).click();
    await expect(page.getByText("Elige un jugador.")).toBeVisible();
    await expect(page.getByText("Elige el tipo de evaluación.")).toBeVisible();
    await expect(page.getByLabel("Jugador", { exact: true })).toBeFocused();
  });

  test("solo ofrece puntuaciones enteras de 1 a 5", async ({ page }) => {
    await page.goto("/demo/evaluaciones/nueva?jugador=j1");
    const radios = page.getByRole("radiogroup", { name: "Juego aéreo" }).getByRole("radio");
    await expect(radios).toHaveCount(5);
    for (const [i, valor] of ["1", "2", "3", "4", "5"].entries()) {
      await expect(radios.nth(i)).toHaveAttribute("value", valor);
    }
  });
});

test.describe("Objetivos", () => {
  test("crea un objetivo con validación y actualiza su progreso hasta completarlo", async ({ page }) => {
    await page.goto("/demo/jugadores/j4");
    await page.getByRole("link", { name: "Nuevo objetivo" }).click();
    await expect(page).toHaveURL(/\/objetivos\/nuevo\?jugador=j4/);
    await expect(page.getByLabel("Jugador", { exact: true })).toHaveValue("j4");

    // Datos inválidos.
    await page.getByLabel("Objetivo", { exact: true }).fill("ab");
    await page.getByLabel("Meta", { exact: true }).fill("2,5");
    await page.getByRole("button", { name: "Crear objetivo" }).click();
    await expect(page.getByText("Escribe entre 3 y 80 caracteres.")).toBeVisible();
    await expect(page.getByText("Elige un área.")).toBeVisible();
    await expect(page.getByText("La meta debe ser un número entero entre 1 y 1000.")).toBeVisible();
    await expect(page.getByLabel("Objetivo", { exact: true })).toBeFocused();

    // Progreso mayor que la meta.
    await page.getByLabel("Objetivo", { exact: true }).fill("Globos al fondo de pista");
    await page.getByRole("radio", { name: "Táctica" }).check();
    await page.getByLabel("Meta", { exact: true }).fill("3");
    await page.getByLabel("Progreso actual").fill("4");
    await page.getByRole("button", { name: "Crear objetivo" }).click();
    await expect(page.getByText("El progreso no puede superar la meta.")).toBeVisible();

    await page.getByLabel("Progreso actual").fill("1");
    await page.getByRole("button", { name: "Crear objetivo" }).click();

    await expect(page).toHaveURL(/\/jugadores\/j4$/);
    await expect(page.getByRole("status")).toHaveText("Objetivo creado en la demo (solo en este navegador)");
    const lista = page.getByRole("list", { name: "Objetivos del jugador" });
    const fila = lista.getByRole("listitem").filter({ hasText: "Globos al fondo de pista" });
    await expect(fila).toContainText("1 de 3");
    await expect(fila.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");

    const restar = fila.getByRole("button", { name: /Restar 1/ });
    const sumar = fila.getByRole("button", { name: /Sumar 1/ });
    await restar.click();
    await expect(fila).toContainText("0 de 3");
    await expect(restar).toBeDisabled();

    await sumar.click();
    await sumar.click();
    await sumar.click();
    await expect(fila).toContainText("3 de 3");
    await expect(fila).toContainText("Completado");
    await expect(sumar).toBeDisabled();

    // También aparece en la lista general, en «Completados».
    await page.goto("/demo/objetivos");
    await expect(
      page.getByRole("list", { name: "Objetivos completados" }).getByText("Globos al fondo de pista"),
    ).toBeVisible();
  });

  test("actualiza el progreso desde la lista de objetivos", async ({ page }) => {
    await page.goto("/demo/objetivos");
    const fila = page.getByRole("listitem").filter({ hasText: "Remates por 3 ganadores" });
    await expect(fila).toContainText("7 de 10");
    await fila.getByRole("button", { name: /Sumar 1/ }).click();
    await expect(fila).toContainText("8 de 10");
    await expect(fila.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "80");
  });
});

test.describe("Persistencia en el navegador", () => {
  test("los cambios sobreviven a una recarga y «Restablecer» vuelve a los datos iniciales", async ({ page }) => {
    await page.goto("/demo/objetivos");
    const fila = () => page.getByRole("listitem").filter({ hasText: "Rutina antes del saque" });
    await fila().getByRole("button", { name: /Sumar 1/ }).click();
    await expect(fila()).toContainText("10 de 10");

    await page.reload();
    await expect(fila()).toContainText("10 de 10");
    await expect(page.getByRole("list", { name: "Objetivos completados" })).toContainText("Rutina antes del saque");

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Restablecer" }).click();
    await expect(page.getByRole("status")).toHaveText("Datos de demostración restablecidos");
    await expect(fila()).toContainText("9 de 10");
    await page.reload();
    await expect(fila()).toContainText("9 de 10");
  });

  const malformados: Record<string, (e: Record<string, unknown[]>) => void> = {
    "JSON inválido": () => {},
    "pendiente nula": (e) => (e.pendientes![0] = null),
    "fecha inválida": (e) => ((e.evaluaciones![0] as Record<string, unknown>).fecha = "abc"),
    "nota fuera de rango": (e) => (((e.evaluaciones![0] as Record<string, unknown>).notas as Record<string, unknown>).fondo = 9),
    "jugador inexistente": (e) => ((e.objetivos![0] as Record<string, unknown>).jugadorId = "j999"),
    "progreso mayor que la meta": (e) => ((e.objetivos![0] as Record<string, unknown>).progreso = 99),
    "área no permitida": (e) => ((e.objetivos![0] as Record<string, unknown>).area = "Nutrición"),
  };

  for (const [caso, romper] of Object.entries(malformados)) {
    test(`descarta datos guardados mal formados sin romper la interfaz: ${caso}`, async ({ page }) => {
      // Estado guardado válido (se captura de la app) y luego se estropea.
      await page.goto("/demo/objetivos");
      const leer = () => page.evaluate(() => window.localStorage.getItem("evora-padel-demo-v1"));
      // La app guarda tras leer el almacenamiento (en un efecto): esperar a que exista.
      await expect.poll(leer).not.toBeNull();
      const estado = JSON.parse((await leer())!) as Record<string, unknown[]>;
      (estado.objetivos![0] as Record<string, unknown>).progreso = 3; // marca para ver si se usa
      romper(estado);
      const guardar = caso === "JSON inválido" ? "{roto" : JSON.stringify(estado);
      await page.evaluate((v) => window.localStorage.setItem("evora-padel-demo-v1", v), guardar);

      const avisos: string[] = [];
      page.on("console", (m) => m.type() === "warning" && avisos.push(m.text()));
      for (const ruta of ["/demo/objetivos", "/demo", "/demo/jugadores/j1", "/demo/evaluaciones"]) {
        await page.goto(ruta);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      }
      // Se usan los datos iniciales (7 de 10), no los guardados (3 de 10).
      await page.goto("/demo/objetivos");
      await expect(page.getByRole("listitem").filter({ hasText: "Remates por 3 ganadores" })).toContainText("7 de 10");
      expect(avisos.some((a) => a.includes("no válidos"))).toBe(true);
      // Y lo guardado queda sustituido por un estado válido.
      await expect.poll(async () => JSON.parse((await leer()) ?? "{}").objetivos?.[0]?.progreso).toBe(7);
    });
  }
});
