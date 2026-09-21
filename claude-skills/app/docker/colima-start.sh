#!/bin/sh
# Docker エンジン用の Colima VM を起動するスクリプト。
# colima / docker CLI はインストール済みであることが前提(MacでのDocker環境構築.md を参照)。
# すでに起動している場合は何もせず、繰り返し実行しても同じ状態に収束する。
# リソースは環境変数 COLIMA_CPU / COLIMA_MEMORY(GB) / COLIMA_DISK(GB) で上書きできる。
#   例: COLIMA_MEMORY=12 ./colima-start.sh
# なお、リソース指定は VM の初回作成時にのみ反映される(作成済みの VM を変更するには
# `colima stop` のうえ、この値を付けて再起動する)。
set -eu

cpu="${COLIMA_CPU:-4}"
memory="${COLIMA_MEMORY:-8}"
disk="${COLIMA_DISK:-60}"

if colima status >/dev/null 2>&1; then
  echo "Colima はすでに起動しています。"
else
  echo "Colima を起動します(CPU: ${cpu}, メモリ: ${memory}GB, ディスク: ${disk}GB)..."
  colima start --cpu "$cpu" --memory "$memory" --disk "$disk"
fi

# Docker エンジンに接続できることを確認する
if ! docker info >/dev/null 2>&1; then
  echo "エラー: Docker エンジンに接続できません。'docker context ls' で colima が選択されているか確認してください。" >&2
  exit 1
fi

echo "Docker エンジンに接続できました。"
