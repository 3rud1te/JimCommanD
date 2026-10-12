# Build and verification guide

## Requirements

- Node.js 24+ for the active JavaScript application and built-in test runner. Publication checks used Node 26.7.0.
- macOS and Apple's Xcode Command Line Tools for the native application.
- An Intel Mac for direct testing of the produced x86_64 application. The declared deployment target is macOS 10.15; that is not a tested compatibility matrix.

The current shell script explicitly uses `/usr/local/bin:/usr/bin:/bin`. If Node is installed only through a version manager or under `/opt/homebrew`, make it available at the expected path or adapt the script for your machine. No npm dependencies need installing for the root app.

## JavaScript and app build

```sh
npm test
npm run build
node --check dist/app.bundle.js
npm run build:mac
file build/JimCommanD.app/Contents/MacOS/JimCommanD
codesign --verify --deep --strict build/JimCommanD.app
plutil -lint build/JimCommanD.app/Contents/Info.plist
open build/JimCommanD.app
```

`build-web.mjs` bundles the local modules without a package dependency. `build-macos.sh` compiles the AppKit/WebKit/CoreMIDI shell with `-arch x86_64 -mmacosx-version-min=10.15`, bundles the assets, and signs ad hoc. It does not notarize the app.

## Offline native tests (no hardware messages)

Run from the repository root on macOS:

```sh
mkdir -p build/tests
clang -fobjc-arc -framework Foundation -framework CoreMIDI \
  macos/MosaicMidiTest.m -o build/tests/native-receive-test
./build/tests/native-receive-test
clang -framework CoreMIDI -framework CoreFoundation \
  hardware-capture/amp_probe_test.c -o build/tests/amp-probe-test
./build/tests/amp-probe-test
```

These replay captured packets and synthetic cases without opening a MIDI connection. A passing test or successful app build does not establish a live device session.

## Earlier Python codec

```sh
python3 -m unittest discover -s archive/offline-editor/backend -v
```

The codec uses the Python standard library. Its separate device-inspection script requires PyObjC and access to a desktop MIDI session.

## Archived React/Swift versions

Each historical project is self-contained. Use its own package manifest, lockfile, and native script. They are not dependencies of the root app, and their old README/status files may disagree with later source changes. In particular, the supplied offline editor's Swift build script now targets macOS 26 despite its older native README describing macOS 12.

## Troubleshooting

- **Native bridge unavailable in browser:** use the built Mac app for CoreMIDI; use the browser for the simulator.
- **CoreMIDI `-10833`:** previous agent/background sessions could not attach to the desktop MIDI service. Test in an unlocked desktop Terminal before concluding the device or protocol has failed.
- **No footswitch events over USB:** historical captures used the separate Mosaic Bluetooth MIDI source. Bluetooth audio alone is insufficient.
- **Cannot upload a model/IR:** that transport operation is unfinished. Importing validates and stores a file locally.
- **Downloaded app warning:** development ZIPs are not notarized. Building from reviewed source is the supported development path.
