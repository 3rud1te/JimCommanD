import random
import unittest
from protocol import Frame, ProtocolError, SysExStream, amp_read, amp_slot_info, decode, encode, pack7, unpack7


class CodecTests(unittest.TestCase):
    def test_disassembly_request_vector(self):
        expected = bytes.fromhex("F0 7D 4E 43 70 00 02 01 00 39 00 04 00 08 02 2C 01 48 F7")
        self.assertEqual(amp_read(1, 2, 300, 200), expected)
        self.assertEqual(decode(expected), Frame(1, 0x39, bytes.fromhex("02 2C 01 C8")))

    def test_response_layout_independent_fixture(self):
        # Synthetic fixture for statically proven response offsets, not a live capture.
        wire = bytes.fromhex("F0 7D 4E 43 71 00 02 34 12 36 00 04 02 02 00 2A 55 F7")
        self.assertEqual(decode(wire), Frame(0x1234, 0x36, b"\xaa\x55", 4))

    def test_all_values_and_chunk_boundaries(self):
        rng = random.Random(704)
        for n in list(range(24)) + [127, 128, 199, 200, 256, 65535]:
            raw = bytes(rng.randrange(256) for _ in range(n))
            self.assertEqual(unpack7(pack7(raw)), raw)
            self.assertEqual(decode(encode(Frame(65535, 65535, raw, 255))), Frame(65535, 65535, raw, 255))
        self.assertEqual(unpack7(pack7(bytes(range(256)))), bytes(range(256)))

    def test_malformed_packing(self):
        for raw in [b"\x00", b"\x02\x00", b"\x80\x00", b"\x00\xff"]:
            with self.assertRaises(ProtocolError):
                unpack7(raw)

    def test_malformed_headers(self):
        good = amp_slot_info(1, 2)
        bad = [b"", good[:-1], b"\xf1" + good[1:], good[:4] + b"\x72" + good[5:], good + b"\x00"]
        bad.append(bytes.fromhex("F0 7D 4E 43 70") + pack7(bytes.fromhex("02 01 00 36 00 02 00 01")) + b"\xf7")
        for wire in bad:
            with self.assertRaises(ProtocolError):
                decode(wire)

    def test_validation(self):
        for args in [(-1, 0, 0, 1), (1, 256, 0, 1), (1, 0, -1, 1), (1, 0, 0, 201), (1, 0, 0, 0), (1, 0, 65535, 2)]:
            with self.assertRaises(ProtocolError):
                amp_read(*args)
        with self.assertRaises(ProtocolError):
            encode(Frame(1, 2, b"x" * 65536))

    def test_fragmentation_and_realtime(self):
        wire = amp_slot_info(12, 2)
        for cut in range(len(wire) + 1):
            stream = SysExStream()
            result = stream.feed(wire[:cut]) + stream.feed(b"\xf8\xfe") + stream.feed(wire[cut:])
            self.assertEqual(result, [wire])

    def test_stream_reset_multiple_and_size_limit(self):
        stream = SysExStream()
        self.assertEqual(stream.feed(b"\x90\x01\x02\xf0\x01\x90"), [])
        wire = amp_slot_info(4, 1)
        self.assertEqual(stream.feed(b"\xf0\x01" + wire + wire), [wire, wire])
        stream = SysExStream(max_size=4)
        with self.assertRaises(ProtocolError):
            stream.feed(b"\xf0\x01\x02\x03\x04")
        self.assertEqual(stream.feed(b"\xf0\xf7"), [b"\xf0\xf7"])


if __name__ == "__main__":
    unittest.main()
