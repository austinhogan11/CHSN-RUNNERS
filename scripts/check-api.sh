#!/bin/sh
set -eu

CDPATH= cd "$(dirname "$0")/../apps/api"

uv run ruff check .
uv run ruff format --check .
uv run pyright
uv run pytest
