# Roadmap and open work

This is the handoff list for anyone continuing JimCommanD. These are unfinished tasks, not promised features or verified device capabilities.

## Accessible starting points

- Run the native app on an Intel Mac and document connection, inventory refresh, incoming events, local imports, and relaunch behaviour.
- Check compatibility on older macOS releases; the 10.15 deployment target alone is not evidence.
- Reconcile import-validation improvements in `archive/import-audit/` and `archive/recovered-2026-09-09/local-midi/` with the current source. Add regression tests before adopting changes.
- Verify the earlier named amplifier selector and −12 to +12 dB OUT-gain requirements against the active UI without assuming a hardware encoding.
- Improve build-tool discovery for Node installed through version managers or Homebrew on Apple Silicon.

## Hardware and protocol

- Validate the full app-to-device inventory path in a desktop session and collect reproducible traces.
- Establish installed firmware identification, physical footswitch assignments, and parameter scales/routing, including shared FX2/MOD CCs.
- Confirm hardware model selection and obtain the IR inventory command family.
- Recover NAM/IR write, chunk, acknowledgement, commit, and read-back behaviour. Keep writes disabled until these operations are evidenced and tested.
- Determine writable slot limits and device-native model conversion requirements. NAM JSON validation does not produce the proprietary RESONA Flash format.
- Establish whether two NAM stages are possible; the 20/10 UI grouping does not answer that question.

## Later work

Firmware updating requires package validation, verified device routing, and recovery behaviour. Signed/notarized releases, broader macOS coverage, and additional devices can follow once the current implementation is validated.

Use [the hardware findings](../hardware-capture/HARDWARE_FINDINGS.md) for captured packets and [the recovered checkpoint](RECOVERED-STATUS-2026-09-09.md) for history. Older archive claims should be checked against current code and dated evidence.
