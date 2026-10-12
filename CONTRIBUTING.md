# Contributing to JimCommanD

Thanks for helping make the Mosaic usable from Intel Macs. The root application is the active implementation; `archive/` preserves earlier work for reference.

## Get started

1. Fork the repository and create a branch for one focused change.
2. Run `npm test`, `npm run build`, and `npm start` from the root.
3. For native changes, build the Mac app and run the offline checks in [BUILDING.md](docs/BUILDING.md).
4. Open a pull request describing the problem, the change, and exactly what you tested. State when hardware testing was unavailable.

No npm installation is required for the active app. Archived React projects have independent dependency manifests and are outside the root test command.

## Choose a task

The [roadmap](docs/ROADMAP.md) lists the gaps. Documentation, test fixtures, native Mac smoke checks, and import validation are useful first contributions. Compare `archive/import-audit/` and the recovered MIDI source before redoing their work; changes there have not automatically been merged into the active app.

## Protocol evidence

Record device firmware (or explicitly say unknown), macOS version, USB/BLE transport, app/probe version, exact request/reply bytes, and expected versus observed behaviour. Distinguish user-supplied captures, a fresh hardware run, static analysis, and simulator output.

Preserve sequence, length, slot, fragmentation, and error-handling checks. Add replayable offline regression tests for discovered protocol behaviour. A successful inventory read does not establish upload support, writable capacity, or a second NAM processor.

Hardware write support needs a documented request/chunk/acknowledgement/commit/read-back sequence before it is exposed in the UI. Keep unknown operations disabled. Diagnostic programs are not all passive; consult [hardware-capture/README.md](hardware-capture/README.md) before running one.

## What to include

Keep changes focused and include relevant tests and updated documentation. Do not commit access tokens, private chat logs, device identifiers, local cache files, vendor firmware, or model/audio files without redistribution permission. Redact identifying fields while preserving protocol structure.

Contributions to the original project code are submitted under the repository's MIT licence. Preserve third-party notices and distinguish external material from your own work.
