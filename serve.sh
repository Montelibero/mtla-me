#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-8080}"

if [[ ! "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
  echo "Port must be an integer from 1 to 65535." >&2
  exit 64
fi

cd "$ROOT_DIR"

echo "Building site into _site/ ..."
npm run build

echo "Serving _site/ on http://127.0.0.1:${PORT}"
cd "$ROOT_DIR/_site"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
