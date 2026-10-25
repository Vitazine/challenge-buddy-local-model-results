#!/bin/sh
# Prefer normal installations; use the desktop's bundled runtime when absent.
set -eu
cd "$(dirname "$0")/.."
runtime="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"
if ! command -v node >/dev/null 2>&1 && [ -x "$runtime/node/bin/node" ]; then
  PATH="$runtime/node/bin:$PATH"
fi
if ! command -v pnpm >/dev/null 2>&1 && [ -x "$runtime/bin/fallback/pnpm" ]; then
  PATH="$PATH:$runtime/bin/fallback"
fi
export PATH
if ! command -v node >/dev/null 2>&1 || ! command -v pnpm >/dev/null 2>&1; then
  echo 'Install Node.js 24 LTS and pnpm 11.25.0, then retry.' >&2
  exit 1
fi
exec pnpm "$@"
