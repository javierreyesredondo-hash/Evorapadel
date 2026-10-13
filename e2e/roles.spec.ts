import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { clienteComo, credenciales, unico, type UsuarioPrueba } from "./credenciales";

// Una misma persona puede dirigir y entrenar: una cuenta, una sesión, una
// membresía (rol director). Entrenar = tener grupos asignados y evaluar.
// Datos sintéticos contra el Supabase local; nombres únicos (pruebas en paralelo).

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
const funciones = (page: Page) => page.locator('[data-prueba="funciones"]').filter({ visible: true });

test("el director entrena con su misma cuenta y sesión, sin perder la dirección", async ({ page }) => {
  const s = unico();
  const b = await clienteComo("DIRECTOR_B");
  const { data: esc } = await b.from("escuelas").select("id").single();
  const jugador = `Pupilo ${s}`;
  await b.from("jugadores").insert({ escuela_id: esc!.id, nombre: jugador });
  const grupo = `Grupo que entreno ${s}`;

  await entrar(page, "DIRECTOR_B");
  // Dirección: crea el grupo y se asigna a sí mismo como entrenador.
  await page.goto("/grupos/nuevo");
  await page.getByLabel("Nombre del grupo").fill(grupo);
  const yo = page.getByLabel("Entrenador/a responsable").locator("option", { hasText: "· tú" });
  await page.getByLabel("Entrenador/a responsable").selectOption(await yo.getAttribute("value"));
  await page.getByRole("button", { name: "Crear grupo" }).click();
  await expect(aviso(page)).toHaveText("Grupo creado.");
  await expect(visible(page, /· tú$/)).toBeVisible();
  await page.getByLabel("Añadir jugador al grupo").selectOption({ label: jugador });
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(aviso(page)).toHaveText("Jugador añadido al grupo.");

  // Entrenamiento: sin cerrar sesión ni cambiar de cuenta.
  const nav = page.getByRole("navigation", { name: "Principal" });
  await nav.getByRole("link", { name: "Entrenar" }).click();
  await expect(page).toHaveURL(/\/entrenamiento$/);
  await expect(nav.getByRole("link", { name: "Entrenar" })).toHaveAttribute("aria-current", "page");
  await expect(funciones(page)).toHaveText(/^Dirección y entrenamiento · entrena \d+ grupos?$/);
  const tarjeta = page.getByRole("region", { name: `Grupo ${grupo}` });
  await expect(tarjeta).toContainText(jugador);
  await tarjeta.getByRole("link", { name: `Evaluar a ${jugador}` }).click();
  await expect(page).toHaveURL(/\/evaluaciones\/nueva\?jugador=/);
  await page.getByRole("radio", { name: /^Golpes de fondo: 4 / }).check();
  await page.getByRole("button", { name: "Guardar evaluación" }).click();
  await expect(page).toHaveURL(/\/evaluaciones\/[0-9a-f-]{36}$/);
  await expect(aviso(page)).toHaveText("Evaluación guardada.");
  await expect(visible(page, grupo).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar" })).toBeVisible(); // es el autor
  await nav.getByRole("link", { name: "Entrenar" }).click();
  await expect(page.getByRole("list", { name: "Tus evaluaciones" })).toContainText(jugador);

  // La dirección sigue intacta en la misma sesión.
  await expect(page.getByRole("region", { name: "Tu escuela" })).toContainText("Director/a");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Entrenamiento" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dirección" })).toBeVisible();
  await expect(funciones(page)).toHaveText(/^Dirección y entrenamiento · entrena \d+ grupos?$/);
  await page.goto("/metodologia");
  await expect(page.getByRole("button", { name: "Añadir competencia" })).toBeVisible();
  await page.goto("/grupos");
  await page.getByRole("link", { name: new RegExp(grupo) }).click();
  await page.getByRole("link", { name: "Editar grupo" }).click();
  await page.getByLabel("Nombre del grupo").fill(`${grupo} (renombrado)`);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(aviso(page)).toHaveText("Cambios guardados.");

  // Un solo usuario y una sola membresía: nada duplicado.
  const { data: yoB } = await b.auth.getUser();
  const { data: membresias } = await b.from("membresias").select("rol").eq("usuario_id", yoB.user!.id);
  expect(membresias).toEqual([{ rol: "director" }]);
});

test("un entrenador ve solo sus grupos en Mi entrenamiento y no tiene la sección de dirección", async ({ page }) => {
  const s = unico();
  const a = await clienteComo("DIRECTOR_A");
  const { data: esc } = await a.from("escuelas").select("id").single();
  const { data: entrenador } = await a.from("membresias").select("usuario_id").eq("rol", "entrenador").single();
  await a.from("grupos").insert([
    { escuela_id: esc!.id, nombre: `Suyo ${s}`, entrenador_id: entrenador!.usuario_id },
    { escuela_id: esc!.id, nombre: `Ajeno ${s}` },
  ]);

  await entrar(page, "ENTRENADOR_A");
  await page.goto("/entrenamiento");
  await expect(funciones(page)).toHaveText(/^Entrenamiento · \d+ grupos?$/);
  await expect(page.getByRole("region", { name: `Grupo Suyo ${s}` })).toBeVisible();
  await expect(page.getByRole("region", { name: `Grupo Ajeno ${s}` })).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Entrenamiento" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dirección" })).toHaveCount(0);
  // Ocultar el botón no basta: el servidor también lo impide.
  await page.goto("/grupos/nuevo");
  await expect(visible(page, "Solo la dirección de la escuela puede crear o editar grupos.")).toBeVisible();
});
