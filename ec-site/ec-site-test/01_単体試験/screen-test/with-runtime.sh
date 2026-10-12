#!/usr/bin/env bash
set -euo pipefail

TEST_TOOL_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEST_NODE_HOME="$TEST_TOOL_ROOT/.runtime/node-v22.23.2-darwin-x64"

if [[ -x "$TEST_NODE_HOME/bin/node" ]]; then
  export PATH="$TEST_NODE_HOME/bin:$PATH"
fi
export PLAYWRIGHT_BROWSERS_PATH="$TEST_TOOL_ROOT/.runtime/browsers"
export npm_config_cache="$TEST_TOOL_ROOT/.npm-cache"
export PLAYWRIGHT_SKIP_BROWSER_GC=1
cd "$TEST_TOOL_ROOT"
if [[ $# -eq 0 ]]; then
  printf '%s\n' 'Usage: bash with-runtime.sh <command> [arguments...]' >&2
  exit 2
fi
exec "$@"
