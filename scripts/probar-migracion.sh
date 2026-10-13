#!/usr/bin/env bash
# Prueba las migraciones de supabase/migrations en un PostgreSQL LOCAL y
# desechable (nunca en Supabase):
#   1. crea un clúster temporal con superusuario «supabase_admin»;
#   2. simula lo mínimo de Supabase (supabase/tests/00_entorno_local.sql);
#   3. aplica las migraciones en orden con el rol «postgres» NO superusuario,
#      como la CLI de Supabase;
#   4. ejecuta las pruebas de aislamiento y borra el clúster.
#
# Requisitos: binarios de PostgreSQL 15+ (initdb, pg_ctl, psql).
# Para probar con la imagen oficial de Supabase: scripts/probar-migracion-supabase.sh
# Uso: npm run test:db   (variable opcional MIGRACIONES=/ruta/a/migraciones)
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRACIONES="${MIGRACIONES:-$RAIZ/supabase/migrations}"
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

"${EJECUTAR[@]}" "$BIN/initdb" -D "$DATOS" -U supabase_admin --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
"${EJECUTAR[@]}" "$BIN/pg_ctl" -D "$DATOS" -o "-k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null
echo "PostgreSQL local: $("$BIN/postgres" --version)"

psql_como() { # rol, archivos...
  local rol="$1"; shift
  "$BIN/psql" -h "$TMP" -U "$rol" -d postgres -X -q -v ON_ERROR_STOP=1 --single-transaction "$@"
}

psql_como supabase_admin -f "$RAIZ/supabase/tests/00_entorno_local.sql" >/dev/null
psql_como supabase_admin -f "$RAIZ/supabase/tests/05_antes_de_migrar.sql" >/dev/null

shopt -s nullglob
MIGS=("$MIGRACIONES"/*.sql)
[[ ${#MIGS[@]} -gt 0 ]] || { echo "No hay migraciones en $MIGRACIONES" >&2; exit 1; }
for m in "${MIGS[@]}"; do
  echo "Aplicando como postgres (no superusuario): $(basename "$m")"
  psql_como postgres -f "$m" >/dev/null
done

for prueba in 10_aislamiento 20_evaluaciones; do
  psql_como supabase_admin -f "$RAIZ/supabase/tests/$prueba.sql" 2>&1 >/dev/null \
    | sed -e 's/^psql:[^ ]* NOTICE:  /  /'
done
