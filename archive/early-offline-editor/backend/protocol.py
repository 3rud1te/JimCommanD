"""Mosaic NC SysEx codec. Derived from ToneCommand 1.2.7 static analysis.

Offline only: this module never opens a device or transmits anything.
These frames are not yet validated against a live Mosaic response.
"""
from __future__ import annotations

from dataclasses import dataclass
import struct

PREFIX = bytes.fromhex("F0 7D 4E 43")
MAX_PAYLOAD = 65535
MAX_SYSEX = 6 + 65543 + (65543 + 6) // 7


class ProtocolError(ValueError):
    pass


def _uint(value: int, bits: int, name: str) -> int:
    if type(value) is not int or not 0 <= value < (1 << bits):
        raise ProtocolError(f"{name} must be an unsigned {bits}-bit integer")
    return value


def pack7(raw: bytes) -> bytes:
    out = bytearray()
    for offset in range(0, len(raw), 7):
        chunk = raw[offset:offset + 7]
        out.append(sum(((b >> 7) & 1) << i for i, b in enumerate(chunk)))
        out.extend(b & 127 for b in chunk)
    return bytes(out)


def unpack7(encoded: bytes) -> bytes:
    if any(b > 127 for b in encoded):
        raise ProtocolError("SysEx body contains a non-data MIDI byte")
    out = bytearray()
    for offset in range(0, len(encoded), 8):
        group = encoded[offset:offset + 8]
        if len(group) == 1:
            raise ProtocolError("MSB bitmap has no data")
        bitmap, chunk = group[0], group[1:]
        if bitmap >> len(chunk):
            raise ProtocolError("MSB bitmap references missing data")
        out.extend(b | (((bitmap >> i) & 1) << 7) for i, b in enumerate(chunk))
    return bytes(out)


@dataclass(frozen=True)
class Frame:
    sequence: int
    opcode: int
    payload: bytes
    status: int | None = None

    @property
    def is_response(self) -> bool:
        return self.status is not None


def encode(frame: Frame) -> bytes:
    seq = _uint(frame.sequence, 16, "sequence")
    op = _uint(frame.opcode, 16, "opcode")
    if not isinstance(frame.payload, bytes):
        raise ProtocolError("payload must be bytes")
    if len(frame.payload) > MAX_PAYLOAD:
        raise ProtocolError("payload exceeds the 16-bit length field")
    inner = struct.pack("<BHH", 2, seq, op)
    if frame.is_response:
        inner += bytes([_uint(frame.status, 8, "status")])
    inner += struct.pack("<H", len(frame.payload)) + frame.payload
    return PREFIX + bytes([0x71 if frame.is_response else 0x70]) + pack7(inner) + b"\xf7"


def decode(message: bytes) -> Frame:
    if len(message) < 6 or len(message) > MAX_SYSEX:
        raise ProtocolError("invalid message length")
    if not message.startswith(PREFIX) or message[-1] != 0xF7:
        raise ProtocolError("not a complete NC SysEx message")
    direction = message[4]
    if direction not in (0x70, 0x71):
        raise ProtocolError("unknown NC envelope")
    inner = unpack7(message[5:-1])
    response = direction == 0x71
    header_len = 8 if response else 7
    if len(inner) < header_len or inner[0] != 2:
        raise ProtocolError("invalid inner header/version")
    seq, op = struct.unpack_from("<HH", inner, 1)
    status = inner[5] if response else None
    size = struct.unpack_from("<H", inner, 6 if response else 5)[0]
    if len(inner) != header_len + size:
        raise ProtocolError("payload length mismatch")
    return Frame(seq, op, inner[header_len:], status)


def amp_slot_info(sequence: int, wire_slot: int) -> bytes:
    """Encode op 0x36; wire-slot numbering/capacity still needs live verification."""
    return encode(Frame(sequence, 0x36, bytes([_uint(wire_slot, 8, "wire_slot")])))


def amp_read(sequence: int, wire_slot: int, offset: int, length: int) -> bytes:
    _uint(wire_slot, 8, "wire_slot")
    _uint(offset, 16, "offset")
    if type(length) is not int or not 1 <= length <= 200:
        raise ProtocolError("AMP read length must be 1..200 bytes")
    if offset + length > 65536:
        raise ProtocolError("AMP read crosses the 16-bit address space")
    return encode(Frame(sequence, 0x39, struct.pack("<BHB", wire_slot, offset, length)))


class SysExStream:
    """Assemble fragmented MIDI SysEx; ignore interleaved realtime bytes.

    Feed MIDI byte streams only, not raw USB-MIDI event packets or BLE packets.
    A new F0 restarts an incomplete frame; other non-realtime status aborts it.
    """
    def __init__(self, max_size: int = MAX_SYSEX):
        if max_size < 2:
            raise ValueError("max_size must be at least 2")
        self.max_size = max_size
        self._partial: bytearray | None = None

    def feed(self, data: bytes) -> list[bytes]:
        completed = []
        for b in data:
            if b >= 0xF8:
                continue
            if b == 0xF0:
                self._partial = bytearray([b])
            elif self._partial is not None:
                if b > 0x7F and b != 0xF7:
                    self._partial = None
                    continue
                self._partial.append(b)
                if len(self._partial) > self.max_size:
                    self._partial = None
                    raise ProtocolError("SysEx exceeds size bound")
                if b == 0xF7:
                    completed.append(bytes(self._partial))
                    self._partial = None
        return completed
