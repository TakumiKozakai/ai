#!/bin/sh
# Playwright 画面試験専用ロール。事前データ仕込み（INSERT/UPDATE/DELETE）と
# DB スナップショット（SELECT）に使う。DDL 権限は付与しない。
set -eu

: "${POSTGRES_PLAYWRIGHT_PASSWORD:?POSTGRES_PLAYWRIGHT_PASSWORD is required}"

psql --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=playwright_password="$POSTGRES_PLAYWRIGHT_PASSWORD" <<'SQL'
CREATE ROLE playwright_user LOGIN PASSWORD :'playwright_password';

GRANT USAGE ON SCHEMA public TO playwright_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO playwright_user;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO playwright_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO playwright_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO playwright_user;
SQL
