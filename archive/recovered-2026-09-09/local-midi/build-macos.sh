#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP="$ROOT/build/JimCommanD.app"
PATH=/usr/local/bin:/usr/bin:/bin

cd "$ROOT"
node build-web.mjs
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web"
clang -arch x86_64 -mmacosx-version-min=10.15 -fobjc-arc \
  macos/main.m macos/MosaicMidi.m -o "$APP/Contents/MacOS/JimCommanD" \
  -framework AppKit -framework WebKit -framework CoreMIDI
cp macos/Info.plist "$APP/Contents/Info.plist"
cp dist/index.html dist/styles.css dist/app.bundle.js "$APP/Contents/Resources/web/"
chmod 755 "$APP/Contents/MacOS/JimCommanD"
codesign --force --deep --sign - "$APP"
echo "$APP"
