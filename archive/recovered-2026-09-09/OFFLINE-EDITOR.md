# JimCommanD offline editor

The GUI source under `gui/` is the working implementation of the current Figma design. It can be run in a browser during development or bundled into the Intel wrapper:

```sh
cd gui
npm install
npm test
npm run build
cd ..
bash native/build.sh
open JimCommanD.app
```

The editor saves a versioned draft in browser local storage and supports explicit JSON import/export. The draft stores rig settings plus file fingerprints and inspection summaries; it does not embed or upload `.nam`, `.nam2`, `.wav` or `.ir` files. A checked file therefore remains available for a later transfer implementation without pretending that selection completed a device operation.

The top-right OUT slider adjusts output gain from −12 dB to +12 dB in 0.1 dB steps, with 0 dB at the centre. Drafts store this value explicitly as `outputGainDb`. Older drafts with the original unitless `outputLevel` value start at neutral 0 dB; their remaining settings are preserved. Hardware output gain encoding remains unverified.

Click the amplifier selector at the right of Amplifier Library to choose a named custom capture or a documented Mosaic built-in amp. The 20 custom positions show the NAM capture name, a readable filename when no name is available, or Empty. The second group lists the 30 factory models from the Mosaic manual, including Fender ’59 Bassman and Fender ’65 Darkface. Selection is saved with the draft. These groups describe choices in the editor, not additional physical storage; the local library can be expanded separately from the pedal’s as-yet-unverified writable capacity.

Asset checks are deliberately structural. `.nam` is accepted only when it is UTF-8 JSON with version, architecture, configuration and finite numeric weights. `.wav` is checked as a complete RIFF/WAVE container with one supported PCM or IEEE-float format chunk and one aligned data chunk. `.nam2` and `.ir` are fingerprinted while their internals remain explicitly unverified.

The command preview plans documented CC/PC messages and shows the bytes without sending them. Input/output levels, algorithm-specific parameters, Pedal Capture bypass and unresolved library addressing produce no guessed device bytes. CC68–73 follow the guide’s special FX2 routing rule. The MIDI diagnostic only enumerates browser ports with ordinary Web MIDI and never sends SysEx or control messages.

`native/JimCommanD.swift` is a small AppKit/WKWebView shell. It bundles the built page, restricts navigation to bundled files, supplies native file panels, and exports a validated version-1 draft through a save panel. It does not contain a hardware transport. The next hardware-dependent layer remains a separate CoreMIDI/BLE-MIDI backend once a reliable Mosaic session is available.
