import test from "node:test";
import assert from "node:assert/strict";
import { MidiStreamDecoder, describeMidiEvent, hexBytes } from "../src/protocol/midi-events.js";

test("decodes channel messages, running status and packet boundaries", () => {
  const decoder = new MidiStreamDecoder();
  assert.deepEqual(decoder.push([0xB2, 25]), []);
  const events = decoder.push([127, 26, 0, 0xC2, 4]);
  assert.deepEqual(events[0], { type: "controlChange", channel: 3, controller: 25, value: 127, bytes: [0xB2, 25, 127] });
  assert.deepEqual(events[1], { type: "controlChange", channel: 3, controller: 26, value: 0, bytes: [0xB2, 26, 0] });
  assert.equal(events[2].type, "programChange");
  assert.equal(events[2].preset, 5);
});

test("reassembles SysEx while allowing interleaved realtime bytes", () => {
  const decoder = new MidiStreamDecoder();
  assert.deepEqual(decoder.push([0xF0, 0x7D, 0x4E]), []);
  const events = decoder.push([0xF8, 0x43, 0xF7]);
  assert.equal(events[0].type, "systemRealtime");
  assert.deepEqual(events[1], { type: "systemExclusive", bytes: [0xF0, 0x7D, 0x4E, 0x43, 0xF7] });
});

test("normalizes note-on velocity zero and formats diagnostics", () => {
  const [event] = new MidiStreamDecoder().push([0x90, 60, 0]);
  assert.equal(event.type, "noteOff");
  assert.match(describeMidiEvent(event), /Note 60 off/);
  assert.equal(hexBytes(event.bytes), "90 3C 00");
});
