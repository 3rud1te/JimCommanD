# Source provenance and publication scope

Public consolidation prepared on 12 October 2026 for the `3rud1te/JimCommanD` repository. The original local directories remain intact. This repository starts a new Git history; no prior Git history existed in the selected source folders.

| Repository location | Original project material |
| --- | --- |
| Root application | `JimCommanDApp` from the 6 September project workspace, package version 0.3.1, with later work through 11 September |
| `archive/offline-editor/` | The user's supplied `JimcommanD/JimCommanD` directory, including its later local changes |
| `archive/early-offline-editor/` | Earlier `JimCommanD-working` source from the 6 September workspace |
| `archive/recovered-2026-09-09/` | Consolidated output from the 7 September workspace and its recovered checkpoint, including a separate `local-midi/` version |
| `archive/import-audit/` | Isolated import-validation work from that workspace |
| `archive/releases/` | Existing 0.2.0, 0.3.0, and 0.3.1 Intel development ZIPs |
| `archive/promo/` | Short promo, captions, and source used to produce it |
| `research/` | Earlier plan and consolidation report |

The recovered checkpoint records the choice to continue the local MIDI implementation. That is why it is at the root, while the supplied React/Swift project is preserved intact in structure as an archive. Divergent implementations have not been silently merged.

## Publication cleanup

- Excluded generated app bundles, build caches, dependency directories, logs, and Finder metadata. Historical release ZIPs are retained explicitly.
- Removed private home paths, conversation IDs/links, private design links, and recorded Bluetooth/USB device identifiers from text. `00:00:00:00:00:00` and `REDACTED_SERIAL` are placeholders, not target hardware values.
- Omitted raw private conversation exports, complete vendor manuals, duplicate GUI export ZIPs, full vendor disassembly/string dumps, firmware/app binaries, and unrelated machine diagnostics. Focused technical records and protocol excerpts are retained. Stub files mark references to omitted transcripts/manuals.
- Normalized trailing whitespace in six archived text/source files.
- Preserved historical documentation as evidence; it may contain outdated status statements or local-path placeholders. Read the root README and current findings first.
- Scoped the root `npm test` command to `test/*.test.js` so it does not accidentally run independent archived test suites.
- Added repository documentation, contribution guidance, licence/notices, issue/PR templates, and CI. Core application behaviour was not changed for publication.

[source-manifest.json](source-manifest.json) records the source file hashes before publication cleanup. It is a provenance aid, not a claim that every archived variant has been built or tested. The original private paths and unredacted material remain only in the local working copies.
