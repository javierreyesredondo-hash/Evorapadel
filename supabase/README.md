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

1. El director se registra en Supabase Auth con su email (desde la app cuando
   exista el registro, o en *Authentication → Users → Add user*).
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

## Secretos

- **Nunca** subir al repositorio claves de Supabase. `.env*` ya está en `.gitignore`.
- La clave `service_role` (o *secret key*) salta RLS: solo en el servidor, jamás
  en el navegador ni con prefijo `NEXT_PUBLIC_`.
- En el navegador solo irán la URL del proyecto y la clave pública
  (*anon* / *publishable*), configuradas en Vercel cuando se conecte la app.
