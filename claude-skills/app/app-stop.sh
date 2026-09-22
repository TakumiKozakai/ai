#!/usr/bin/env bash
set -e

PORT="${SERVER_PORT:-8080}"
PIDS=$(lsof -ti :"$PORT" -sTCP:LISTEN || true)

if [ -z "$PIDS" ]; then
  echo "ポート${PORT}で待ち受けているプロセスは見つかりませんでした。"
  exit 0
fi

echo "ポート${PORT}のプロセスを停止します: $PIDS"
kill $PIDS

for _ in $(seq 1 10); do
  sleep 1
  if [ -z "$(lsof -ti :"$PORT" -sTCP:LISTEN || true)" ]; then
    echo "停止しました。"
    exit 0
  fi
done

echo "停止しなかったため強制終了します: $PIDS"
kill -9 $PIDS
