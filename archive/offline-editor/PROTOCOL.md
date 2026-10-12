# Mosaic protocol checkpoint

7 September 2026. Specification for implementing the Intel backend. Static analysis target: ToneCommand **1.2.7** `liblivtra.dylib`, SHA256 `96e79f38198a90074334604849e46e14fc707a6b8162afb90c01b2371f98c4cb`. 1.2.8 equivalence and live firmware behaviour remain unverified.

## Manufacturer-documented MIDI controls

Source: [MOSAIC MIDI Control User Guide](reference/midi-guide.txt), English pages 1–9, firmware **1.04+**. Device channel 0 means Omni. GUI channel labels and MIDI wire channel nibbles must be distinguished.

| Block | Bypass CC | Type CC |
|---|---:|---:|
| FX1 | 20 | 40 |
| FX2 | 21 | 41 |
| AMP | 23 | 43 |
| CAB | 24 | 44 |
| MOD | 25 | 45 |
| Delay | 26 | 46 |
| Reverb | 27 | 47 |
| EQ | 28 | 48 |

Bypass values 0–63 mean OFF and 64–127 mean ON. Use exact type IDs, not scaled knob values. Parameters use 0–127, but physical units/ranges must come from the selected algorithm. CC22/42 and CC29/49 are documented as ignored. AMP/CAB Type CC entries do **not** establish custom model/profile/IR slot selection: page 9 expressly excludes those assignments.

| Function | CC / mapping |
|---|---|
| Gate threshold | 50 |
| Compressor threshold, ratio, knee, attack, release, makeup | 51–56 |
| Drive gain/boost, tone, level | 57–59 |
| Amp gain, bass, mid, treble, level | 60–64 |
| Cabinet low cut, high cut, level | 65–67 |
| Modulation or special FX2 parameters | 68–73, conditional routing |
| Delay parameters | 74–79, algorithm-specific |
| Tuner | 80, 0 OFF / 127 ON |
| Previous/next preset | 81 / 82; 64–127 triggers |
| Previous/next three-preset group | 83 / 84; 64–127 triggers |
| Reverb parameters | 85–90, algorithm-specific |
| EQ bands | 91–97 and 33, selected EQ type determines bands |

**Critical routing rule:** when FX2 type is 8 (Pitch), 9 (Envelope Wah), or 10 (Wah), CC68–73 operate FX2 instead of MOD. The GUI must not route purely by a knob name.

Reverb types: 0 Room, 1 Plate, 2 Hall, 3 Concert, 4 Shimmer, 5 Cloud, 6 Spring. For Cloud, CC86 is Tone; on several other types it is PreDelay. EQ types are 3/6/8-band. The preserved guide contains the complete variant tables.

Preset recall uses Program Change 0–127 as the MIDI message domain. This does not establish 128 stored presets; the user manual displays 75. Do not use unverified PC numbers outside the actual device catalogue. Input gain’s user-manual range is −20…+20 dB; James requested a GUI range of −12…+12 dB. A naive −12…+12 → 0…127 conversion is **not a verified hardware encoding**.

## NC SysEx request

```text
F0 7D 4E 43 70 [7-bit packed inner bytes] F7

unpacked offset  size  field
0                1    version = 02
1                2    sequence, little endian
3                2    opcode, little endian
5                2    payload length, little endian
7                N    payload
```

Evidence: request builder `0xef8b8`, stores at `0xef918–0xef940`, packing loop starting `0xef990`; [assembly](reference/protocol-assembly.txt). No checksum field is present in this generic request builder. Individual payloads can still contain their own checksums.

Pack up to seven raw bytes at a time as one MSB bitmap followed by masked data. Bitmap bit i is raw byte i’s high bit. Final group may contain fewer than seven bytes. All transmitted body bytes are 0–127.

## NC SysEx response — newly verified

```text
F0 7D 4E 43 71 [7-bit packed inner bytes] F7

unpacked offset  size  field
0                1    version = 02
1                2    sequence, little endian
3                2    opcode, little endian
5                1    status
6                2    payload length, little endian
8                N    payload
```

Evidence: `0xefd8c` checks prefix, terminal F7 and **0x71**; `0xefe10–0xefe48` requires version 2, at least eight bytes, and total length exactly `8 + payload_length`. The slot-query caller rejects nonzero status. Do not decode responses with the seven-byte request layout. Full status-code meanings remain unmapped.

## Partial command map

| Opcode/message | Payload | Evidence and limits |
|---|---|---|
| `0x36` | slot u8 | Slot metadata query, strongly supported by caller `0xd935c` and metadata parser call `0xd93d8` → `0xd5994`. Earlier label “initial AMP operation” was underspecified. Full field map and numbering remain to verify. |
| `0x39` | slot u8, offset LE16, requested length u8 (maximum observed 200) | Historical AMP/NAM block-read disassembly; response payload reported as slot u8, offset LE16, total size LE16, then data. Full path needs fresh/live validation. |
| `F0 7D 44 46 55 01 F7` | separate static message | Construction was observed historically; its purpose is **not established**. Do not use it as a guessed harmless ping. |

Fixed request vector: sequence 1, AMP slot 2, offset 300, length 200.

```text
inner: 02 01 00 39 00 04 00 02 2C 01 C8
wire:  F0 7D 4E 43 70 00 02 01 00 39 00 04 00 08 02 2C 01 48 F7
```

`backend/protocol.py` implements request encoding, response decoding and byte-stream reassembly. It intentionally has no device transmission or firmware-write path. Its parser rejects malformed lengths, non-data bytes and invalid final MSB groups rather than guessing.

## Transport boundaries

CoreMIDI gives a MIDI byte stream; a USB endpoint dump includes USB-MIDI event framing and cannot be passed straight to this codec. Likewise, raw BLE-MIDI characteristic values include BLE-MIDI timestamp/framing bytes. Strip the transport framing using a proper transport parser before NC SysEx decoding. Fragmented SysEx and interleaved MIDI realtime messages must be handled.

BLE service: `03B80E5A-EDE8-4B33-A751-6CE34EC4C700`; MIDI characteristic: `7772E5DB-3868-4112-A1A9-F2669D106BF3`. These appear in the app and prior Mac discovery. Identifying a GATT service is not equivalent to validating the proprietary commands or observing an iPhone session.

## Firmware file

`<HOME>/Downloads/mosaic-1.10.fmu`, 696,556 bytes, SHA256 `139ee62c4d726cfa6421c0c05b76b548fcfe6d6b58d2c75995d00c5b753dbe05`, starts with ASCII `LUM0`. ASCII `1.10` starts at byte offset 37. A trailing `FMUC` marker was found at offset 696429; header/trailer semantics and package authenticity are not yet established. Presence of the file does not establish installed firmware version. No flash or firmware-mode command has been issued.

## Outstanding evidence gaps

Connection/version query; full slot-info schema and bounds; IR command family; preset serialisation and global settings; NAM formats/conversion; upload/commit/rename/delete commands; checksums and transfer timing; exact 1.2.8 changes; current installed firmware; firmware package validation/update/recovery; simultaneous NAM DSP capability. These remain explicit gaps rather than guessed opcodes or invented features.
