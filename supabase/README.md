# Base de datos (Supabase) — ÉVORA PADEL

> **Estado:** migraciones preparadas para revisión. **No se han ejecutado en ningún
> proyecto de Supabase** y la aplicación todavía no se conecta a la base de datos.

## Contenido

| Ruta | Qué es |
|---|---|
| `migrations/20261012190000_fundacion_escuelas.sql` | Migración 1: escuelas, perfiles, membresías, jugadores, grupos, RLS y permisos. |
| `migrations/20261013090000_alta_primera_escuela.sql` | Migración 2: perfiles para usuarios registrados antes de migrar y alta segura de una escuela con su director. |
| `tests/00_entorno_local.sql` | Simulación de Supabase para pruebas **locales** (roles, `auth`, `postgres` no superusuario). **Nunca** ejecutarlo en Supabase. |
| `tests/05_antes_de_migrar.sql` | Prueba: un usuario se registra en Auth **antes** de aplicar las migraciones. |
| `tests/10_aislamiento.sql` | 98 comprobaciones de aislamiento entre escuelas, permisos, estructura y alta de escuelas. |
| `../scripts/probar-migracion.sh` | PostgreSQL local desechable: aplica la migración como `postgres` y ejecuta las pruebas (`npm run test:db`). |
| `../scripts/probar-migracion-supabase.sh` | Lo mismo sobre la **imagen oficial** `supabase/postgres` en Docker (`npm run test:db:supabase`). |
| `../scripts/probar-mutaciones.mjs` | Introduce 18 fallos de seguridad, uno a uno, y exige que las pruebas los detecten (`npm run test:db:mutaciones`). |

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

### Verificación realizada (migraciones 1 y 2)

| Entorno | Resultado |
|---|---|
| `supabase/postgres:15.19.0.004` (Docker), aplicadas como `postgres` | 98/98 |
| `supabase/postgres:17.11.0.004` (Docker), aplicadas como `postgres` | 98/98 |
| PostgreSQL 16 local con simulación de Supabase | 98/98 |
| Mutaciones de seguridad | 18/18 detectadas |
| Linter oficial de Supabase ([splinter](https://github.com/supabase/splinter), el del *Security Advisor*) sobre 15.19 | Sin avisos de seguridad; solo `unused_index` (base vacía) |

No verificado: un proyecto **alojado** en supabase.com (por decisión, no se ha
ejecutado nada en Supabase). Por eso conviene `supabase db push --dry-run` y un
proyecto de pruebas antes del definitivo.

## Cómo ejecutarla más adelante (cuando se decida)

> Recomendación: un **proyecto de Supabase nuevo** para ÉVORA PADEL, y probar
> primero en un proyecto de pruebas (staging). El proyecto de la versión
> anterior de la app puede contener tablas con nombres que choquen.

Con la [CLI de Supabase](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase init                         # crea supabase/config.toml (sin secretos)
supabase link --project-ref <ref-del-proyecto>
supabase db push --dry-run            # muestra qué se aplicaría, sin aplicarlo
supabase db push                      # aplica las migraciones pendientes
```

Alternativa manual: pegar cada migración **en orden** (primero la 1, después
la 2) en el *SQL Editor*, cada una dentro de `begin; … commit;`, una sola vez.

Después de aplicarla:

1. *Advisors → Security Advisor* en el panel de Supabase: no debe haber avisos
   de RLS desactivado ni de funciones sin `search_path`.
2. Crear la primera escuela y su director (ver abajo).

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
   ninguna escuela (RLS), pero conviene cerrarlo.
4. *Authentication → URL Configuration*: *Site URL* con el dominio de la app.
5. Los usuarios se crean en *Authentication → Users → Add user*, y su escuela
   y rol según «Alta de la primera escuela y su director».

### Verificación obligatoria antes de usar el proyecto `idzkjzpgijzwmtpumcwk`

Desde el entorno de desarrollo **no se ha podido acceder** al proyecto alojado
(red bloqueada y sin credenciales), así que su esquema **no está comprobado**.
La app espera exactamente el de las migraciones de esta carpeta. En el *SQL
Editor* (solo lectura):

```sql
select table_name from information_schema.tables
 where table_schema = 'public' order by 1;
-- Esperado: escuelas, grupo_jugadores, grupos, jugadores, membresias, perfiles

select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name in ('escuelas', 'membresias', 'perfiles')
 order by table_name, ordinal_position;

select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- rowsecurity = true en todas

select count(*) from public.membresias m join auth.users u on u.id = m.usuario_id;
```

Si faltan tablas o columnas, hay tablas de la versión anterior de la app, o
`membresias.rol` no admite `director`/`entrenador`: **no tocar la base de datos**
y revisarlo antes. Si el esquema no coincide, la app muestra «No se ha podido
cargar tu escuela» y lo registra en el servidor (`PGRST2xx` / `42P01`).

### Supabase local para las pruebas

`npm run supabase:local` (Docker) levanta PostgreSQL 17 y Auth (GoTrue) de
Supabase, PostgREST y una pasarela mínima en `127.0.0.1:54321` que imita las
rutas de Kong (`/auth/v1`, `/rest/v1`). Aplica las dos migraciones y crea, con
`privado.crear_escuela_con_director`, dos escuelas sintéticas y cuatro usuarios
`@evora.invalid` (director A, entrenador A, director B y uno sin escuela). Las
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

## Secretos

- **Nunca** subir al repositorio claves de Supabase. `.env*` ya está en `.gitignore`.
- La clave `service_role` (o *secret key*) salta RLS: solo en el servidor, jamás
  en el navegador ni con prefijo `NEXT_PUBLIC_`.
- En el navegador solo van la URL del proyecto y la clave pública
  (*anon* / *publishable*). `src/lib/acceso.ts` rechaza una clave `sb_secret_…`
  o un JWT con rol `service_role` en esas variables.
