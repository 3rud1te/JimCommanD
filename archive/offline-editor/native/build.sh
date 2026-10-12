#!/bin/bash
set -euo pipefail

NATIVE_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$NATIVE_DIR/.." && pwd)"
WEB_DIR="$PROJECT_DIR/gui/dist"
APP_PATH="$PROJECT_DIR/JimCommanD.app"
BUILD_ROOT="$NATIVE_DIR/.build"

if [[ ! -f "$WEB_DIR/index.html" ]]; then
  echo "Missing gui/dist/index.html. Build the GUI first (cd gui && npm run build)." >&2
  exit 1
fi
# Swift module caches contain absolute paths. Preserve a valid local cache—
# rebuilding the macOS SDK modules is both slow and unreliable with Swift 6.3—
# but discard one copied from another checkout or build location.
MODULE_CACHE="$BUILD_ROOT/module-cache"
MODULE_CACHE_STAMP="$BUILD_ROOT/module-cache-project-path"
if [[ ! -f "$MODULE_CACHE_STAMP" ]] || [[ "$(<"$MODULE_CACHE_STAMP")" != "$PROJECT_DIR" ]]; then
  rm -rf "$MODULE_CACHE"
  mkdir -p "$MODULE_CACHE"
  printf '%s\n' "$PROJECT_DIR" > "$MODULE_CACHE_STAMP"
else
  mkdir -p "$MODULE_CACHE"
fi
STAGING_DIR="$(mktemp -d "$BUILD_ROOT/package.XXXXXX")"
trap 'rm -rf "$STAGING_DIR"' EXIT
STAGED_APP="$STAGING_DIR/JimCommanD.app"
mkdir -p "$STAGED_APP/Contents/MacOS" "$STAGED_APP/Contents/Resources"

xcrun swiftc "$NATIVE_DIR/JimCommanD.swift" \
  -target x86_64-apple-macosx26.0 -Onone \
  -module-cache-path "$MODULE_CACHE" \
  -framework AppKit -framework WebKit -framework UniformTypeIdentifiers \
  -o "$STAGED_APP/Contents/MacOS/JimCommanD"
cp "$NATIVE_DIR/Info.plist" "$STAGED_APP/Contents/Info.plist"
ditto "$WEB_DIR" "$STAGED_APP/Contents/Resources/Web"
plutil -lint "$STAGED_APP/Contents/Info.plist"
codesign --force --sign - "$STAGED_APP"
codesign --verify --deep --strict "$STAGED_APP"

# Only replace this known generated app after compilation/signing have succeeded.
if [[ -e "$APP_PATH" || -L "$APP_PATH" ]]; then
  mv "$APP_PATH" "$STAGING_DIR/previous.app"
fi
mv "$STAGED_APP" "$APP_PATH"
file "$APP_PATH/Contents/MacOS/JimCommanD"
echo "Built $APP_PATH"
