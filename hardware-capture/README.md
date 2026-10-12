# Hardware findings and diagnostic source

Start with [HARDWARE_FINDINGS.md](HARDWARE_FINDINGS.md). It records dated captures, corrections, and unverified areas.

The publication copy replaces the original Bluetooth address and USB serial with placeholders. Set the correct address locally before using address-specific diagnostic programs. Do not commit your device identifiers or raw machine inventories.

| Program | Behaviour |
| --- | --- |
| `amp_probe_test.c` | Offline replay and encoding checks; no MIDI connection or transmission |
| `amp_slot_probe.c` | Slot-information queries using `0x36`; `--all --dry-run` prints requests without opening CoreMIDI |
| `footswitch_monitor.c` | Passive incoming MIDI monitoring; no output port |
| `midi_probe.c` | Enumeration and a Universal Identity Request; sends MIDI |
| `bluetooth_probe.m` | Attempts classic Bluetooth connection and service discovery |
| `ble_probe.m` | BLE scan, connection, readable-value inspection, and notification subscription |
| `usb_probe.c` | USB inspection source; review before running |
| `bluetooth-status.m` | Historical Bluetooth status helper with a redacted target address |
| `midi_restart.c` | Calls the system MIDI restart routine; not part of the test suite |
| `run_probes.sh` | Builds/runs several active diagnostics; not an offline test command |

For the two offline native test commands see [BUILDING.md](../docs/BUILDING.md). Publication verification does not run the live probes or send device commands. The additional passive capture source from 11 September remains in `outputs/mosaic_passive_20260911.c`.
