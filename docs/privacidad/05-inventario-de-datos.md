# 5. Inventario de datos tratados

> Elaborado a partir del esquema real de la base de datos (`supabase/migrations/`)
> y del código. Puede servir de base para el registro de actividades de
> tratamiento (art. 30 RGPD). ⚖️ Confirmar si la escuela está obligada a
> llevarlo y su formato.

## 1. Datos guardados por la aplicación (Supabase · PostgreSQL)

| Tabla | Datos | ¿Personales? | Finalidad | Obligatorio |
|---|---|---|---|---|
| `jugadores` | nombre; fecha de nacimiento; mano dominante; nivel; posición; foco de trabajo (≤ 200 caracteres); activo/archivado; fechas de alta y modificación | **Sí, a menudo de menores** | Identificar al jugador y adaptar su seguimiento | Solo el nombre |
| `grupos`, `grupo_jugadores` | nombre del grupo; entrenador responsable; qué jugadores lo forman | Sí (pertenencia a un grupo) | Organizar los entrenamientos | — |
| `evaluaciones` | fecha; tipo (rápida/completa); título; fortalezas (≤ 1.500); áreas de mejora (≤ 1.500); observaciones (≤ 3.000); autor; grupo | **Sí: valoraciones sobre el jugador** | Seguimiento deportivo e informes | Fecha y tipo |
| `evaluacion_puntuaciones` | nota de 1 a 5 por competencia | Sí | Seguimiento deportivo | Al menos una |
| `evaluacion_objetivos` | hasta 5 objetivos con plazo | Sí | Seguimiento deportivo | — |
| `competencias` | metodología de la escuela (nombres de criterios) | No | Definir qué se evalúa | — |
| `escuelas` | nombre de la escuela | No (persona jurídica) | Separar los datos de cada escuela | — |
| `perfiles`, `membresias` | nombre visible; escuela y rol (director/entrenador) | Sí (personal de la escuela) | Control de acceso; autor de los informes | — |

**Texto libre (riesgo principal).** Fortalezas, mejoras, observaciones, foco y
objetivos son campos abiertos:
- no deben contener datos de salud, familiares ni de terceros;
- deben redactarse de forma objetiva y respetuosa, porque la familia puede
  pedir verlos (derecho de acceso).

## 2. Datos de las cuentas (Supabase Auth)

- **Qué se guarda:**
  - correo electrónico;
  - contraseña (guardada cifrada, con hash, por Supabase);
  - fechas de alta y último acceso;
  - registros de auditoría de acceso, que pueden incluir la dirección IP. 🔧
    Ver su retención en el documento 6.
- **De quién:** solo de la dirección y los entrenadores. Los jugadores y las
  familias **no** tienen cuenta.

## 3. Datos que la aplicación no guarda

- **Informes PDF:** se generan al pedirlos con los datos guardados. No se
  almacenan en el servidor ni en ningún bucket. La respuesta lleva
  `Cache-Control: private, no-store`.
- **Almacenamiento del navegador:** no hay analítica, ni píxeles, ni
  publicidad, ni datos en `localStorage`.
- **Cookies:** la única cookie es la de sesión de Supabase, estrictamente
  necesaria para iniciar sesión. ⚖️ Confirmar que no hace falta aviso de
  cookies.
- **Fuentes tipográficas:** se sirven desde el propio dominio; el navegador no
  contacta con terceros.

## 4. Quién accede

| Quién | Cómo | Alcance |
|---|---|---|
| Dirección | App con su cuenta | Todos los datos de su escuela; gestiona grupos y metodología |
| Entrenadores (no hay en el piloto) | App con su cuenta | Hoy, todos los jugadores y evaluaciones de su escuela. [ELEGIR: restringir a sus grupos en el futuro] |
| Otras escuelas | — | **Ninguno** (RLS, con pruebas automáticas de aislamiento) |
| Administración técnica | Panel de Supabase / *SQL Editor* | Acceso total a la base de datos. [COMPLETAR: quién tiene acceso al panel] |
| Familias | PDF que reciben | Solo el informe de su hijo o hija |

## 5. Dónde y con quién (proveedores)

| Proveedor | Para qué | Qué datos pasan por él | Ubicación | Contrato (DPA) |
|---|---|---|---|---|
| Supabase | Base de datos y cuentas | Todos los anteriores | [COMPLETAR 🔧: región del proyecto] | [COMPLETAR 🔧] |
| Vercel | Alojamiento y ejecución de la app | Los datos en tránsito al mostrar páginas y generar PDF (no los guarda la app); registros de peticiones | [COMPLETAR 🔧: región de las funciones] | [COMPLETAR 🔧] |
| GitHub | Código fuente | **Ninguno** (el repositorio no contiene datos personales) | — | — |
| WhatsApp / correo | Canal elegido por quien comparte el PDF | El informe, una vez enviado | Fuera del control de la app | ⚖️ Ver documento 2 |

## 6. Medidas de seguridad existentes (resumen)

- Acceso solo con cuenta creada por la escuela; no hay registro público en la
  app.
- Sesión validada en el servidor.
- La escuela y el rol salen de la base de datos, no del navegador.
- RLS y claves compuestas impiden mezclar escuelas.
- Las funciones privilegiadas no están expuestas por la API.
- Pruebas automáticas de aislamiento y de mutaciones de seguridad (CI en GitHub).
- Cabeceras de seguridad: no se puede incrustar la app en otras webs y la URL
  completa no se envía a otros sitios.
- HTTPS en todo el tráfico.
