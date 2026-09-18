#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
WEB_DIR="$ROOT_DIR/apps/web"

cd "$WEB_DIR"

npm run lint
npm run typecheck
npm run test
npm run build