#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-8080}"

cd "$ROOT_DIR"

echo "Building site into _site/ ..."
npm run build

echo "Serving _site/ on http://localhost:${PORT}"
cd "$ROOT_DIR/_site"
exec python3 -m http.server "$PORT"
