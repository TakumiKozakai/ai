#!/bin/sh
set -eu

: "${POSTGRES_READONLY_PASSWORD:?POSTGRES_READONLY_PASSWORD is required}"

psql --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=readonly_password="$POSTGRES_READONLY_PASSWORD" <<'SQL'
CREATE ROLE readonly_user LOGIN PASSWORD :'readonly_password';

GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO readonly_user;
SQL
