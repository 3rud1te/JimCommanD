# JimCommanD

Offline-first Intel Macintosh control application prototype for the LIVTRA Mosaic.

## Complete without hardware

- Interactive signal chain and contextual parameters.
- Separate 20-position amplifier and 10-position pedal libraries sharing hardware NAM positions 1–30.
- Independent 30-position cabinet IR library.
- `.nam`, `.nam2`, `.wav` and `.ir` file validation.
- Actual capture blobs saved locally in IndexedDB, not merely filenames.
- 75 locally saved preset snapshots.
- Simulator acknowledgements for every UI command.
- Mosaic SysEx outer framing, inner message framing and 7-bit packing with automated tests.
- Hardware MIDI transport isolated behind a dedicated boundary.

## Requires the physical Mosaic

- Confirm writable NAM/IR slot inventory and firmware limits.
- Discover the IR slot-information, upload, commit and verification opcodes.
- Validate the new native CoreMIDI USB bridge in the user's desktop session.
- Transfer files in device-approved chunks, commit them and verify by read-back.
- Validate whether two NAM captures can run simultaneously in the signal chain.

## Verified USB reads (2026-09-09)

AMP/NAM slot-info opcode `0x36` returned names for all 30 positions in a live
Terminal run. The library menus now show that captured inventory and its date.
These are saved device labels, not live refreshes or factory defaults. Names
are retained as reported, including capitalization and apparent truncation.
The 20 amplifier / 10 pedal split is the app's grouping; the inventory does not
establish a hardware type restriction on those positions. IR names, model
selection and uploads remain unverified.

## Live USB MIDI in the Mac app

Open the rebuilt Intel app and select **Mosaic USB · live**. This connects
the native CoreMIDI bridge and reads wire slots 0..29 sequentially. Use
**Refresh model names** for subsequent reads. Progress appears in the footer;
the menus update only after all 30 matching replies arrive. The last successful
read time is shown above the library. A failed refresh retains the previous
snapshot. Live results remain in memory for the current app session.

The same CoreMIDI input passively forwards Mosaic footswitch traffic to the
interface. A streaming decoder handles packet boundaries, running status,
Program Change, Control Change, notes, pitch bend, system messages and split
SysEx. Recent events and exact hexadecimal bytes appear in the footswitch
monitor. Program Change updates the visible 1–75 preset position. Verified
MOD/DEL/REV bypass CCs update their module state.

The native bridge accepts only connect, disconnect and bounded slot-info
requests from the bundled main page. Only verified read opcode `0x36` is sent.
USB mode enables only controls carrying an explicit, bounded MIDI CC mapping;
currently this covers modulation, delay and reverb algorithms, parameters and
bypass. Unmapped controls remain disabled. Library menus allow browsing names
without changing the pedal. File import remains available and stages validated
content locally against the selected hardware slot. The simulator remains
available.

## NAM, EADL and cabinet IR import

Model slots accept `.nam`, `.nam2` and Mosaic-native `.eadl`; cabinet slots
accept `.wav` and `.ir`. The importer validates file contents. NAM JSON must
include a version, architecture and weights. EADL must contain a valid `EADL`
header, JSON metadata and `SAPF` payload. WAV files are checked for RIFF/WAVE
structure, PCM/float encoding, channels, sample rate and bit depth.

WAV IRs that are not mono 44.1 kHz are converted locally to mono 44.1 kHz,
24-bit PCM before staging. This was validated with the real 48 kHz/24-bit
`Pos03 center.wav`. `WindsorCranked2.nam` validates as NAM 0.5.1/WaveNet and
requires LIVTRA's proprietary RESONA Flash conversion. The provided
`025_Electro-Harmonix_Big_Muff_Pi.eadl` validates as a native EADL v1 container.

Staging does not yet flash the Mosaic. The device write/chunk/commit/read-back
handshake must be recovered and verified before hardware upload is enabled.

Verification: 30 JavaScript tests and an offline native receive test pass; the
Intel application compiles. The native test replays the actual split reply and
checks sequence matching and error handling. Live app-to-device validation is
still required because the Codex process could not access the desktop MIDI
session. A standalone browser does not expose the native CoreMIDI bridge.

## Run

```sh
npm test
npm start
```

Then open `http://127.0.0.1:4173`.

## Build the Intel macOS application

```sh
npm run build:mac
open build/JimCommanD.app
```

The `.app` contains a native AppKit/WebKit launcher and a dependency-free web bundle. It is ad-hoc signed for local use and targets Intel `x86_64` on macOS 10.15 or later.

The simulator is the default. USB mode supports inventory reads, live incoming
MIDI, bounded mapped CC edits and validated local import staging; model changes,
device uploads and IR inventory reads are not yet implemented in the hardware
transport.
