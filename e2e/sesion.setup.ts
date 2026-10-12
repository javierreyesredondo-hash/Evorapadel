import { expect, test as setup } from "@playwright/test";
import { SESION_DIRECTOR_A } from "../playwright.config";
import { credenciales } from "./credenciales";

setup("iniciar sesión como director de la Escuela Demo A", async ({ page }) => {
  const { email, contrasena } = credenciales("DIRECTOR_A");
  await page.goto("/acceso");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(contrasena);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("region", { name: "Tu escuela" })).toContainText("Escuela Demo A");
  await page.context().storageState({ path: SESION_DIRECTOR_A });
});
