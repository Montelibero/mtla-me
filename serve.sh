#!/bin/bash
# serve.sh - local development server for mtla-me

set -e

echo "Preparing files for local development..."

# Copy files from i18n to root for local development
shopt -s nullglob dotglob
for dir in i18n/*/ ; do
  lang="$(basename "$dir")"
  rm -rf "$lang"
  mkdir -p "$lang"
  rsync -a --delete "$dir" "$lang"/
done

echo "Files copied, starting server..."

# Start Python server
python3 -m http.server 8080
