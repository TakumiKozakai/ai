#!/usr/bin/env bash
# フロントエンドをビルドし、Go バックエンドから配信して起動する（http://localhost:${SERVER_PORT:-8080}）。
# 前提: Go 1.27 以上、Node.js 20.19 以上が PATH にあること。DB（app/docker）が起動していること。
# 開発時にフロントエンドを編集しながら確認する場合は、このスクリプトの代わりに
#   (cd backend && go run ./cmd/server) と (cd frontend && npm run dev) を別々に起動する。
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "エラー: app/.env が見つかりません。.env.example をコピーして値を設定してください。" >&2
  exit 1
fi
set -a
source .env
set +a

(
  cd frontend
  if [ ! -d node_modules ]; then
    npm ci
  fi
  npm run build
)

cd backend
exec go run ./cmd/server
