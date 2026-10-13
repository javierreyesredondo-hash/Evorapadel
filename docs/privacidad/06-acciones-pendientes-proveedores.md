# 6. Acciones pendientes en Supabase, Vercel y cuentas

> Ninguna de estas acciones se ha hecho desde el entorno de desarrollo: no tiene
> acceso a los paneles ni a producción. Cada punto indica **dónde** mirar y
> **qué anotar**. Los nombres de los menús pueden variar ligeramente con las
> actualizaciones de cada panel.
>
> Proyecto de Supabase: `idzkjzpgijzwmtpumcwk`.

## A. Supabase (base de datos y cuentas)

| # | Acción | Dónde | Resultado esperado / qué anotar |
|---|---|---|---|
| A1 | **Desactivar el registro público** | *Authentication → Sign In / Providers* → «Allow new users to sign up» (en versiones anteriores: *Authentication → Providers → Email*) | **Desactivado.** La app no tiene registro, pero con la clave pública se podría llamar a la API de registro. |
| A2 | Comprobar que no hay cuentas ajenas | *Authentication → Users* | Solo la cuenta del director. También se puede ejecutar la consulta 5 de «Verificación de solo lectura» de `supabase/README.md`: 0 usuarios sin escuela. |
| A3 | **Región** del proyecto | *Project Settings → General* (o *Infrastructure*) | Anotar la región (por ejemplo, Frankfurt / `eu-central-1`) en los documentos 1 y 5. |
| A4 | **Contrato de encargado (DPA)** | Web de Supabase, sección legal (*DPA*), y los ajustes de la organización | Formalizarlo según el plan contratado. Revisar la lista de subencargados y las garantías de transferencia. ⚖️ |
| A5 | **Copias de seguridad** | *Database → Backups* | Anotar el plan, la frecuencia y la **retención** (documento 4, apartado 4). |
| A6 | Retención de **registros** (API, Auth) | *Logs* / ajustes del plan | Anotar cuánto tiempo se guardan; pueden contener IP y URL. |
| A7 | Política de **contraseñas** | *Authentication → Sign In / Providers → Email* (o *Policies*) | Longitud mínima recomendable de 10 o más caracteres; activar la protección contra contraseñas filtradas si el plan la ofrece. |
| A8 | **URL del sitio** | *Authentication → URL Configuration* | *Site URL* = dominio de producción; en *Redirect URLs*, solo dominios propios. |
| A9 | **Security Advisor** | *Advisors → Security Advisor* | Sin avisos de RLS desactivado ni de funciones sin `search_path`. |
| A10 | Verificación del esquema | *SQL Editor*: consultas de solo lectura de `supabase/README.md` | 10 tablas, 28 políticas y DELETE solo en las 5 tablas previstas. |
| A11 | **2FA** en la cuenta de Supabase | Ajustes de la cuenta | Activado: quien entra en el panel ve todos los datos. |

Comprobación opcional de A1 por un técnico (solo lectura):
`GET https://idzkjzpgijzwmtpumcwk.supabase.co/auth/v1/settings` con la cabecera
`apikey: <clave pública>`. La respuesta debe incluir `"disable_signup": true`.

## B. Vercel (alojamiento)

| # | Acción | Dónde | Resultado esperado / qué anotar |
|---|---|---|---|
| B1 | **Región de las funciones** | *Project → Settings → Functions → Function Region* | Anotar la región. Si es de EE. UU. (Vercel suele usar Washington, `iad1`, por defecto), valorar elegir una de la UE cercana a la de Supabase (A3) y volver a desplegar. ⚖️ Decisión de la escuela. |
| B2 | **Variables de entorno por entorno** | *Settings → Environment Variables* | Ver si `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` aplican también a *Preview*. Si es así, las vistas previas de cada rama usan la base de datos real. Opciones: limitarlas a *Production* o no usar las vistas previas con datos reales. |
| B3 | **Protección de las vistas previas** | *Settings → Deployment Protection* | «Vercel Authentication» activada para las vistas previas. |
| B4 | **Contrato de encargado (DPA)** | Web de Vercel, sección legal (*DPA*) | Formalizarlo según el plan. ⚖️ |
| B5 | Retención de **registros** | *Observability / Logs* | Anotar la retención. La app registra solo el tipo de error, nunca el contenido de las evaluaciones. |
| B6 | Analítica desactivada | *Analytics* / *Speed Insights* | Desactivadas. El código no las incluye; si se activaran, habría que actualizar el inventario. |
| B7 | **2FA** en la cuenta de Vercel | Ajustes de la cuenta | Activado. |

## C. GitHub y dispositivos

| # | Acción | Detalle |
|---|---|---|
| C1 | Visibilidad del repositorio | Hoy es **público**. No contiene datos personales ni claves (revisado), pero muestra el esquema. Valorar hacerlo privado en *Settings → General → Danger Zone*. |
| C2 | 2FA en GitHub | Activado: quien puede fusionar en main despliega en producción. |
| C3 | Móvil del entrenador | Bloqueo de pantalla. Borrar los PDF descargados una vez enviados. Comprobar el destinatario antes de compartir. |

## D. Antes de cargar datos reales de menores

- [ ] A1 a A11 y B1 a B7 revisados, con las respuestas anotadas en los
  documentos 1, 4 y 5.
- [ ] Base legal elegida (documento 1) con revisión jurídica.
- [ ] Plazos de conservación decididos (documento 4).
- [ ] Información entregada a las familias (documento 2) y, si procede,
  consentimientos recogidos (documento 3).
