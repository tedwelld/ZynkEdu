#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLISH_DIR="$ROOT_DIR/.deploy/publish"

if [ ! -f "$PUBLISH_DIR/ZynkEdu.Api.dll" ]; then
  "$ROOT_DIR/build.sh"
fi

export ASPNETCORE_URLS="${ASPNETCORE_URLS:-http://0.0.0.0:${PORT:-8080}}"

if [ -x "$PUBLISH_DIR/ZynkEdu.Api" ]; then
  exec "$PUBLISH_DIR/ZynkEdu.Api"
fi

exec dotnet "$PUBLISH_DIR/ZynkEdu.Api.dll"
