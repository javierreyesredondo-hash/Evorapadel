import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { clienteComo, credenciales, unico, type UsuarioPrueba } from "./credenciales";

// Jugadores y grupos REALES contra el Supabase local (migraciones reales + RLS),
// con usuarios y escuelas sintéticos. Cada prueba usa nombres únicos: se
// ejecutan en paralelo sobre la misma base de datos.
//
// Con Cache Components, Next conserva OCULTAS las pantallas ya visitadas (para
// volver atrás al instante): las búsquedas por texto miran solo lo visible.

async function entrar(page: Page, usuario: UsuarioPrueba) {
  const { email, contrasena } = credenciales(usuario);
  await page.goto("/acceso");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(contrasena);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("region", { name: "Tu escuela" })).toBeVisible();
}

const visible = (page: Page, texto: string | RegExp) => page.getByText(texto).filter({ visible: true });
const aviso = (page: Page) => page.locator('[data-prueba="aviso-guardado"]');
const URL_JUGADOR = /\/jugadores\/[0-9a-f-]{36}$/;
const URL_GRUPO = /\/grupos\/[0-9a-f-]{36}$/;

async function crearJugador(page: Page, nombre: string) {
  await page.goto("/jugadores/nuevo");
  await page.getByLabel("Nombre y apellidos").fill(nombre);
  await page.getByRole("button", { name: "Crear jugador" }).click();
  await expect(page).toHaveURL(URL_JUGADOR);
  await expect(page.getByRole("heading", { level: 1, name: nombre })).toBeVisible();
  return page.url().split("/").pop()!;
}

async function buscarEnLista(page: Page, texto: string) {
  await page.goto("/jugadores");
  await page.getByRole("searchbox", { name: "Buscar jugador" }).fill(texto);
}

test.describe("Jugadores reales", () => {
  test("director: crea, edita, archiva y reactiva un jugador", async ({ page }) => {
    const nombre = `Jugador E2E ${unico()}`;
    await entrar(page, "DIRECTOR_A");
    await page.goto("/jugadores/nuevo");
    await expect(visible(page, /^Datos reales de tu escuela\.$/)).toBeVisible();

    // Validación en español antes de guardar.
    await page.getByRole("button", { name: "Crear jugador" }).click();
    await expect(visible(page, "Escribe el nombre del jugador (al menos 2 caracteres).")).toBeVisible();
    await expect(page.getByLabel("Nombre y apellidos")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Nombre y apellidos")).toBeFocused();

    await page.getByLabel("Nombre y apellidos").fill(nombre);
    await page.getByLabel("Fecha de nacimiento (opcional)").fill("2012-03-04");
    await page.getByLabel("Nivel").selectOption({ label: "Intermedio" });
    await page.getByLabel("Posición").selectOption({ label: "Drive" });
    await page.getByLabel("Mano dominante").selectOption({ label: "Zurdo/a" });
    await page.getByLabel("Foco de trabajo (opcional)").fill("Volea de revés");
    await page.getByRole("button", { name: "Crear jugador" }).click();

    await expect(page).toHaveURL(URL_JUGADOR);
    await expect(aviso(page)).toHaveText("Jugador creado.");
    await expect(page.getByRole("heading", { level: 1, name: nombre })).toBeVisible();
    for (const dato of ["Intermedio", "Drive", "Zurdo/a", "Volea de revés", "4 mar 2012"]) {
      await expect(page.getByRole("definition").filter({ hasText: dato })).toBeVisible();
    }

    // Editar.
    await page.getByRole("link", { name: "Editar" }).click();
    await expect(page.getByLabel("Nombre y apellidos")).toHaveValue(nombre);
    await expect(page.getByLabel("Nivel")).toHaveValue("intermedio");
    await page.getByLabel("Nivel").selectOption({ label: "Avanzado" });
    await page.getByLabel("Foco de trabajo (opcional)").fill("Bandeja");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page).toHaveURL(URL_JUGADOR);
    await expect(aviso(page)).toHaveText("Cambios guardados.");
    await expect(page.getByRole("definition").filter({ hasText: "Avanzado" })).toBeVisible();
    await expect(page.getByRole("definition").filter({ hasText: "Bandeja" })).toBeVisible();

    // Archivar (pide confirmación) y reactivar. No se borra nada.
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Archivar" }).click();
    await expect(aviso(page)).toHaveText("Jugador archivado.");
    await expect(page.locator('[data-prueba="archivado"]')).toBeVisible();

    await buscarEnLista(page, nombre);
    await expect(page.getByRole("link", { name: new RegExp(nombre) })).toHaveCount(0);
    await page.getByRole("button", { name: /^Archivados/ }).click();
    await page.getByRole("link", { name: new RegExp(nombre) }).click();
    await page.getByRole("button", { name: "Reactivar" }).click();
    await expect(aviso(page)).toHaveText("Jugador reactivado.");
    await expect(page.locator('[data-prueba="archivado"]')).toHaveCount(0);
  });

  test("no duplica jugadores: homónimos con confirmación y doble clic", async ({ page }) => {
    const s = unico();
    await entrar(page, "DIRECTOR_A");
    await crearJugador(page, `Homónimo Pérez ${s}`);

    // Mismo nombre sin tildes ni mayúsculas: pide confirmación.
    await page.goto("/jugadores/nuevo");
    await page.getByLabel("Nombre y apellidos").fill(`homonimo perez ${s}`);
    await page.getByRole("button", { name: "Crear jugador" }).click();
    await expect(visible(page, `Ya hay un jugador llamado «Homónimo Pérez ${s}» en tu escuela.`)).toBeVisible();
    await expect(page.getByLabel("Nombre y apellidos")).toHaveValue(`homonimo perez ${s}`);
    await page.getByLabel(/Es otra persona distinta/).check();
    await page.getByRole("button", { name: "Crear jugador" }).click();
    await expect(page).toHaveURL(URL_JUGADOR);

    await buscarEnLista(page, `perez ${s}`);
    await expect(page.getByRole("list", { name: "Jugadores de tu escuela" }).getByRole("link")).toHaveCount(2);

    // Doble clic en «Crear»: un solo jugador.
    const doble = `Doble Clic ${s}`;
    await page.goto("/jugadores/nuevo");
    await page.getByLabel("Nombre y apellidos").fill(doble);
    await page.getByRole("button", { name: "Crear jugador" }).dblclick();
    await expect(page).toHaveURL(URL_JUGADOR);
    const sb = await clienteComo("DIRECTOR_A");
    const { data } = await sb.from("jugadores").select("id").eq("nombre", doble);
    expect(data).toHaveLength(1);
  });

  test("volver a «Nuevo» tras guardar da un formulario limpio (regresión)", async ({ page }) => {
    // Next conserva la pantalla del alta ya guardada; antes, al volver a ella,
    // se repetía la redirección a la ficha del jugador anterior.
    await entrar(page, "DIRECTOR_A");
    await crearJugador(page, `Primero ${unico()}`);
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Jugadores" }).click();
    await page.getByRole("link", { name: "Nuevo", exact: true }).click();
    await expect(page).toHaveURL(/\/jugadores\/nuevo$/);
    await expect(page.getByLabel("Nombre y apellidos")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Crear jugador" })).toBeEnabled();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/jugadores\/nuevo$/);

    const segundo = `Segundo ${unico()}`;
    await page.getByLabel("Nombre y apellidos").fill(segundo);
    await page.getByRole("button", { name: "Crear jugador" }).click();
    await expect(page.getByRole("heading", { level: 1, name: segundo })).toBeVisible();
  });

  test("errores de validación del servidor en español", async ({ page }) => {
    await entrar(page, "DIRECTOR_A");
    await page.goto("/jugadores/nuevo");
    await page.getByLabel("Nombre y apellidos").fill("Fecha Futura");
    // El navegador limita la fecha, pero el servidor también la comprueba.
    await page.getByLabel("Fecha de nacimiento (opcional)").evaluate((el: HTMLInputElement) => {
      el.removeAttribute("max");
      el.value = "2999-01-01";
    });
    await page.getByRole("button", { name: "Crear jugador" }).click();
    await expect(visible(page, "La fecha de nacimiento no puede ser futura.")).toBeVisible();
    await expect(page).toHaveURL(/\/jugadores\/nuevo$/);
  });
});

test.describe("Grupos reales", () => {
  test("director: crea y edita grupos, asigna y quita jugadores, sin duplicados", async ({ page }) => {
    const s = unico();
    const jugador = `Jugador Grupo ${s}`;
    const grupo = `Grupo E2E ${s}`;
    await entrar(page, "DIRECTOR_A");
    const jugadorId = await crearJugador(page, jugador);

    await page.goto("/grupos");
    await page.getByRole("link", { name: "Nuevo", exact: true }).click();
    await page.getByRole("button", { name: "Crear grupo" }).click();
    await expect(visible(page, "Escribe el nombre del grupo.")).toBeVisible();
    await page.getByLabel("Nombre del grupo").fill(grupo);
    await page.getByLabel("Entrenador/a responsable").selectOption({ label: "Entrenador/a sin nombre visible" });
    await page.getByRole("button", { name: "Crear grupo" }).click();
    await expect(page).toHaveURL(URL_GRUPO);
    await expect(aviso(page)).toHaveText("Grupo creado.");
    await expect(page.getByRole("heading", { level: 1, name: grupo })).toBeVisible();
    await expect(visible(page, "Entrenador/a sin nombre visible")).toBeVisible();
    const grupoUrl = page.url();

    // Asignar desde el grupo.
    await page.getByLabel("Añadir jugador al grupo").selectOption({ label: jugador });
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(aviso(page)).toHaveText("Jugador añadido al grupo.");
    const lista = page.getByRole("list", { name: "Jugadores del grupo" });
    await expect(lista.getByRole("link", { name: jugador })).toBeVisible();
    // Ya no se ofrece de nuevo (no se puede asignar dos veces).
    await expect(page.getByLabel("Añadir jugador al grupo").locator("option", { hasText: jugador })).toHaveCount(0);

    // Nombre repetido (otras mayúsculas): error claro, no se crea.
    await page.goto("/grupos/nuevo");
    await page.getByLabel("Nombre del grupo").fill(grupo.toUpperCase());
    await page.getByRole("button", { name: "Crear grupo" }).click();
    await expect(visible(page, "Ya existe un grupo con ese nombre en tu escuela.")).toBeVisible();
    await expect(page).toHaveURL(/\/grupos\/nuevo$/);

    // Editar.
    await page.goto(grupoUrl);
    await page.getByRole("link", { name: "Editar grupo" }).click();
    await page.getByLabel("Nombre del grupo").fill(`${grupo} (renombrado)`);
    await page.getByLabel("Entrenador/a responsable").selectOption({ label: "Sin asignar" });
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page).toHaveURL(grupoUrl);
    await expect(aviso(page)).toHaveText("Cambios guardados.");
    await expect(page.getByRole("heading", { level: 1, name: `${grupo} (renombrado)` })).toBeVisible();
    await expect(visible(page, "Sin entrenador/a")).toBeVisible();

    // La ficha del jugador muestra el grupo; se puede quitar desde ahí.
    await page.goto(`/jugadores/${jugadorId}`);
    const grupos = page.getByRole("list", { name: "Grupos del jugador" });
    await expect(grupos.getByRole("link", { name: `${grupo} (renombrado)` })).toBeVisible();
    await page.getByRole("button", { name: `Quitar del grupo ${grupo} (renombrado)` }).click();
    await expect(aviso(page)).toHaveText("Jugador quitado del grupo.");
    await expect(visible(page, "No está en ningún grupo.")).toBeVisible();

    // Y volver a añadirlo desde la ficha.
    await page.getByLabel("Añadir a un grupo").selectOption({ label: `${grupo} (renombrado)` });
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(aviso(page)).toHaveText("Jugador añadido al grupo.");
    await expect(grupos.getByRole("link", { name: `${grupo} (renombrado)` })).toBeVisible();

    // Un jugador archivado no se puede añadir a grupos.
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Archivar" }).click();
    await expect(aviso(page)).toHaveText("Jugador archivado.");
    await expect(visible(page, "Reactívalo para poder añadirlo a un grupo.")).toBeVisible();
  });

  test("entrenador: da de alta jugadores, pero no crea ni edita grupos", async ({ page }) => {
    await entrar(page, "ENTRENADOR_A");
    await page.goto("/grupos");
    await expect(visible(page, /Solo la dirección puede crear o editar grupos/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Nuevo", exact: true })).toHaveCount(0);
    await page.goto("/grupos/nuevo");
    await expect(visible(page, "Solo la dirección de la escuela puede crear o editar grupos.")).toBeVisible();
    await expect(page.getByLabel("Nombre del grupo")).toHaveCount(0);

    await crearJugador(page, `Alta Entrenador ${unico()}`);
    await expect(aviso(page)).toHaveText("Jugador creado.");
  });
});

test.describe("Aislamiento entre escuelas en la app", () => {
  test("el director de B no ve ni modifica jugadores ni grupos de A", async ({ page }) => {
    const s = unico();
    // Datos de A creados por su director.
    const a = await clienteComo("DIRECTOR_A");
    const { data: escuelaA } = await a.from("escuelas").select("id").single();
    const jugadorA = await a.from("jugadores").insert({ escuela_id: escuelaA!.id, nombre: `Secreto A ${s}` }).select("id").single();
    const grupoA = await a.from("grupos").insert({ escuela_id: escuelaA!.id, nombre: `Grupo Secreto A ${s}` }).select("id").single();
    const idJugadorA = jugadorA.data!.id as string;

    await entrar(page, "DIRECTOR_B");
    for (const [ruta, titulo] of [
      [`/jugadores/${idJugadorA}`, "Jugador no encontrado"],
      [`/jugadores/${idJugadorA}/editar`, "Jugador no encontrado"],
      [`/grupos/${grupoA.data!.id}`, "Grupo no encontrado"],
    ]) {
      await page.goto(ruta);
      await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();
      await expect(page.getByText(`Secreto A ${s}`)).toHaveCount(0);
    }
    await page.goto("/jugadores");
    await expect(page.getByRole("heading", { level: 1, name: "Jugadores" })).toBeVisible();
    await expect(page.getByText(`Secreto A ${s}`)).toHaveCount(0);
    await page.goto("/grupos");
    await expect(page.getByRole("heading", { level: 1, name: "Grupos" })).toBeVisible();
    await expect(page.getByText(`Grupo Secreto A ${s}`)).toHaveCount(0);

    // Manipular el formulario: editar un jugador propio cambiando el id oculto
    // por el de A. El servidor lo rechaza (y RLS también lo haría).
    const propioId = await crearJugador(page, `Propio B ${s}`);
    await page.goto(`/jugadores/${propioId}/editar`);
    await page.locator('input[name="id"]').evaluate((el: HTMLInputElement, id) => (el.value = id), idJugadorA);
    await page.getByLabel("Nombre y apellidos").fill(`Hackeado ${s}`);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No se ha encontrado el jugador en tu escuela." })).toBeVisible();
    const { data: sinCambios } = await a.from("jugadores").select("nombre").eq("id", idJugadorA).single();
    expect(sinCambios!.nombre).toBe(`Secreto A ${s}`);

    // Añadir un escuela_id al formulario no sirve: la escuela sale de la sesión.
    await page.goto("/jugadores/nuevo");
    await page.locator("form").filter({ has: page.getByLabel("Nombre y apellidos") }).evaluate((form, escuela) => {
      const campo = document.createElement("input");
      campo.type = "hidden";
      campo.name = "escuela_id";
      campo.value = escuela;
      form.appendChild(campo);
    }, escuelaA!.id as string);
    await page.getByLabel("Nombre y apellidos").fill(`Colado ${s}`);
    await page.getByRole("button", { name: "Crear jugador" }).click();
    await expect(page).toHaveURL(URL_JUGADOR);
    expect((await a.from("jugadores").select("id").eq("nombre", `Colado ${s}`)).data).toEqual([]);
    const b = await clienteComo("DIRECTOR_B");
    const { data: escuelaB } = await b.from("escuelas").select("id").single();
    const colado = await b.from("jugadores").select("escuela_id").eq("nombre", `Colado ${s}`).single();
    expect(colado.data!.escuela_id).toBe(escuelaB!.id);
  });
});

test.describe("Demostración separada", () => {
  test("los datos reales y los ficticios no se mezclan", async ({ page }) => {
    const nombre = `Real No Demo ${unico()}`;
    await entrar(page, "DIRECTOR_A");
    await crearJugador(page, nombre);

    // Las pantallas reales no usan el almacenamiento de la demo.
    const demoGuardada = () => page.evaluate(() => window.localStorage.getItem("evora-padel-demo-v1"));
    expect(await demoGuardada()).toBeNull();
    await page.goto("/jugadores");
    await expect(visible(page, "Lucía Marván")).toHaveCount(0);

    // La demo muestra sus jugadores ficticios, no los reales, y lo indica.
    await page.goto("/demo/jugadores");
    await expect(visible(page, /Modo demostración/)).toBeVisible();
    await expect(visible(page, "Lucía Marván")).toBeVisible();
    await expect(visible(page, nombre)).toHaveCount(0);
    await expect(visible(page, /^Datos reales de tu escuela\.$/)).toHaveCount(0);

    // Las URL antiguas de la demo siguen funcionando.
    await page.goto("/objetivos");
    await expect(page).toHaveURL(/\/demo\/objetivos$/);
    await page.goto("/jugadores/j1");
    await expect(page).toHaveURL(/\/demo\/jugadores\/j1$/);
  });
});
