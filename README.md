# JimCommanD

**An independent Intel Mac controller for the LIVTRA Mosaic.**

JimCommanD began as a way to use the Mosaic from an Intel Mac when the inspected ToneCommand builds only contained Apple Silicon binaries. This repository brings together the application, native MIDI bridge, protocol research, tests, and earlier designs so others can continue the work.

**Status: experimental, version 0.3.1. Contributions welcome.** The app builds for Intel macOS and includes a simulator, local libraries, and a CoreMIDI transport. NAM/IR uploads and firmware updates are unfinished. This is an independent project, unaffiliated with LIVTRA or ToneCommand.

## What works—and what still needs work

| Area | Current state |
| --- | --- |
| Intel Mac app | Native Objective-C AppKit/WKWebView shell; x86_64 build target, macOS 10.15 minimum declared. Older macOS versions have not been tested. |
| Offline editor | Interactive signal chain, contextual effect controls, 75 local preset positions, and a simulator. |
| Local libraries | 20 amplifier and 10 pedal positions, plus a separate 30-position IR library. The 20/10 split is an app convention, not proof of two simultaneous NAM processors. |
| Imports | NAM/NAM2/EADL and WAV/IR inspection; capture blobs stored locally in IndexedDB. WAV preparation can convert to mono 44.1 kHz/24-bit PCM. Importing does not write to the pedal. |
| USB inventory | Sequential reads of all 30 NAM names using opcode `0x36`; successful Terminal captures preserved. Full native app/device operation still needs desktop-session validation. |
| Incoming MIDI | USB and Mosaic Bluetooth MIDI endpoint support; streaming decoding and footswitch/event monitoring. |
| Live edits | Bounded MIDI channel-1 CC send path for mapped modulation, delay, and reverb controls. Device scaling and routing still need hardware validation. |
| Not implemented | Hardware model selection, IR inventory, NAM/IR upload/commit/read-back, firmware updating, and proprietary NAM conversion. |

The [hardware findings](hardware-capture/HARDWARE_FINDINGS.md) distinguish captured evidence from implementation and open questions. See the [roadmap](docs/ROADMAP.md) for useful next tasks.

## Try the simulator

Install Node.js 24 or newer, then:

```sh
git clone https://github.com/3rud1te/JimCommanD.git
cd JimCommanD
npm test
npm start
```

Open **http://127.0.0.1:4173**. The simulator is the default. The active app has no npm dependencies, so there is no install step. A standalone browser does not provide the native CoreMIDI bridge.

## Build the Intel Mac app

You need macOS, Node.js, and Apple's Xcode Command Line Tools (`xcode-select --install`). The existing build script expects Node in `/usr/local/bin`, as on the original Intel development machine.

```sh
npm run build:mac
open build/JimCommanD.app
```

The bundle contains its web assets and uses macOS AppKit, WebKit, and CoreMIDI. Node is needed to build, not to run the app. Builds are ad-hoc signed; they are not Developer ID signed or notarized. See [BUILDING.md](docs/BUILDING.md) for verification, troubleshooting, and offline native tests.

Earlier packaged Intel apps are preserved in [archive/releases](archive/releases/). They are historical development snapshots. Building from the current source is recommended; historical ZIPs were not rebuilt or independently hardware-tested during publication.

## Connect a Mosaic

1. Connect the Mosaic by USB and open the native Mac app.
2. Select **Mosaic USB · live**. The bridge reads wire slots 0–29 sequentially.
3. Use **Refresh model names** for another inventory read. The menu updates after all matching replies arrive; a failed read retains the prior snapshot.
4. For physical switch notifications, establish the Mosaic Bluetooth MIDI connection in macOS where available. Bluetooth audio is a separate connection.

Library browsing and local file staging do not select or flash a hardware model. Controls without a mapped CC stay unavailable in live mode. The captured model-name fallback is a dated observation, not a factory catalogue or a current read of your pedal.

## Repository map

| Path | Contents |
| --- | --- |
| [src/](src/) | Current dependency-free web UI, data storage, protocol codecs, simulator, and transport boundary |
| [macos/](macos/) | Current Objective-C app shell and CoreMIDI bridge |
| [test/](test/) | Current JavaScript tests |
| [hardware-capture/](hardware-capture/) | Findings, diagnostic source, and offline protocol tests |
| [docs/](docs/) | Build guide, architecture, roadmap, verification, and source provenance |
| [archive/offline-editor/](archive/offline-editor/) | Source from the supplied `JimcommanD/JimCommanD` folder: earlier React/Figma GUI, Python codec, and Swift wrapper |
| [archive/recovered-2026-09-09/](archive/recovered-2026-09-09/) | Recovered checkpoint, alternate MIDI source, and design changes |
| [archive/early-offline-editor/](archive/early-offline-editor/) | Earlier working source snapshot |
| [archive/import-audit/](archive/import-audit/) | Separate import-validation work preserved for comparison |
| [archive/promo/](archive/promo/) | Original short demo video, captions, and generation source |
| [research/](research/) | Earlier planning and technical consolidation notes |

The root is the development target. Historical files can contain superseded status claims; read [PROVENANCE.md](docs/PROVENANCE.md) before using them. Original working directories have not been moved or overwritten.

## Help finish it

Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the [roadmap](docs/ROADMAP.md). Useful contributions include captured device traces, native app testing, import validation, and documented transfer protocols. Please record firmware, transport, exact bytes, and whether a result came from hardware or a simulator.

Original JimCommanD code is available under the [MIT licence](LICENSE). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for dependencies, brands, and research material. Vendor applications, firmware, manuals, and users' model/audio libraries are not bundled.
