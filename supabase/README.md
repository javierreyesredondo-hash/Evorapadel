# Base de datos (Supabase) — ÉVORA PADEL

> **Estado:** migración preparada para revisión. **No se ha ejecutado en ningún
> proyecto de Supabase** y la aplicación todavía no se conecta a la base de datos.

## Contenido

| Ruta | Qué es |
|---|---|
| `migrations/20261012190000_fundacion_escuelas.sql` | Migración 1: escuelas, perfiles, membresías, jugadores, grupos, RLS y permisos. |
| `tests/00_entorno_local.sql` | Simulación mínima de Supabase para pruebas **locales**. **Nunca** ejecutarlo en Supabase. |
| `tests/10_aislamiento.sql` | 65 comprobaciones de aislamiento entre escuelas y de permisos. |
| `../scripts/probar-migracion.sh` | Levanta un PostgreSQL desechable, aplica la migración y ejecuta las pruebas (`npm run test:db`). |

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
2. Ejecutar las pruebas locales (no tocan Supabase):

   ```bash
   npm run test:db
   ```

   Requiere PostgreSQL 15+ instalado (`initdb`, `pg_ctl`, `psql`). Si `pg_config`
   no está en el `PATH`: `PG_BIN=/ruta/a/postgresql/bin npm run test:db`.
3. Comprobar que las pruebas cubren lo que te preocupa; si falta algo, añadirlo
   en `tests/10_aislamiento.sql` antes de aplicar nada.

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

Alternativa manual: pegar el contenido de la migración en *SQL Editor* dentro
de `begin; … commit;`, una sola vez.

Después de aplicarla:

1. *Advisors → Security Advisor* en el panel de Supabase: no debe haber avisos
   de RLS desactivado ni de funciones sin `search_path`.
2. Crear la primera escuela y su director desde el *SQL Editor* (actúa como
   administrador). Sustituir los marcadores; no guardar estos datos en el repo:

   ```sql
   with nueva as (
     insert into public.escuelas (nombre) values ('<NOMBRE DE LA ESCUELA>') returning id
   )
   insert into public.membresias (escuela_id, usuario_id, rol)
   select id, '<UUID DEL USUARIO EN AUTH>', 'director' from nueva;
   ```

## Secretos

- **Nunca** subir al repositorio claves de Supabase. `.env*` ya está en `.gitignore`.
- La clave `service_role` (o *secret key*) salta RLS: solo en el servidor, jamás
  en el navegador ni con prefijo `NEXT_PUBLIC_`.
- En el navegador solo irán la URL del proyecto y la clave pública
  (*anon* / *publishable*), configuradas en Vercel cuando se conecte la app.
