# Privacidad y protección de datos — piloto de ÉVORA PADEL

> **Importante.** Estos documentos son **borradores de trabajo**. Tenerlos no
> significa que el proyecto cumpla el RGPD ni la LOPDGDD. Antes de tratar datos
> reales de menores, la escuela debe completarlos, decidir las opciones marcadas
> y, en los puntos señalados, pedir **revisión jurídica**.

## Cómo leerlos

| Marca | Significado |
|---|---|
| **[COMPLETAR: …]** | Dato que solo conoce la escuela (nombre legal, contacto, plazos…). No se ha inventado. |
| **[ELEGIR: A / B / C]** | Decisión que debe tomar la escuela entre opciones propuestas. |
| **⚖️ Revisión jurídica** | Punto que debe validar una persona experta en protección de datos. |
| **🔧 Panel** | Comprobación que hay que hacer en el panel de Supabase o Vercel. |

## Documentos

| # | Documento | Para quién |
|---|---|---|
| 1 | [Información sobre el tratamiento](01-informacion-tratamiento.md) | Texto informativo general (cláusula del art. 13 RGPD). |
| 2 | [Información para familias](02-informacion-familias.md) | Familias de jugadores menores, en lenguaje claro. |
| 3 | [Plantilla de consentimiento](03-plantilla-consentimiento.md) | Solo si la base legal elegida es el consentimiento. |
| 4 | [Conservación y supresión](04-conservacion-y-supresion.md) | Plazos (a decidir) y procedimiento técnico de supresión. |
| 5 | [Inventario de datos](05-inventario-de-datos.md) | Qué datos se tratan, para qué, quién accede y dónde. |
| 6 | [Acciones pendientes: proveedores](06-acciones-pendientes-proveedores.md) | Supabase, Vercel, contratos, ubicaciones y configuración. |
| 7 | [Procedimiento de derechos](07-procedimiento-derechos.md) | Acceso, rectificación, supresión y otros derechos. |

## Antes de cargar datos reales de menores

1. Completar los campos **[COMPLETAR]** de los documentos 1, 2 y 5.
2. Elegir la base legal (documento 1, apartado 3) con revisión jurídica.
3. Decidir los plazos de conservación (documento 4).
4. Hacer las comprobaciones 🔧 del documento 6, en especial la **región** de
   Supabase y de Vercel, y los **contratos de encargado** (DPA).
5. Entregar la información a las familias (documento 2) y, si procede, recoger
   el consentimiento (documento 3).

Mientras tanto, para probar la app con los propios grupos se recomienda
**minimizar**:
- usar solo el nombre de pila o iniciales;
- dejar vacía la fecha de nacimiento;
- no escribir en las observaciones nada sobre salud, lesiones, familia ni
  terceros.

## Qué hace ya la aplicación (comprobado en el código y en pruebas locales)

- Solo entran usuarios creados a mano en Supabase. La app no tiene registro
  público y nadie puede darse permisos a sí mismo.
- Cada escuela solo ve sus datos (RLS en la base de datos, con pruebas
  automáticas de aislamiento).
- Los informes PDF se generan al pedirlos y **no se guardan** en ningún sitio.
  La respuesta se marca para que el navegador no la guarde en caché.
- No hay analítica, publicidad ni rastreadores. Las fuentes se sirven desde el
  propio dominio. La única cookie es la de sesión (estrictamente necesaria).
- Los errores del servidor se registran sin contenido de las evaluaciones.

Lo que **no** controla la app: los PDF una vez compartidos (WhatsApp, correo),
las copias de seguridad de Supabase y los registros técnicos de los proveedores
(ver documento 6).
