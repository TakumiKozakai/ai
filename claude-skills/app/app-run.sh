#!/usr/bin/env bash
# フロントエンドをビルドし、Go バックエンドから配信して起動する（http://localhost:${SERVER_PORT:-8080}）。
# 前提: Go 1.27 以上、Node.js 20.19 以上が PATH にあること。DB（app/docker）が起動していること。
# サーバーの標準出力・標準エラーは画面に出しつつ APP_LOG_FILE（既定 app/logs/app.log）へ追記する。
# 画面試験（test/01_単体試験/screen-test）の appLog はこのファイルの打鍵中の増分を証跡にする。
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

# Resolve before cd so a relative APP_LOG_FILE is relative to app/.
APP_LOG_FILE="${APP_LOG_FILE:-logs/app.log}"
mkdir -p "$(dirname "$APP_LOG_FILE")"
APP_LOG_FILE="$(cd "$(dirname "$APP_LOG_FILE")" && pwd)/$(basename "$APP_LOG_FILE")"
echo "サーバーログ: $APP_LOG_FILE"
exec > >(tee -a "$APP_LOG_FILE") 2>&1

cd backend
exec go run ./cmd/server
