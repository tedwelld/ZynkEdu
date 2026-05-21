#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLISH_DIR="$ROOT_DIR/.deploy/publish"
WEB_DIST_DIR="$ROOT_DIR/ZynkEdu.Web/dist/sakai-ng/browser"

rm -rf "$ROOT_DIR/.deploy"

npm ci --prefix "$ROOT_DIR/ZynkEdu.Web"
npm run build --prefix "$ROOT_DIR/ZynkEdu.Web"

dotnet publish "$ROOT_DIR/ZynkEdu.Api/ZynkEdu.Api.csproj" \
  --configuration Release \
  --runtime linux-x64 \
  --self-contained true \
  --output "$PUBLISH_DIR"

rm -rf "$PUBLISH_DIR/wwwroot"
mkdir -p "$PUBLISH_DIR/wwwroot"
cp -R "$WEB_DIST_DIR/." "$PUBLISH_DIR/wwwroot/"
