#!/bin/sh
# 既存の PostgreSQL ボリュームに playwright_user を作成・同期するためのスクリプト。
# DB を削除せずに実行でき、繰り返し実行しても同じ状態に収束する。
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if [ ! -f "$script_dir/.env" ]; then
  echo "エラー: $script_dir/.env が見つかりません。.env.example をコピーして設定してください。" >&2
  exit 1
fi

set -a
. "$script_dir/.env"
set +a

: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PLAYWRIGHT_PASSWORD:?POSTGRES_PLAYWRIGHT_PASSWORD is required}"

docker compose --env-file "$script_dir/.env" -f "$script_dir/docker-compose.yaml" \
  exec -T -e POSTGRES_PLAYWRIGHT_PASSWORD db sh -eu -c '
    psql --set=ON_ERROR_STOP=1 \
      --username "$POSTGRES_USER" \
      --dbname "$POSTGRES_DB" \
      --set=playwright_password="$POSTGRES_PLAYWRIGHT_PASSWORD" <<'"'"'SQL'"'"'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '"'"'playwright_user'"'"') THEN
    CREATE ROLE playwright_user LOGIN;
  END IF;
END
$$;

ALTER ROLE playwright_user LOGIN PASSWORD :'"'"'playwright_password'"'"';
GRANT USAGE ON SCHEMA public TO playwright_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO playwright_user;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO playwright_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO playwright_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO playwright_user;
SQL
  '
