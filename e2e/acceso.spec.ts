import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { credenciales, type UsuarioPrueba } from "./credenciales";

// Inicio de sesión real contra el Supabase LOCAL (GoTrue + PostgREST + RLS),
// con usuarios y escuelas sintéticos creados por scripts/supabase-local.mjs.

async function entrar(page: Page, usuario: UsuarioPrueba, ruta = "/acceso") {
  const { email, contrasena } = credenciales(usuario);
  await page.goto(ruta);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(contrasena);
  await page.getByRole("button", { name: "Entrar" }).click();
}

const barraEscuela = (page: Page) => page.getByRole("region", { name: "Tu escuela" });

test.describe("Sin sesión", () => {
  test("las pantallas privadas redirigen a /acceso conservando el destino", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/acceso$/);
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();

    for (const ruta of ["/jugadores", "/grupos", "/evaluaciones/nueva?tipo=completa", "/metodologia", "/entrenamiento"]) {
      await page.goto(ruta);
      await expect(page).toHaveURL(new RegExp(`/acceso\\?siguiente=${encodeURIComponent(ruta).replace(/[?.]/g, "\\$&")}$`));
    }
  });

  test("sin sesión no se revela si una ficha existe (también redirige)", async ({ page }) => {
    const respuesta = await page.goto("/jugadores/no-existe");
    expect(respuesta?.status()).toBe(200);
    await expect(page).toHaveURL(/\/acceso\?siguiente=/);
  });

  test("ningún contenido privado llega al navegador sin sesión", async ({ request }) => {
    const r = await request.get("/jugadores", { maxRedirects: 0 });
    expect(r.status()).toBe(307);
    expect(r.headers()["location"]).toMatch(/^\/acceso\?siguiente=%2Fjugadores$/);
    expect(await r.text()).not.toContain("Escuela Demo A");
  });
});

test.describe("Formulario de acceso", () => {
  test("valida en español antes de llamar a Supabase", async ({ page }) => {
    await page.goto("/acceso");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Escribe tu correo electrónico.")).toBeVisible();
    await expect(page.getByText("Escribe tu contraseña.")).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel("Correo electrónico").fill("no-es-un-correo");
    await page.getByLabel("Contraseña").fill("x");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Escribe un correo electrónico válido.")).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toHaveValue("no-es-un-correo");
  });

  test("credenciales incorrectas: mismo mensaje exista o no la cuenta", async ({ page }) => {
    const { email } = credenciales("DIRECTOR_A");
    await page.goto("/acceso");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill("contraseña-equivocada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Correo o contraseña incorrectos." })).toBeVisible();
    await expect(page).toHaveURL(/\/acceso$/);

    await page.getByLabel("Correo electrónico").fill("nadie@evora.invalid");
    await page.getByLabel("Contraseña").fill("lo-que-sea");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Correo o contraseña incorrectos." })).toBeVisible();
  });
});

test.describe("Con sesión: escuela y rol desde la base de datos (RLS)", () => {
  test("director de A: ve su escuela y rol, y nada de la escuela B", async ({ page }) => {
    await entrar(page, "DIRECTOR_A");
    await expect(page).toHaveURL(/\/$/);
    await expect(barraEscuela(page)).toContainText("Escuela Demo A");
    await expect(barraEscuela(page)).toContainText("Director/a");
    await expect(page.getByText("Escuela Demo B")).toHaveCount(0);
    // Solo funciones reales: no hay apartado de demostración.
    await expect(page.getByRole("link", { name: "Demo", exact: true })).toHaveCount(0);
  });

  test("entrenador de A: rol entrenador", async ({ page }) => {
    await entrar(page, "ENTRENADOR_A");
    await expect(barraEscuela(page)).toContainText("Escuela Demo A");
    await expect(barraEscuela(page)).toContainText("Entrenador/a");
  });

  test("director de B: solo su escuela", async ({ page }) => {
    await entrar(page, "DIRECTOR_B");
    await expect(barraEscuela(page)).toContainText("Escuela Demo B");
    await expect(page.getByText("Escuela Demo A")).toHaveCount(0);
  });

  test("usuario sin escuela: no entra a la app y se le explica", async ({ page }) => {
    await entrar(page, "SIN_ESCUELA");
    await expect(page.getByRole("heading", { name: "Tu cuenta no tiene escuela" })).toBeVisible();
    await expect(barraEscuela(page)).toHaveCount(0);
  });

  test("tras entrar vuelve a la página pedida", async ({ page }) => {
    await page.goto("/grupos");
    await expect(page).toHaveURL(/siguiente=/);
    const { email, contrasena } = credenciales("DIRECTOR_A");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(contrasena);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/grupos$/);
    await expect(page.getByRole("heading", { level: 1, name: "Grupos" })).toBeVisible();
  });

  test("no hay redirección abierta a otros dominios", async ({ page }) => {
    await entrar(page, "DIRECTOR_A", "/acceso?siguiente=//evil.example/robar");
    await expect(page).toHaveURL("http://localhost:3100/");
    await expect(barraEscuela(page)).toBeVisible();
  });

  test("con sesión, /acceso lleva a la app; al cerrar sesión se pierde el acceso", async ({ page }) => {
    await entrar(page, "DIRECTOR_A");
    await expect(barraEscuela(page)).toBeVisible();
    await page.goto("/acceso");
    await expect(page).toHaveURL(/\/$/);

    await barraEscuela(page).getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/acceso$/);
    await page.goto("/jugadores");
    await expect(page).toHaveURL(/\/acceso\?siguiente=%2Fjugadores$/);
  });

  test("las cookies de sesión son de Supabase y no contienen la contraseña", async ({ page, context }) => {
    await entrar(page, "DIRECTOR_A");
    await expect(barraEscuela(page)).toBeVisible();
    const cookies = await context.cookies();
    const sesion = cookies.filter((c) => /^sb-.*-auth-token/.test(c.name));
    expect(sesion.length).toBeGreaterThan(0);
    for (const c of sesion) {
      expect(c.sameSite).toBe("Lax");
      expect(c.value).not.toContain(credenciales("DIRECTOR_A").contrasena);
    }
  });
});

test("cerrar sesión solo acepta POST desde la propia app", async ({ request }) => {
  const ajeno = await request.post("/salir", { headers: { origin: "https://evil.example" }, maxRedirects: 0 });
  expect(ajeno.status()).toBe(403);
  const propio = await request.post("/salir", { headers: { origin: "http://localhost:3100" }, maxRedirects: 0 });
  expect(propio.status()).toBe(303);
  expect(propio.headers()["location"]).toMatch(/\/acceso$/);
  expect((await request.get("/salir", { maxRedirects: 0 })).status()).toBe(405);
});

test.describe("Claves", () => {
  test("el JavaScript enviado al navegador no contiene claves secretas", async ({ page }) => {
    const scripts: string[] = [];
    page.on("response", async (r) => {
      if (r.request().resourceType() === "script") scripts.push(await r.text());
    });
    await page.goto("/acceso");
    await page.waitForLoadState("networkidle");
    expect(scripts.length).toBeGreaterThan(0);
    for (const codigo of scripts) {
      expect(codigo).not.toMatch(/service_role|sb_secret_|SERVICE_ROLE/);
    }
  });
});
