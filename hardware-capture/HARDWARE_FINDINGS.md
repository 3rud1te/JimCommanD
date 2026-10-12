# LIVTRA Mosaic hardware capture

Capture date: 2026-09-08 (Europe/London)

## Known Mosaic identities

- Bluetooth address: `00:00:00:00:00:00`
- Classic Bluetooth serial name: `MosaicAudio`
- Classic Bluetooth RFCOMM channel: `2`
- BLE name observed previously: `Mosaic Midi`
- BLE MIDI service: `03B80E5A-EDE8-4B33-A751-6CE34EC4C700`
- BLE MIDI characteristic: `7772E5DB-3868-4112-A1A9-F2669D106BF3`
- USB vendor: `Ember`
- USB VID: `0x33C3` (`13251`)
- USB PID: `0x1302` (`4866`)
- USB serial observed previously: `REDACTED_SERIAL`

## Current live result

### Successful USB AMP-slot query — 2026-09-09

The Mosaic enumerated as CoreMIDI source and destination `Mosaic`. A direct,
non-destructive query for wire slot `0` was accepted:

`F0 7D 4E 43 70 00 02 01 00 36 00 01 00 00 00 F7`

The device returned a response split across two CoreMIDI packets. Reassembled:

`F0 7D 4E 43 71 00 02 01 00 36 00 00 1E 10 00 00 01 00 52 2F 00 02 00 1A 44 0C 56 1A 1A 00 00 4D 61 72 73 68 61 00 6C 6C 20 31 39 35 39 00 42 4A 00 F7`

After standard 7-bit unpacking, the response contains:

- sequence `1`
- opcode `0x36`
- status `0`
- payload length `30`
- 14 bytes of metadata, beginning with returned slot `0`
- a 16-byte name field containing `Marshall 1959BJ` and NUL padding

This capture establishes that requests use outer discriminator `0x70`, replies
use `0x71`. The initial interpretation of a one-byte length and trailing byte
was incorrect; see the correction below. The valid slot-zero frame was unchanged
by that mistake because both the high length byte and the slot value were zero.

### Slot-one rejection and probe correction — 2026-09-09

The first selectable probe sent this malformed request for slot 1:

`F0 7D 4E 43 70 00 02 01 00 36 00 01 01 00 00 F7`

Its unpacked body was `02 01 00 36 00 01 01 00`: the slot value was mistakenly
written to the high byte of the length, declaring 257 payload bytes with only
one present. The reply was:

`F0 7D 4E 43 71 00 02 01 00 36 00 01 00 00 00 F7`

Decoded: `02 01 00 36 00 01 00 00` (status 1, length 0). This is not evidence
that slot 1 is empty or unavailable.

Vendor library inspected at
`<HOME>/Downloads/ToneCommand.app/Contents/Frameworks/liblivtra.dylib`:

- `0xd937c..0xd93a8`: builds opcode 0x36 with a one-byte slot payload.
- `0xd9514..0xd9564`: maps status 1 to the 11-byte string at `0x4a85d7`,
  `bad payload`. Status 3 maps to `slot out of range` separately.
- `0xd5994..0xd5aa8`: requires at least 30 response payload bytes, validates
  slot at offset 0, and reads the name from payload offsets 14..29.

The corrected layout uses a two-byte little-endian length at request offsets
5..6 with payload starting at 7. Responses have status at 5, length at 6..7,
payload starting at 8. There is no independent trailing byte in these captures.
The corrected slot-one frame is:

`F0 7D 4E 43 70 00 02 01 00 36 00 01 00 00 01 F7`

`amp_slot_probe.c` v2 and the app parser now use this layout. Regression checks
cover the exact slot-one bytes, the rejected malformed frame, both captured
responses, and lengths greater than 255. The corrected slot-one query still
needed live validation from the user's Terminal; this Codex process previously
could not attach to CoreMIDI (`kMIDINoConnection`).

### Corrected slot-one query validated — 2026-09-09

The user ran v2 against wire slot 1 and received a complete 50-byte reply,
split into 48 + 2 CoreMIDI bytes:

`F0 7D 4E 43 71 00 02 01 00 36 00 00 1E 10 00 01 01 00 52 2F 00 08 00 64 5F 3C 44 1A 1A 00 00 42 6F 67 58 54 43 00 32 00 00 00 00 00 00 00 00 00 00 F7`

Status 0, payload 30 bytes, returned wire index 1, model `BogXTC2`.
Metadata: `01 01 00 D2 2F 00 00 64 5F BC 44 1A 1A 00`.
This confirms the corrected request layout with a nonzero slot value.

Confirmed inventory so far: wire 0 (UI 1) `Marshall 1959BJ`; wire 1 (UI 2)
`BogXTC2`. Do not treat these reads as evidence that model selection or uploads
are already implemented.

Probe v3 accepts `--all` to read wire indices 0..29 using only opcode 0x36.
It sends one request at a time with distinct sequences, validates the returned
slot, waits up to five seconds per request, and stops on a timeout or device
error. Its final inventory distinguishes names, device errors and unconfirmed
slots. `--all --dry-run` prints requests without opening CoreMIDI. Offline C
checks cover the real split capture, MIDI realtime bytes, mismatched slots and
sequences, and the bad-payload reply.

### Full inventory validated — 2026-09-09

The user supplied v3's final inventory with names for all 30 wire slots. These
summary names represent successful, matching responses in the probe; full raw
response metadata was not supplied for slots 2..29. Names are preserved exactly
(the chat-escaped underscores in slot 23 are represented as literal underscores).

| UI position | Wire index | Device name |
| --- | --- | --- |
| 1 | 0 | Marshall 1959BJ |
| 2 | 1 | BogXTC2 |
| 3 | 2 | Orange Rockerve |
| 4 | 3 | Jazz120 |
| 5 | 4 | 2555X Ch2+ lync |
| 6 | 5 | Fd65Dk |
| 7 | 6 | SUHR SL100 |
| 8 | 7 | MarDSL1 |
| 9 | 8 | MarDSL2 |
| 10 | 9 | Mar8001 |
| 11 | 10 | Mar8002 |
| 12 | 11 | 90sDualRec-Full |
| 13 | 12 | MesR2 |
| 14 | 13 | MesR3 |
| 15 | 14 | OgG120 |
| 16 | 15 | 1966BluesBreake |
| 17 | 16 | Pey51502 |
| 18 | 17 | Pey6505 |
| 19 | 18 | LION custom sho |
| 20 | 19 | RanT22 |
| 21 | 20 | Tonebender MK I |
| 22 | 21 | SlashRig |
| 23 | 22 | ST_SF300_FUZZ2_ |
| 24 | 23 | Mesa MK IV 6L6- |
| 25 | 24 | Big Muff Sustai |
| 26 | 25 | marshall bluesb |
| 27 | 26 | Marshall JCM 80 |
| 28 | 27 | Rockerverb MK3 |
| 29 | 28 | Hiw320 |
| 30 | 29 | MarSup |

The UI snapshot uses the existing 20/10 grouping but this is an application
convention, not a device restriction demonstrated by these reads. Neither
simultaneous dual-NAM processing nor selection/upload commands are validated.

### Native app transport implemented — pending live app validation

Version 0.2.0 links CoreMIDI in the Intel AppKit/WebKit app. A restricted message
bridge connects the exact `Mosaic` source/destination and issues one opcode 0x36
slot read at a time. Native receive code reassembles SysEx, ignores interleaved
realtime bytes, checks sequence/opcode/length/slot, and reports a five-second
timeout. JavaScript decodes the matched response and replaces the inventory
only after all 30 records are read. USB mode does not send editing commands.

The native receive test passed using the user-supplied BogXTC2 capture. JavaScript
tests verify sequential inventory reads, device errors, wrong slots, cancellation
and request/reply correlation. The native app compiles for x86_64. Successful
live USB communication is established for the Terminal probe; it is not yet
established for the new app bridge. Desktop GUI control is unavailable here.

### Live input and import preparation — 2026-09-09

Version 0.3.1 connects one input port to both the USB `Mosaic` source and the
separate `Mosaic Midi Bluetooth` source observed in MIDI Monitor. USB carries
inventory replies while physical switch notifications were observed only on
the Bluetooth endpoint. A stateful decoder handles standard channel messages,
running status, packet-split SysEx and interleaved realtime bytes. It is passive:
footswitch monitoring sends no command to the device. Program Change can reflect
Mosaic preset selection, and exact raw bytes remain visible for establishing the
A/B/C and STOMP mappings from evidence.

The native bridge also permits a narrowly bounded three-byte channel-1 Control
Change send. JavaScript exposes it only when a command contains integer CC and
value fields in the MIDI 0–127 range. The mapped MOD, DEL and REV controls can
therefore use their documented CC assignments; unknown commands and upload
requests remain rejected.

Real files in `<HOME>/Wavemind2` were inspected:

- `WindsorCranked2.nam`: valid JSON NAM 0.5.1, WaveNet, 13,802 weights;
  requires proprietary RESONA Flash conversion before device upload.
- `025_Electro-Harmonix_Big_Muff_Pi.eadl`: valid EADL v1 with JSON metadata,
  eleven gain positions and an SAPF model payload; native Mosaic container.
- `Pos03 center.wav`: valid mono 48 kHz/24-bit PCM, 0.5 seconds; the local IR
  preparation stage converts it to mono 44.1 kHz/24-bit PCM (66,194 bytes).

The app can validate and stage `.nam`, `.nam2`, `.eadl`, `.wav` and `.ir`
against a selected slot. Hardware flash writes stay disabled until the vendor's
chunk, commit and read-back protocol is established. No speculative write or
erase command was sent.

### Device notifications and refreshed inventory — 2026-09-09

A later MIDI Monitor capture contains three device-originated notifications
using outer discriminator `0x72`. Unlike requests (`0x70`) and replies (`0x71`),
the unpacked notification body is:

- protocol byte `0x02`
- opcode uint16 little-endian
- payload length uint16 little-endian
- payload

Observed preset notifications were opcode `0x60`, length 1, with values `0x12`,
`0x13`, and `0x14`. Consistent with the Mosaic's zero-based wire positions and
75 presets, JimCommanD reflects these as visible presets 19, 20, and 21.

Opcode `0x62` carried six-byte payloads `01 00 00 00 00 3F`,
`01 01 00 00 00 3F`, and `01 02 CD CC 4C 3F`: group 1, parameter indices 0–2,
and little-endian float values 0.5, 0.5, and approximately 0.8. Opcode `0x69`
carried one-byte values 84, 85, and 100. The latter opcodes are decoded and
logged but not assigned semantic labels without further evidence.

The same capture returned a refreshed 30-slot inventory. The saved fallback
snapshot was updated to the newly reported names; live USB reads remain the
authority when connected.

### Earlier capture state — 2026-09-08

The Mosaic was not electrically enumerated over USB during this capture. The
IOKit USB device roots contained the external `SSL 2` plus Apple internal
devices, but no `Mosaic`, `Ember`, VID `0x33C3`, PID `0x1302`, or serial
`REDACTED_SERIAL`.

The saved Bluetooth serial-port record still exists. IOKit reports:

- address `00:00:00:00:00:00`
- name `MosaicAudio`
- RFCOMM channel `2`
- connection handle `4095`, which is the disconnected sentinel
- no process currently owns `/dev/cu.MosaicAudio`

A direct classic-Bluetooth connection attempt returned `0xe00002bc`
(`kIOReturnError`) and did not establish a link. The current user session
returned zero paired devices through `IOBluetoothDevice`.

A direct CoreBluetooth scan could not start because macOS denied Bluetooth
permission to the command-line probe (`CBManagerStateUnauthorized`, state `2`,
authorization `2`). Bluetooth Inspector is installed and declares its own
authorised Scan, Interrogate, Enumerate, Read Value, and Write Value intents.

CoreMIDI exposed zero devices, sources, and destinations in the locked/current
session. `MIDIClientCreate` returned `-10833` (`kMIDINoConnection`).

## Probe programs

- `midi_probe.c`: enumerates every CoreMIDI object, connects to Mosaic sources,
  sends the standard non-destructive Universal Identity Request, and logs replies.
- `bluetooth_probe.m`: targets the exact Mosaic address, attempts a classic
  connection, requests its name, runs a full SDP service query, and prints all
  RFCOMM/L2CAP records.
- `ble_probe.m`: scans BLE advertisements, targets Mosaic by name or the BLE-MIDI
  service UUID, connects, enumerates every GATT service/characteristic/descriptor,
  reads all readable values, and subscribes to all notifications.
- `footswitch_monitor.c`: passively attaches to Mosaic CoreMIDI sources and prints
  incoming packet bytes for switch mapping. It creates no output port and sends
  no MIDI.

No erase, reset, firmware-write, or blind vendor command was sent in this
capture. Those operations should only follow a successful descriptor/protocol
capture so they do not destroy the evidence needed to understand the device.
