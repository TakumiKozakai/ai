#!/bin/sh
# 既存の PostgreSQL ボリュームに readonly_user を作成・同期するためのスクリプト。
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
: "${POSTGRES_READONLY_PASSWORD:?POSTGRES_READONLY_PASSWORD is required}"

docker compose --env-file "$script_dir/.env" -f "$script_dir/docker-compose.yaml" \
  exec -T -e POSTGRES_READONLY_PASSWORD db sh -eu -c '
    psql --set=ON_ERROR_STOP=1 \
      --username "$POSTGRES_USER" \
      --dbname "$POSTGRES_DB" \
      --set=readonly_password="$POSTGRES_READONLY_PASSWORD" <<'"'"'SQL'"'"'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '"'"'readonly_user'"'"') THEN
    CREATE ROLE readonly_user LOGIN;
  END IF;
END
$$;

ALTER ROLE readonly_user LOGIN PASSWORD :'"'"'readonly_password'"'"';
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO readonly_user;
SQL
  '
