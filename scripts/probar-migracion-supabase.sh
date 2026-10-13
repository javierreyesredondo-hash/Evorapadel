#!/usr/bin/env bash
# Prueba las migraciones sobre la imagen OFICIAL de Postgres de Supabase, en un
# contenedor local desechable (nunca contra un proyecto de Supabase):
#   1. arranca supabase/postgres (por defecto 15.19.0.004);
#   2. aplica las migraciones con el rol «postgres» (no superusuario), como la CLI;
#   3. ejecuta supabase/tests/10_aislamiento.sql y elimina el contenedor.
#
# Requisitos: Docker con acceso a Docker Hub.
# Uso: npm run test:db:supabase
#      IMAGEN=supabase/postgres:17.x.y.z npm run test:db:supabase   (otra versión)
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRACIONES="${MIGRACIONES:-$RAIZ/supabase/migrations}"
IMAGEN="${IMAGEN:-supabase/postgres:15.19.0.004}"
NOMBRE="evora-prueba-migracion-$$"

limpiar() { docker rm -f "$NOMBRE" >/dev/null 2>&1 || true; }
trap limpiar EXIT

docker run -d --name "$NOMBRE" -e POSTGRES_PASSWORD=solo-local "$IMAGEN" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$NOMBRE" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break
  sleep 2
done
# La imagen ejecuta sus scripts de arranque tras aceptar conexiones: esperar a que existan los roles.
for _ in $(seq 1 30); do
  docker exec "$NOMBRE" psql -U supabase_admin -d postgres -XAtc \
    "select 1 from pg_roles where rolname = 'authenticated'" 2>/dev/null | grep -q 1 && break
  sleep 2
done
echo "Imagen: $IMAGEN — $(docker exec "$NOMBRE" psql -U supabase_admin -d postgres -XAtc 'select version()' | cut -d, -f1)"

docker exec "$NOMBRE" mkdir -p /tmp/migraciones /tmp/pruebas
docker cp "$MIGRACIONES/." "$NOMBRE:/tmp/migraciones/" >/dev/null
docker cp "$RAIZ/supabase/tests/05_antes_de_migrar.sql" "$NOMBRE:/tmp/pruebas/" >/dev/null
docker cp "$RAIZ/supabase/tests/10_aislamiento.sql" "$NOMBRE:/tmp/pruebas/" >/dev/null
docker cp "$RAIZ/supabase/tests/20_evaluaciones.sql" "$NOMBRE:/tmp/pruebas/" >/dev/null
docker cp "$RAIZ/supabase/tests/30_metodologias.sql" "$NOMBRE:/tmp/pruebas/" >/dev/null

# Usuario registrado en Auth antes de aplicar las migraciones.
docker exec -i "$NOMBRE" psql -U supabase_admin -d postgres -X -q -v ON_ERROR_STOP=1 \
  -f /tmp/pruebas/05_antes_de_migrar.sql >/dev/null

for m in "$MIGRACIONES"/*.sql; do
  echo "Aplicando como postgres (no superusuario): $(basename "$m")"
  docker exec -i "$NOMBRE" psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 --single-transaction \
    -f "/tmp/migraciones/$(basename "$m")" >/dev/null
done

for prueba in 10_aislamiento 20_evaluaciones 30_metodologias; do
  docker exec -i "$NOMBRE" psql -U supabase_admin -d postgres -X -q -v ON_ERROR_STOP=1 --single-transaction \
    -f "/tmp/pruebas/$prueba.sql" 2>&1 >/dev/null | sed -e 's/^psql:[^ ]* NOTICE:  /  /'
done
