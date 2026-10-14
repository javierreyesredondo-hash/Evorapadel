import AxeBuilder from "@axe-core/playwright";
import type { Browser, Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "./fixtures";
import { clienteComo, configSupabaseLocal, credenciales, unico, type UsuarioPrueba } from "./credenciales";
import { enlaceInvitacion, generarToken, hashToken } from "../src/lib/invitaciones";

// Alta de escuelas e invitaciones privadas contra el Supabase LOCAL, con
// usuarios y escuelas SINTÉTICOS creados en cada prueba (nunca datos reales).
// El propietario local (ADMIN) se da de alta por SQL en scripts/supabase-local.mjs.

const BASE = "http://localhost:3100";
const visible = (page: Page, texto: string | RegExp) => page.getByText(texto).filter({ visible: true });
const aviso = (page: Page) => page.locator('[data-prueba="aviso-guardado"]');

async function entrar(page: Page, usuario: UsuarioPrueba | { email: string; contrasena: string }, siguiente?: string) {
  const { email, contrasena } = typeof usuario === "string" ? credenciales(usuario) : usuario;
  await page.goto(siguiente ? `/acceso?siguiente=${encodeURIComponent(siguiente)}` : "/acceso");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(contrasena);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/acceso"));
}

/** Cliente con la clave secreta LOCAL (solo para preparar cuentas de prueba). */
function servicio(): SupabaseClient {
  const { url } = configSupabaseLocal();
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!clave) throw new Error("Falta SUPABASE_SECRET_KEY local: arranca `npm run supabase:local`.");
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}

type Cuenta = { email: string; contrasena: string; sb: SupabaseClient };

/** Cuenta sintética nueva, sin escuela, con su sesión de API. */
async function cuentaNueva(prefijo = "cuenta"): Promise<Cuenta> {
  const email = `${prefijo}-${unico()}@evora.invalid`;
  const contrasena = `Prueba-${unico()}-segura`;
  const { error } = await servicio().auth.admin.createUser({ email, password: contrasena, email_confirm: true });
  expect(error).toBeNull();
  const { url, clave } = configSupabaseLocal();
  const sb = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  expect((await sb.auth.signInWithPassword({ email, password: contrasena })).error).toBeNull();
  return { email, contrasena, sb };
}

/** Escuela + invitación creadas por el propietario con la API (como hace el panel). */
async function escuelaConInvitacion(email: string, nombre = `Escuela Inv ${unico()}`) {
  const admin = await clienteComo("ADMIN");
  const token = generarToken();
  const { data, error } = await admin.rpc("admin_crear_escuela", { p_nombre: nombre, p_email: email, p_token_hash: await hashToken(token), p_dias: 7 });
  expect(error).toBeNull();
  return { admin, escuelaId: data as string, nombre, token, enlace: enlaceInvitacion(BASE, token) };
}

async function pestanaNueva(browser: Browser) {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 } });
  return { contexto, page: await contexto.newPage() };
}

/** Móvil: sin scroll horizontal y controles de al menos 44 × 44 px. */
async function comodaEnMovil(page: Page, contexto: string) {
  const r = await page.evaluate(() => {
    const pequenos: string[] = [];
    document.querySelectorAll<HTMLElement>("a, button, input, select, textarea").forEach((el) => {
      if (!el.checkVisibility()) return;
      const b = el.getBoundingClientRect();
      if (b.width && b.height && (b.width < 44 || b.height < 44)) pequenos.push(`${el.tagName} «${(el.innerText || el.id).slice(0, 30)}» ${Math.round(b.width)}×${Math.round(b.height)}`);
    });
    return { pequenos, desborda: document.documentElement.scrollWidth > window.innerWidth };
  });
  expect(r.desborda, `scroll horizontal en ${contexto}`).toBe(false);
  expect(r.pequenos, `controles pequeños en ${contexto}`).toEqual([]);
}

async function sinInfraccionesAxe(page: Page, contexto: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), `accesibilidad en ${contexto}`).toEqual([]);
}

test.describe("Panel del propietario e invitaciones", () => {
  test("el propietario crea una escuela; el director nuevo crea su cuenta con el enlace y entra en su escuela", async ({ page, browser }) => {
    test.setTimeout(90_000);
    const nombre = `Escuela Panel ${unico()}`;
    const email = `nueva-${unico()}@evora.invalid`;
    await entrar(page, "ADMIN");
    await expect(page.getByRole("heading", { name: "Panel de ÉVORA PADEL" })).toBeVisible();
    await page.getByRole("link", { name: "Ir al panel de escuelas" }).click();
    await expect(page.getByRole("heading", { name: "Escuelas", level: 1 })).toBeVisible();
    await sinInfraccionesAxe(page, "panel del propietario");
    await comodaEnMovil(page, "panel del propietario");

    await page.getByLabel("Nombre de la escuela").fill(nombre);
    await page.getByLabel("Correo del director/a").fill(email.toUpperCase());
    await page.getByRole("button", { name: "Crear escuela e invitación" }).click();
    await expect(page.getByRole("heading", { name: "Escuela creada" })).toBeVisible();
    const enlace = await page.getByLabel("Enlace de invitación").inputValue();
    expect(enlace).toMatch(/\/invitacion#[A-Za-z0-9_-]{43}$/);
    await expect(visible(page, /Solo se muestra ahora/)).toBeVisible();
    const fila = page.getByRole("listitem", { name: nombre });
    await expect(fila).toContainText(`${email} · Pendiente`);
    await expect(fila).toContainText("Activa");
    await comodaEnMovil(page, "panel con el enlace generado");
    await sinInfraccionesAxe(page, "panel con el enlace generado");
    // El enlace (token) no se guarda en la página ni en la lista.
    await page.reload();
    expect(await page.content()).not.toContain(enlace.split("#")[1]);

    // El director abre el enlace sin sesión: ve la escuela y su correo enmascarado.
    const { contexto, page: director } = await pestanaNueva(browser);
    await director.goto(enlace);
    await expect(director.getByText(`ÉVORA PADEL te invita a dirigir ${nombre}.`)).toBeVisible();
    await expect(director).toHaveURL(/\/invitacion$/); // el token se quita de la barra de direcciones
    await expect(director.getByText(/Correo invitado: n\*\*\*/)).toBeVisible();
    expect(await director.content()).not.toContain(email); // nunca el correo completo
    await sinInfraccionesAxe(director, "invitación sin sesión");
    await comodaEnMovil(director, "invitación sin sesión");
    await director.getByLabel("Contraseña nueva").fill("corta");
    await director.getByLabel("Repite la contraseña").fill("corta");
    await director.getByRole("button", { name: "Crear cuenta y aceptar" }).click();
    await expect(visible(director, /Al menos 10 caracteres/)).toBeVisible();
    await director.getByLabel("Contraseña nueva").fill("Una-contraseña-segura");
    await director.getByLabel("Repite la contraseña").fill("Una-contraseña-segura");
    await director.getByRole("button", { name: "Crear cuenta y aceptar" }).click();
    await expect(director.getByRole("region", { name: "Tu escuela" })).toContainText(nombre);
    await expect(director.getByRole("region", { name: "Tu escuela" })).toContainText("Director/a");
    await contexto.close();

    // El mismo enlace ya no sirve (un solo uso), ni con otra sesión.
    const { contexto: c2, page: otra } = await pestanaNueva(browser);
    await otra.goto(enlace);
    await expect(otra.getByText("Esta invitación ya se ha usado.")).toBeVisible();
    await c2.close();

    await page.reload();
    await expect(page.getByRole("listitem", { name: nombre })).toContainText("Aceptada");
    await expect(page.getByRole("listitem", { name: nombre })).toContainText("1 / 1");
  });

  test("cuenta existente (con otra escuela): inicia sesión desde el enlace y conserva sus dos escuelas; otro correo no puede aceptar", async ({ browser }) => {
    test.setTimeout(90_000);
    const u = await cuentaNueva("existente");
    const primera = await escuelaConInvitacion(u.email, `Academia Primera ${unico()}`);
    expect((await u.sb.rpc("aceptar_invitacion", { p_token_hash: await hashToken(primera.token) })).error).toBeNull();
    const segunda = await escuelaConInvitacion(u.email, `Academia Segunda ${unico()}`);

    // Otro usuario con sesión: no puede aceptarla.
    const intruso = await cuentaNueva("intruso");
    const { contexto: ci, page: pi } = await pestanaNueva(browser);
    await entrar(pi, intruso);
    await expect(pi.getByRole("heading", { name: "Tu cuenta no tiene escuela" })).toBeVisible();
    await pi.goto(segunda.enlace);
    await expect(visible(pi, /la invitación es para otro correo/)).toBeVisible();
    await expect(pi.getByRole("button", { name: "Aceptar invitación" })).toHaveCount(0);
    const { error } = await intruso.sb.rpc("aceptar_invitacion", { p_token_hash: await hashToken(segunda.token) });
    expect(error?.message).toContain("INVITACION_OTRO_CORREO");
    await ci.close();

    // El invitado: abre el enlace, «Ya tengo cuenta», inicia sesión y vuelve a la invitación.
    const { contexto, page } = await pestanaNueva(browser);
    await page.goto(segunda.enlace);
    await page.getByRole("link", { name: "Ya tengo cuenta: iniciar sesión" }).click();
    await page.getByLabel("Correo electrónico").fill(u.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(u.contrasena);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/invitacion$/);
    // Error de red al aceptar: mensaje claro y se puede reintentar.
    test.info().annotations.push({ type: "error-consola-esperado", description: "Failed to fetch" });
    let cortar = true;
    await page.route("**/invitacion", (r) => (r.request().method() === "POST" && cortar ? ((cortar = false), r.abort("failed")) : r.continue()));
    await page.getByRole("button", { name: "Aceptar invitación" }).click();
    await expect(visible(page, /No se ha podido conectar/)).toBeVisible();
    await page.getByRole("button", { name: "Aceptar invitación" }).click();
    await expect(page.getByRole("region", { name: "Tu escuela" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Tu escuela" })).toContainText("y 1 escuela más");
    await contexto.close();
    const { data: miembros } = await u.sb.from("membresias").select("rol, escuela_id");
    expect(miembros?.map((m) => m.rol)).toEqual(["director", "director"]);
  });

  test("aceptación concurrente y reintentos: una sola membresía; otro usuario a la vez, rechazado", async () => {
    const u = await cuentaNueva("concurrente");
    const otraSesion = createClient(configSupabaseLocal().url, configSupabaseLocal().clave, { auth: { persistSession: false } });
    await otraSesion.auth.signInWithPassword({ email: u.email, password: u.contrasena });
    const intruso = await cuentaNueva("concurrente-otro");
    const inv = await escuelaConInvitacion(u.email);
    const hash = await hashToken(inv.token);
    const [a, b, c] = await Promise.all([
      u.sb.rpc("aceptar_invitacion", { p_token_hash: hash }),
      otraSesion.rpc("aceptar_invitacion", { p_token_hash: hash }),
      intruso.sb.rpc("aceptar_invitacion", { p_token_hash: hash }),
    ]);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(a.data).toBe(inv.escuelaId);
    expect(b.data).toBe(inv.escuelaId);
    expect(c.error).not.toBeNull();
    const { data } = await u.sb.from("membresias").select("id").eq("escuela_id", inv.escuelaId);
    expect(data).toHaveLength(1);
    // Reintento más tarde: misma escuela, sin duplicar.
    expect((await u.sb.rpc("aceptar_invitacion", { p_token_hash: hash })).data).toBe(inv.escuelaId);
  });

  test("revocar y volver a invitar: el enlace anterior deja de servir", async ({ page, browser }) => {
    const u = await cuentaNueva("revocada");
    const inv = await escuelaConInvitacion(u.email);
    await entrar(page, "ADMIN");
    await page.goto("/admin");
    const fila = page.getByRole("listitem", { name: inv.nombre });
    page.once("dialog", (d) => void d.accept());
    await fila.getByRole("button", { name: "Revocar invitación" }).click();
    await expect(aviso(page)).toHaveText("Invitación revocada: el enlace ya no sirve.");
    await expect(fila).toContainText("Revocada");

    const { contexto, page: p } = await pestanaNueva(browser);
    await entrar(p, u);
    await p.goto(inv.enlace);
    await expect(visible(p, /ya no es válida/)).toBeVisible();

    // Volver a invitar: enlace nuevo que sí funciona.
    await fila.getByRole("button", { name: "Invitar director/a" }).click();
    await fila.getByRole("button", { name: "Generar invitación" }).click();
    const nuevo = await fila.getByLabel("Enlace de invitación").inputValue();
    expect(nuevo).not.toBe(inv.enlace);
    await p.goto(nuevo);
    await p.reload(); // nueva carga con el token nuevo
    await p.getByRole("button", { name: "Aceptar invitación" }).click();
    await expect(p.getByRole("region", { name: "Tu escuela" })).toContainText(inv.nombre);
    await contexto.close();
  });

  test("el panel global no existe para directores ni entrenadores", async ({ page }) => {
    for (const usuario of ["DIRECTOR_A", "ENTRENADOR_A"] as const) {
      await entrar(page, usuario);
      await expect(page.getByRole("region", { name: "Tu escuela" })).toBeVisible();
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Crear escuela e invitación" })).toHaveCount(0);
      const sb = await clienteComo(usuario);
      expect((await sb.rpc("admin_listar_escuelas")).error?.code).toBe("42501");
      expect((await sb.rpc("soy_administrador")).data).toBe(false);
      expect((await sb.rpc("admin_cambiar_estado_escuela", { p_escuela: crypto.randomUUID(), p_estado: "suspendida" })).error?.code).toBe("42501");
      await page.context().clearCookies();
    }
  });

  test("suspender bloquea el acceso sin borrar datos; reactivar lo devuelve todo", async ({ page, browser }) => {
    test.setTimeout(90_000);
    const u = await cuentaNueva("suspendida");
    const inv = await escuelaConInvitacion(u.email);
    expect((await u.sb.rpc("aceptar_invitacion", { p_token_hash: await hashToken(inv.token) })).error).toBeNull();
    const j = await u.sb.from("jugadores").insert({ escuela_id: inv.escuelaId, nombre: `Jugador Susp ${unico()}` }).select("id").single();
    expect(j.error).toBeNull();

    await entrar(page, "ADMIN");
    await page.goto("/admin");
    const fila = page.getByRole("listitem", { name: inv.nombre });
    page.once("dialog", (d) => void d.accept());
    await fila.getByRole("button", { name: "Suspender acceso" }).click();
    await expect(aviso(page)).toHaveText("Escuela suspendida. Sus datos se conservan.");
    await expect(fila).toContainText("Suspendida");

    const { contexto, page: d } = await pestanaNueva(browser);
    await entrar(d, u);
    await expect(d.getByRole("heading", { name: "Acceso suspendido" })).toBeVisible();
    await expect(visible(d, /se conservan íntegros/)).toBeVisible();
    await d.goto("/jugadores");
    await expect(d.getByRole("heading", { name: "Acceso suspendido" })).toBeVisible();
    expect((await u.sb.from("jugadores").select("id")).data).toEqual([]);
    expect((await u.sb.from("jugadores").insert({ escuela_id: inv.escuelaId, nombre: "No" })).error).not.toBeNull();
    // El propietario conserva el panel.
    expect((await inv.admin.rpc("admin_listar_escuelas")).error).toBeNull();

    page.once("dialog", (x) => void x.accept());
    await fila.getByRole("button", { name: "Reactivar acceso" }).click();
    await expect(aviso(page)).toHaveText("Escuela reactivada.");
    expect((await u.sb.from("jugadores").select("id")).data).toEqual([{ id: j.data!.id }]);
    await d.goto("/jugadores");
    await expect(d.getByRole("region", { name: "Tu escuela" })).toContainText(inv.nombre);
    await contexto.close();
  });

  test("ningún secreto en las respuestas: ni token ni hash en el panel; enlace roto y sin token", async ({ page, browser }) => {
    const admin = await clienteComo("ADMIN");
    const { data } = await admin.rpc("admin_listar_escuelas");
    for (const fila of (data ?? []) as Record<string, unknown>[]) {
      expect(Object.keys(fila)).not.toContain("token_hash");
      expect(JSON.stringify(fila)).not.toMatch(/[0-9a-f]{64}/);
    }
    const { contexto, page: p } = await pestanaNueva(browser);
    await p.goto("/invitacion");
    await expect(visible(p, /Abre el enlace completo/)).toBeVisible();
    await p.goto(`/invitacion#${"x".repeat(43)}`);
    await p.reload();
    await expect(p.getByRole("heading", { name: "Invitación no disponible" })).toBeVisible();
    await expect(visible(p, /no es válido/)).toBeVisible();
    await contexto.close();
    void page;
  });
});
