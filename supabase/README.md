# Base de datos (Supabase) — ÉVORA PADEL

> **Estado (13/10/2026):** las migraciones **1, 2 y 3 se aplicaron a mano** (SQL
> Editor) en el proyecto de producción `idzkjzpgijzwmtpumcwk`, y la app desplegada
> en Vercel se conecta a él. Lo comprobó la escuela en el panel: existen las 10
> tablas, `public.guardar_evaluacion` con `EXECUTE` para `authenticated` y RLS
> activada en las 4 tablas de evaluaciones. **Sin verificar todavía en
> producción**: el número exacto de políticas y permisos, que el registro público
> esté desactivado y un guardado real de evaluación con su PDF (ver
> «Verificación de solo lectura del proyecto»).
>
> ⚠️ **No ejecutar `supabase db push`** contra este proyecto: como las migraciones
> se aplicaron a mano, la CLI no tiene su historial e intentaría ejecutarlas otra
> vez. Ver «Migraciones aplicadas a mano y CLI de Supabase».

## Contenido

| Ruta | Qué es |
|---|---|
| `migrations/20261012190000_fundacion_escuelas.sql` | Migración 1: escuelas, perfiles, membresías, jugadores, grupos, RLS y permisos. |
| `migrations/20261013090000_alta_primera_escuela.sql` | Migración 2: perfiles para usuarios registrados antes de migrar y alta segura de una escuela con su director. |
| `migrations/20261014090000_evaluaciones.sql` | Migración 3: metodología (competencias), evaluaciones, puntuaciones 1–5, objetivos con plazo, RLS y guardado atómico `guardar_evaluacion`. |
| `tests/00_entorno_local.sql` | Simulación de Supabase para pruebas **locales** (roles, `auth`, `postgres` no superusuario). **Nunca** ejecutarlo en Supabase. |
| `tests/05_antes_de_migrar.sql` | Prueba: un usuario se registra en Auth **antes** de aplicar las migraciones. |
| `tests/10_aislamiento.sql` | 98 comprobaciones de aislamiento entre escuelas, permisos, estructura y alta de escuelas. |
| `tests/20_evaluaciones.sql` | 75 comprobaciones de la migración 3: permisos por rol, aislamiento, validaciones, manipulación de identificadores, duplicados y borrados. |
| `../scripts/probar-migracion.sh` | PostgreSQL local desechable: aplica la migración como `postgres` y ejecuta las pruebas (`npm run test:db`). |
| `../scripts/probar-migracion-supabase.sh` | Lo mismo sobre la **imagen oficial** `supabase/postgres` en Docker (`npm run test:db:supabase`). |
| `../scripts/probar-mutaciones.mjs` | Introduce 34 fallos de seguridad, uno a uno, y exige que las pruebas los detecten (`npm run test:db:mutaciones`). |

## Modelo

```
auth.users ──1:1── perfiles ──< membresias >── escuelas
                                 (rol: director | entrenador)
escuelas ──< jugadores ──< grupo_jugadores >── grupos >── escuelas
                                               └─ entrenador_id → membresía de la MISMA escuela
```

- Todas las tablas de datos llevan `escuela_id`. Las relaciones usan **claves
  foráneas compuestas** `(escuela_id, id)`: la base de datos rechaza, por
  ejemplo, meter en un grupo de la escuela A a un jugador de la escuela B,
  aunque una política estuviera mal.
- `perfiles` no guarda email ni datos sensibles (viven en `auth.users`). Se crea
  vacío con un trigger cuando alguien se registra.
- `jugadores` guarda solo lo necesario para la metodología (sin contacto). Puede
  haber **menores**: antes de cargar datos reales hay que cerrar la base legal y
  el consentimiento (RGPD).

## Permisos

`anon` no tiene ningún permiso. `authenticated` solo tiene lo siguiente (y RLS
filtra por escuela en todo):

| Tabla | Leer | Crear | Editar | Borrar |
|---|---|---|---|---|
| `escuelas` | miembros | — | director (solo `nombre`) | — |
| `perfiles` | uno mismo y compañeros de escuela | (trigger) | uno mismo (solo `nombre_visible`) | — |
| `membresias` | miembros de esa escuela | — | — | — |
| `jugadores` | miembros | director, entrenador | director, entrenador | director |
| `grupos` | miembros | director | director | director |
| `grupo_jugadores` | miembros | director, entrenador | — | director, entrenador |

- **Nadie es administrador por defecto.** Desde la app no se pueden crear
  escuelas ni membresías: solo `service_role` (servidor o SQL Editor). Un flujo
  de invitaciones irá en una migración posterior, con su propia revisión.
- `id`, `escuela_id`, `created_at`, `updated_at` y `creado_por` no son editables
  por clientes (permisos por columna). Un trigger impide además cambiar de escuela un registro.
- Las funciones auxiliares de RLS son `SECURITY DEFINER` con `search_path` vacío
  y viven en el esquema `privado`, que la API de Supabase no expone.

## Cómo revisarla

1. Leer la migración de arriba abajo; cada bloque está comentado.
2. Ejecutar las pruebas (ninguna toca un proyecto de Supabase):

   ```bash
   npm run test:db              # PostgreSQL 15+ local (initdb, pg_ctl, psql)
   npm run test:db:supabase     # imagen oficial supabase/postgres (Docker)
   IMAGEN=supabase/postgres:17.11.0.004 npm run test:db:supabase
   npm run test:db:mutaciones   # ¿detectan las pruebas fallos reales?
   ```

   Si `pg_config` no está en el `PATH`: `PG_BIN=/ruta/a/postgresql/bin npm run test:db`.
3. Comprobar que las pruebas cubren lo que te preocupa; si falta algo, añadirlo
   en `tests/10_aislamiento.sql` (y una mutación que lo rompa en
   `scripts/probar-mutaciones.mjs`) antes de aplicar nada.

### Verificación realizada (local, migraciones 1–3)

Todo en PostgreSQL **local y desechable**; ninguna prueba toca Supabase alojado.

| Entorno | Resultado |
|---|---|
| PostgreSQL 16 local con simulación de Supabase (`npm run test:db`, también en CI) | 98 + 75 = 173/173 |
| `supabase/postgres:17.11.0.004` y `15.19.0.004` (Docker, `npm run test:db:supabase`) | 98 + 75 (fase de evaluaciones) |
| Mutaciones de seguridad (`npm run test:db:mutaciones`, también en CI) | 34/34 detectadas |
| Linter oficial de Supabase ([splinter](https://github.com/supabase/splinter), el del *Security Advisor*) sobre 15.19, migraciones 1 y 2 | Sin avisos de seguridad; solo `unused_index` (base vacía) |

## Migraciones aplicadas a mano y CLI de Supabase

Las migraciones 1, 2 y 3 ya están aplicadas en producción (a mano, en el *SQL
Editor*). **No se vuelven a ejecutar** ni se regeneran.

- La tabla de historial de la CLI (`supabase_migrations.schema_migrations`) no
  las tiene registradas. Por eso **`supabase db push` intentaría aplicarlas otra
  vez** y fallaría a mitad (los objetos ya existen) o, peor, aplicaría parte.
- Antes de usar la CLI con este proyecto hay que **reconciliar el historial**, una
  sola vez y como decisión expresa (escribe en esa tabla de producción):

  ```bash
  supabase link --project-ref idzkjzpgijzwmtpumcwk
  supabase migration list               # solo lectura: las 3 en «Local», con «Remote» vacío
  supabase migration repair --status applied 20261012190000 20261013090000 20261014090000
  supabase migration list               # ahora: aplicadas en local y en remoto
  ```

  Solo entonces `supabase db push --dry-run` debe decir que no hay nada
  pendiente. Si dice otra cosa, **parar** y revisar.
- Las migraciones futuras se prueban primero en local (`npm run test:db`,
  `test:db:mutaciones`, `test:e2e`) y, a ser posible, en un proyecto de pruebas.
  Nunca desde CI.

## Alta de la primera escuela y su director

Desde la app nadie puede crear escuelas ni darse de alta como director. Se hace
**a mano, una vez por escuela**, con un procedimiento de la migración 2:

1. Crear el usuario del director en *Authentication → Users → Add user*
   (la app no tiene registro público).
2. En el *SQL Editor* de Supabase (actúa como `postgres`), ejecutar:

   ```sql
   select privado.crear_escuela_con_director('<NOMBRE DE LA ESCUELA>', '<EMAIL DEL DIRECTOR>');
   ```

   Devuelve el `id` de la escuela. Sustituye los marcadores en el editor; no
   guardes estos datos en el repositorio.

Qué garantiza:

- Valida el nombre (2–120 caracteres) y exige que haya **exactamente un**
  usuario de Auth con ese email (sin distinguir mayúsculas). Si no existe o
  está repetido, se detiene con un mensaje claro.
- Crea el perfil si el usuario se registró antes de aplicar las migraciones.
- Crea la escuela y la membresía de director **juntas**: si algo falla, no queda
  ninguna escuela a medias.
- Solo la puede ejecutar `postgres`. `anon`, `authenticated` y `service_role`
  no tienen permiso (las pruebas lo comprueban).

## Conectar la app (Fase 3)

La app usa `@supabase/ssr` con la URL y la clave **pública** (ver `.env.example`):

1. *Project Settings → API*: copiar la URL del proyecto y la *publishable key*
   (o la *anon key*).
2. Ponerlas en `.env.local` (desarrollo) y en Vercel → *Settings → Environment
   Variables* (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
   Después, **volver a desplegar** (se incrustan al compilar).
3. *Authentication → Sign In / Providers*: **desactivar «Allow new users to sign
   up»**. La app no muestra registro, pero con la clave pública cualquiera podría
   llamar directamente a la API de registro de Supabase. Un usuario así no vería
   ninguna escuela (RLS), pero conviene cerrarlo. **Pendiente de confirmar** en
   el proyecto de producción (consulta 5 de la verificación).
4. *Authentication → URL Configuration*: *Site URL* con el dominio de la app.
5. Los usuarios se crean en *Authentication → Users → Add user*, y su escuela
   y rol según «Alta de la primera escuela y su director».

### Verificación de solo lectura del proyecto `idzkjzpgijzwmtpumcwk`

Desde el entorno de desarrollo **no se puede acceder** al proyecto alojado (red
bloqueada y sin credenciales). La app espera exactamente el esquema de las
migraciones de esta carpeta. Estas consultas solo leen (*SQL Editor*) y no
devuelven datos personales:

```sql
-- 1) Tablas. Esperado: 10 (competencias, escuelas, evaluacion_objetivos,
--    evaluacion_puntuaciones, evaluaciones, grupo_jugadores, grupos,
--    jugadores, membresias, perfiles), todas con rowsecurity = true.
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;

-- 2) Políticas. Esperado: 28 (16 de la migración 1 + 12 de la 3).
--    Ninguna de borrado en competencias ni en evaluaciones: no se borran.
select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 2;

-- 3) Permiso DELETE de los clientes. Esperado: solo authenticated, en jugadores,
--    grupos, grupo_jugadores, evaluacion_puntuaciones y evaluacion_objetivos.
select table_name, grantee from information_schema.role_table_grants
 where table_schema = 'public' and privilege_type = 'DELETE'
   and grantee in ('anon', 'authenticated') order by 1, 2;

-- 4) Funciones. Esperado: definer = true solo en es_miembro, tiene_rol,
--    comparte_escuela, crear_perfil y puede_editar_evaluacion; todas con search_path="".
select n.nspname, p.proname, p.prosecdef as definer, p.proconfig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'privado') order by 1, 2;

-- 5) Cuentas sin escuela (p. ej. por registro público abierto). Esperado: 0.
select count(*) as usuarios_sin_membresia from auth.users u
 where not exists (select 1 from public.membresias m where m.usuario_id = u.id);
```

Si algo no coincide: **no tocar la base de datos** y revisarlo antes. Si el
esquema no coincide, la app muestra «No se ha podido cargar tu escuela» y lo
registra en el servidor (`PGRST2xx` / `42P01`).

### Supabase local para las pruebas

`npm run supabase:local` (Docker) levanta PostgreSQL 17 y Auth (GoTrue) de
Supabase, PostgREST y una pasarela mínima en `127.0.0.1:54321` que imita las
rutas de Kong (`/auth/v1`, `/rest/v1`). Aplica las tres migraciones y crea, con
`privado.crear_escuela_con_director`, tres escuelas sintéticas (A y B con la
metodología base, C sin competencias) y cinco usuarios `@evora.invalid`
(director A, entrenador A, director B, director C y uno sin escuela). Las
claves se generan en cada arranque y solo sirven en local. `npm run
supabase:local:parar` lo detiene.

## Jugadores y grupos (Fase 4)

La app usa las tablas `jugadores`, `grupos` y `grupo_jugadores` **con las
políticas existentes, sin cambios**. No hace falta ninguna migración nueva.

| Operación en la app | Tabla / operación | Política RLS | Director | Entrenador |
|---|---|---|---|---|
| Ver jugadores | `jugadores` select | `jugadores_leer` | ✓ | ✓ |
| Crear jugador | `jugadores` insert | `jugadores_crear` | ✓ | ✓ |
| Editar jugador | `jugadores` update | `jugadores_editar` | ✓ | ✓ |
| Archivar / reactivar | `jugadores` update (`activo`) | `jugadores_editar` | ✓ | ✓ |
| Ver grupos | `grupos` select | `grupos_leer` | ✓ | ✓ |
| Crear / editar grupo | `grupos` insert / update | `grupos_*_director` | ✓ | ✗ (la app lo indica) |
| Asignar jugador | `grupo_jugadores` insert | `grupo_jugadores_crear` | ✓ | ✓ |
| Quitar jugador | `grupo_jugadores` delete | `grupo_jugadores_borrar` | ✓ | ✓ |
| Elegir entrenador/a | `membresias` + `perfiles` select | `membresias_leer`, `perfiles_leer` | ✓ | ✓ |

Decisiones:

- **La escuela** sale de la membresía del usuario verificado en el servidor
  (`contextoEscuela()`); los formularios no envían `escuela_id` y, si se
  añade a mano, se ignora (probado). Toda lectura y escritura filtra además
  por esa escuela; RLS y las FK compuestas lo imponen en la base de datos.
- **Archivar, no borrar:** la app no usa `delete` en `jugadores` ni en
  `grupos` (las políticas de borrado del director siguen existiendo).
- **Duplicados:** el nombre de grupo es único por escuela (índice existente,
  error 23505 → mensaje en español). Para jugadores, la app avisa si ya hay
  otro con el mismo nombre (sin tildes ni mayúsculas) y pide confirmación.
  Asignar dos veces no duplica (clave primaria `grupo_id, jugador_id`).
- **Una UPDATE que no afecta a ninguna fila** (otra escuela, sin permiso o
  inexistente) se trata como «no encontrado» (`.select()` tras la escritura).

Limitaciones conocidas (no requieren cambiar políticas):

- `perfiles.nombre_visible` está vacío en los usuarios creados a mano, así que
  el selector de entrenador muestra «Entrenador/a sin nombre visible». Se
  puede rellenar en el SQL Editor o con una pantalla de perfil futura (el
  propio usuario ya tiene permiso para editar su `nombre_visible`).
- Con varias escuelas, la app usa la primera por nombre (como la barra «Tu
  escuela»); falta un selector.
- Los jugadores pueden ser menores: la app guarda solo las columnas del
  esquema (sin datos de contacto). Revisar el RGPD antes de cargar datos reales.

## Roles: una persona puede dirigir y entrenar

**Decisión de diseño (vigente para esta fase y las siguientes).**

- Cada persona tiene **una cuenta** (Supabase Auth), **un perfil** y **una
  membresía por escuela**. `membresias.rol` es su **nivel de permisos**:
  - `director`: gestiona la escuela **y** puede hacer todo lo que hace un
    entrenador;
  - `entrenador`: tareas de entrenamiento.
- **Entrenar no es un rol aparte, es una tarea**: estar asignado a grupos
  (`grupos.entrenador_id`, que admite a cualquier miembro, también al director)
  y ser autor de evaluaciones (`evaluaciones.entrenador_id = auth.uid()`).
- Por eso el esquema actual ya representa al director que entrena, **sin
  migración**. Se ha comprobado política por política: toda política que
  admite `entrenador` admite también `director`, y ninguna está reservada solo
  al rol `entrenador`.

| Tarea | Entrenador/a | Director/a (también si entrena) |
|---|---|---|
| Entrenar grupos asignados, evaluar, editar sus evaluaciones | ✓ | ✓ |
| Dar de alta y editar jugadores, asignarlos a grupos | ✓ | ✓ |
| Crear y editar grupos, elegir su entrenador (incluido él mismo) | ✗ | ✓ |
| Metodología, editar cualquier evaluación, borrar jugadores | ✗ | ✓ |

En la app, las tareas se separan **sin cambiar de cuenta ni de sesión**: la
pestaña «Entrenar» (`/entrenamiento`: sus grupos, sus jugadores y sus
evaluaciones) y la sección «Dirección» del inicio (grupos y metodología). No hay
un «modo» que cambie permisos: la dirección nunca se pierde al entrenar.

Comprobado en `tests/20_evaluaciones.sql` (el director se asigna un grupo,
asigna jugadores, evalúa como autor, edita su evaluación y conserva la
dirección; una sola membresía) y con tres mutaciones que quitan al director
funciones de entrenador (todas detectadas).

**Reglas para el diseño futuro.**

- Toda política nueva de una tarea de entrenamiento debe admitir
  `array['director', 'entrenador']`, nunca solo `['entrenador']`.
- Si en el futuro los entrenadores solo deben ver **sus** grupos y jugadores, la
  condición será «es director **o** entrena ese grupo», nunca solo lo segundo.
- Solo haría falta una migración si se quisiera algo que hoy no existe, por
  ejemplo varios entrenadores por grupo (tabla `grupo_entrenadores`) o
  permisos combinados distintos de director ⊇ entrenador (por ejemplo, un
  coordinador sin funciones de entrenador). En ese caso habría que añadir una
  tabla o columna nueva, conservar `membresias.rol` como nivel de permisos y
  probar la migración con las mismas pruebas de aislamiento y mutación.

## Evaluaciones e informes (migración 3)

### Orden de ejecución

Las migraciones se aplican **en orden** y una sola vez: 1 → 2 → **3**
(`20261014090000_evaluaciones.sql`). La 3 no cambia nada de las anteriores
(solo añade tipos, tablas, funciones y políticas nuevas) y **no inserta datos**.
En producción **ya está aplicada** (a mano); no repetirla. Para un proyecto
nuevo: pegar cada migración completa en el *SQL Editor* dentro de
`begin; … commit;`, o usar la CLI en un proyecto con el historial al día.

Después de aplicarla:

1. *Advisors → Security Advisor*: sin avisos de RLS ni de `search_path`.
2. La dirección entra en **Metodología** y pulsa «Cargar metodología base ÉVORA»
   (o crea sus competencias). Sin competencias no se puede evaluar.
3. Cada entrenador/a rellena su nombre en **Tu perfil** (aparece en los informes;
   si no, el informe dice «Equipo técnico de la escuela»).

### Modelo

| Tabla | Contenido |
|---|---|
| `competencias` | Metodología de cada escuela: nombre, área (técnica, táctica, física, mental), qué se observa, orden, activa. No se borran: se desactivan. |
| `evaluaciones` | Jugador, grupo (opcional, del jugador), autor (`entrenador_id = auth.uid()`, no elegible), tipo (`rapida` / `completa`), fecha, título, fortalezas, áreas de mejora, observaciones, `clave_envio` (anti-duplicados). |
| `evaluacion_puntuaciones` | Nota entera 1–5 por competencia (una por competencia y evaluación). |
| `evaluacion_objetivos` | Hasta 5 objetivos de mejora con plazo opcional (≥ fecha de la evaluación). |

### Permisos (RLS)

| Operación | Director/a | Entrenador/a |
|---|---|---|
| Ver competencias y evaluaciones de su escuela | ✓ | ✓ |
| Crear, editar o desactivar competencias | ✓ | ✗ |
| Crear evaluaciones | ✓ | ✓ |
| Editar una evaluación (y reemplazar sus notas y objetivos) | todas las de su escuela | solo las suyas |
| Borrar evaluaciones o competencias | ✗ (nadie desde la app) | ✗ |

Integridad en la base de datos (no depende de la interfaz):

- FK compuestas `(escuela_id, …)`: jugador, grupo, autor, competencias y notas
  siempre de la **misma escuela**. No puede haber evaluaciones huérfanas
  (`jugador_id` obligatorio; al borrar un jugador se borran sus evaluaciones).
- Trigger `validar_grupo`: el jugador debe pertenecer al grupo indicado. Es
  `SECURITY INVOKER` para no revelar asignaciones de otras escuelas.
- `public.guardar_evaluacion(...)`: `SECURITY INVOKER` (aplica la RLS de quien
  la llama). Guarda evaluación + notas + objetivos **en una transacción**,
  valida fecha, notas y objetivos, y si se repite la misma `clave_envio`
  devuelve la evaluación ya creada en vez de duplicarla.
- Una evaluación de otra escuela, o una que no se puede editar, da el mismo
  error que una inexistente (`P0002`).

### Informes PDF

- Se generan **en cada petición** en `/evaluaciones/<id>/pdf` (servidor,
  `pdf-lib`), a partir de los datos guardados. **No se almacenan** en ningún
  bucket: no hay enlaces públicos ni copias que caducar o borrar.
- Acceso: sesión obligatoria (proxy + servidor) y RLS. Respuesta
  `Cache-Control: private, no-store`. Otra escuela o inexistente → 404.
- Compartir: el navegador descarga el PDF y usa el menú nativo del móvil
  (`navigator.share` con archivos), donde aparece WhatsApp si está instalado.
  Si el navegador no permite compartir archivos (p. ej. muchos de escritorio
  y algunos Android antiguos), se ofrece «Descargar PDF» para adjuntarlo a mano.
  La app nunca envía nada a terceros por su cuenta.

### Pendiente antes de producción (RGPD, menores)

- Base legal y consentimiento de las familias para evaluar y generar
  informes de menores; información sobre el tratamiento.
- Plazo de conservación de evaluaciones y procedimiento de supresión. Hoy la
  app solo archiva: no borra jugadores ni evaluaciones. La base de datos
  permite a la dirección borrar un jugador (y con él sus evaluaciones), pero
  solo por SQL. Una función de borrado en la app se diseñará aparte.
- Revisar quién puede ver qué: hoy cualquier miembro de la escuela ve todas
  sus evaluaciones (como con los jugadores).
- Los PDF compartidos por WhatsApp salen del control de la app: recordar a
  los entrenadores que solo se envían a la familia del jugador.

## Secretos

- **Nunca** subir al repositorio claves de Supabase. `.env*` ya está en `.gitignore`.
- La clave `service_role` (o *secret key*) salta RLS: solo en el servidor, jamás
  en el navegador ni con prefijo `NEXT_PUBLIC_`.
- En el navegador solo van la URL del proyecto y la clave pública
  (*anon* / *publishable*). `src/lib/acceso.ts` rechaza una clave `sb_secret_…`
  o un JWT con rol `service_role` en esas variables.
