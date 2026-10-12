#!/usr/bin/env bash
# Prueba las migraciones de supabase/migrations en un PostgreSQL LOCAL y
# desechable (nunca en Supabase): crea un clúster temporal, simula lo mínimo de
# Supabase (supabase/tests/00_entorno_local.sql), aplica las migraciones en
# orden, ejecuta las pruebas y borra el clúster.
#
# Requisitos: binarios de PostgreSQL 15+ (initdb, pg_ctl, psql).
# Uso: npm run test:db
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="${PG_BIN:-$(pg_config --bindir 2>/dev/null || true)}"
if [[ -z "$BIN" || ! -x "$BIN/initdb" ]]; then
  echo "No se encuentran los binarios de PostgreSQL (initdb). Define PG_BIN=/ruta/a/bin." >&2
  exit 1
fi

TMP="$(mktemp -d)"
DATOS="$TMP/datos"
# initdb no se ejecuta como root: en ese caso se usa el usuario del sistema «postgres».
EJECUTAR=()
if [[ "$(id -u)" == "0" ]]; then
  EJECUTAR=(runuser -u postgres --)
  chown postgres "$TMP"
fi

limpiar() {
  "${EJECUTAR[@]}" "$BIN/pg_ctl" -D "$DATOS" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap limpiar EXIT

"${EJECUTAR[@]}" "$BIN/initdb" -D "$DATOS" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
"${EJECUTAR[@]}" "$BIN/pg_ctl" -D "$DATOS" -o "-k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null
echo "PostgreSQL local: $("$BIN/postgres" --version)"

ARCHIVOS=(-f "$RAIZ/supabase/tests/00_entorno_local.sql")
for m in "$RAIZ"/supabase/migrations/*.sql; do ARCHIVOS+=(-f "$m"); done
ARCHIVOS+=(-f "$RAIZ/supabase/tests/10_aislamiento.sql")

# Una sola transacción: si algo falla, nada queda aplicado; al terminar se descarta todo.
"$BIN/psql" -h "$TMP" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 --single-transaction \
  "${ARCHIVOS[@]}" 2>&1 >/dev/null | sed -e 's/^psql:[^ ]* NOTICE:  /  /'
