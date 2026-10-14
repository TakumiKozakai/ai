#!/bin/bash
# ~/.claude/hooks/reviewer-readonly-bash.sh
#
# reviewer エージェント用 PreToolUse(Bash) hook。
# git の読み取り系コマンド（diff / log / show / status）だけを許可し、それ以外はすべて拒否する。
# fail-closed: 許可 JSON を出力するとき以外は必ず exit 2 で終わる
# （exit 2 以外のエラーはブロックされず通常の権限判定に戻ってしまうため）。
#
# 前提: jq がインストールされていること。

set -euo pipefail
trap 'exit 2' ERR

deny() {
  echo "reviewer は読み取り専用です。許可: git diff / log / show / status のみ（$1）。ファイルの読み取りは Read / Grep / Glob を使ってください" >&2
  exit 2
}

input=$(cat)
cmd=$(printf '%s' "$input" | jq -er '.tool_input.command') || deny "入力の解析に失敗"
[ -n "$cmd" ] || deny "コマンドが空"

# 連結・リダイレクト・展開・改行など、別の処理を紛れ込ませられる記号を含むものは拒否
case "$cmd" in
  *'|'* | *';'* | *'&'* | *'>'* | *'<'* | *'$'* | *'`'* | *'{'* | *$'\n'* | *$'\r'*)
    deny "連結・リダイレクト・展開に使う記号を含む"
    ;;
esac

# 先頭一致（単語境界あり。git difftool 等を通さない）
[[ "$cmd" =~ ^git\ (diff|log|show|status)(\ |$) ]] || deny "許可されたコマンドで始まっていない"

# 引数の検査。クォート・バックスラッシュを除去してから判定する（--out""put 等の回避対策）。
# git の長いオプションは省略形も有効なため、前方一致で拒否する。
set -f
for tok in $cmd; do
  t=${tok//[\'\"\\]/}
  case "$t" in
    --ou* | --ext* | --no-i*) deny "書き込み・外部実行・cwd 外読み取りにつながる引数: $t" ;;
  esac
done

printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
exit 0
