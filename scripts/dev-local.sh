#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"

cleanup() {
  echo
  echo "Stopping Runner development servers..."

  kill "${API_PID:-}" "${WEB_PID:-}" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

echo "Starting Runner API..."
(
  cd "$ROOT_DIR/apps/api"
  uv run uvicorn runner_api.main:app \
    --reload \
    --host 127.0.0.1 \
    --port 8000
) &
API_PID=$!

echo "Starting Runner web app..."
(
  cd "$ROOT_DIR/apps/web"
  npm run dev
) &
WEB_PID=$!

echo
echo "Runner is starting:"
echo "  Web: http://localhost:5173"
echo "  API: http://127.0.0.1:8000"
echo "  API docs: http://127.0.0.1:8000/docs"
echo
echo "Press Ctrl+C to stop both."

wait "$API_PID" "$WEB_PID"