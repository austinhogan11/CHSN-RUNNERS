#!/bin/sh

set -eu

CDPATH= cd "$(dirname "$0")/../apps/api"

uv run ruff check . --fix
uv run ruff format .