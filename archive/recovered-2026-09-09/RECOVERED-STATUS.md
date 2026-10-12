# Jimcommand — recovered cross-thread checkpoint

Recovered 9 September 2026 by reading the saved conversation logs and inspecting the other implementation. This supersedes the older offline-only project status. It does not claim a fresh hardware test.

## Authoritative implementation — user decision

On 9 September 2026, the user explicitly selected the newer local MIDI implementation, version 0.3, as the project to continue. Its source is `<HOME>/Documents/Codex/2026-09-06/referenced-chatgpt-conversation-this-is-an/JimCommanDApp`. Continue development there, following applicable workspace instructions. The Figma/React implementation in this workspace is historical reference, not the development target. Do not merge its GUI into the local MIDI app or synchronize future changes to Figma unless the user requests it again. Preserve the earlier amplifier-name and OUT gain requirements when checking the selected local app.

## New evidence recovered

The Connect LIVTRA Mosaic MIDI thread (`PRIVATE_THREAD`) continued through 9 September despite its local index retaining a 6 September update date. The conversation file, rather than the index timestamp, established this.

User-pasted Terminal output on 8 September UTC (9 September local time) shows named Mosaic input/output endpoints and successful opcode 0x36 requests/replies. A corrected wire-slot-1 request returned status 0 and BogXTC2. The user also supplied a 30-position inventory, beginning Marshall 1959BJ and BogXTC2. See [preserved evidence](reference/recovered-live-midi-evidence.json). These are user-supplied live captures, not a fresh connection made by this recovery task. The earlier malformed request returned status 1; it must not be treated as evidence that wire slot 1 is invalid.

On 9 September the user reported that pressing all switches produced responses in MIDI Monitor. Exact physical switch assignments still require captured bytes; this report alone does not map them.

## Newer implementation located

Source: `<HOME>/Documents/Codex/2026-09-06/referenced-chatgpt-conversation-this-is-an/JimCommanDApp`

Package: `<HOME>/Documents/Codex/2026-09-06/referenced-chatgpt-conversation-this-is-an/outputs/JimCommanD-0.3.0-Intel.zip`

Inspected package.json identifies version 0.3.0. Source inspection confirms an Objective-C CoreMIDI bridge, sequential 0..29 model-name reads, incoming MIDI event forwarding/decoding, and a bounded control-change send path. It also contains local capture storage, NAM/EADL/WAV/IR inspection, and conversion of WAV IRs to mono 44.1 kHz/24-bit PCM. Hardware uploads remain unimplemented. Conversion quality and full GUI/device operation were not revalidated in this recovery pass.

The other thread reports 31 JavaScript tests and a native receive test passing; its README still says 30. Those historical test results have not been rerun here.

## Earlier implementation comparison (superseded by user selection)

This workspace contains the React/Figma GUI and Swift offline shell. The other workspace contains a separate web GUI and Objective-C MIDI shell. Neither should silently replace the other. Preserve the agreed Figma design and the requested named amplifier selector and -12 to +12 dB OUT control while integrating the newer verified protocol and transport work.

The last Figma save observed in this conversation was Version 11 on 7 September. Older MASTER paragraphs saying the live document was never updated are stale. No fresh Figma inspection was performed on 9 September.

## Remaining work

- Continue the selected local MIDI source tree and package it as the authoritative deliverable; no Figma merge is requested.
- Validate the native app's full MIDI flow in the desktop session; earlier agent-process CoreMIDI -10833 failures do not erase successful Terminal reads.
- Recover and verify model/IR write, commit and read-back operations, IR inventory, model selection, and any NAM conversion needed for the device.
- Confirm physical footswitch mappings and device parameter scaling.
- Finish package/document consistency and native GUI smoke checks.

No hardware messages, builds, background agents or changes to the other implementation were started during this recovery. The user's latest preferred spelling is Jimcommand; existing paths and binaries have been retained.
