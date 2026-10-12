# Architecture

The active implementation is the version 0.3.1 local MIDI application selected in the recovered project checkpoint. It uses JavaScript and Objective-C. The React/Figma GUI and Swift shell are preserved separately.

```text
Browser / bundled WKWebView
  src/main.js: UI, local presets and capture libraries
    core/: validation, storage, slot mapping and IR preparation
    transports/simulated-mosaic.js: offline responses
    transports/hardware-midi.js: bounded native requests and incoming events
      macos/main.m: WKWebView message boundary
        macos/MosaicMidi.m: CoreMIDI ports, requests and receive handling
          Mosaic USB / Bluetooth MIDI endpoints
```

`src/protocol/sysex.js` implements the NC framing, 7-bit packing, slot reply parsing, and device notifications. `src/protocol/midi-events.js` handles MIDI stream boundaries, running status, and realtime bytes. Native and JavaScript receive tests replay preserved captures.

The live inventory reader queries wire indices 0–29 sequentially. Each result must match the expected request; the UI publishes a new inventory only after the complete read succeeds. The captured inventory in source is a dated fallback.

Native CC messages use MIDI channel 1. The UI enables mapped operations; the bridge bounds controller/value bytes to 0–127. Unknown model/IR writes are not implemented. App library indices, wire slots, physical storage, and the number of available NAM processors are distinct concepts.

Capture blobs and preset snapshots are local browser/WebView data. Changing browser profiles, origins, or app storage can change which data is visible. Repository source does not back up a user's IndexedDB contents.

`build-web.mjs` produces a dependency-free bundle. The macOS build packages that bundle with a native executable and uses system frameworks; it does not run a web server or Node at application runtime.
