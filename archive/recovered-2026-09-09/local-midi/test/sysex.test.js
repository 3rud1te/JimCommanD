import test from "node:test"; import assert from "node:assert/strict";
import { pack7Bit,unpack7Bit,frameMessage,parseFrame,parseAmpSlotInfoResponse } from "../src/protocol/sysex.js";
test("7-bit packing round-trips arbitrary bytes",()=>{const input=Uint8Array.from([0,127,128,255,17,200,64,129,2]);assert.deepEqual(unpack7Bit(pack7Bit(input)),input)});
test("Mosaic SysEx frame round-trips sequence, opcode and payload",()=>{const frame=frameMessage(0x1234,0x39,[30,0,0,200]);assert.ok([...frame].slice(1,-1).every(x=>x<128));const parsed=parseFrame(frame);assert.equal(parsed.sequence,0x1234);assert.equal(parsed.opcode,0x39);assert.deepEqual([...parsed.payload],[30,0,0,200])});
test("captured AMP slot response decodes",()=>{
  const frame=Uint8Array.from([0xF0,0x7D,0x4E,0x43,0x71,0x00,0x02,0x01,0x00,0x36,0x00,0x00,0x1E,0x10,0x00,0x00,0x01,0x00,0x52,0x2F,0x00,0x02,0x00,0x1A,0x44,0x0C,0x56,0x1A,0x1A,0x00,0x00,0x4D,0x61,0x72,0x73,0x68,0x61,0x00,0x6C,0x6C,0x20,0x31,0x39,0x35,0x39,0x00,0x42,0x4A,0x00,0xF7]);
  const parsed=parseAmpSlotInfoResponse(frame);
  assert.equal(parsed.sequence,1);
  assert.equal(parsed.opcode,0x36);
  assert.equal(parsed.status,0);
  assert.equal(parsed.payload.length,30);
  assert.equal(parsed.metadata.length,14);
  assert.equal(parsed.slot,0);
  assert.equal(parsed.name,"Marshall 1959BJ");
});
test("AMP slot 1 stays outside the two-byte length field",()=>{
  assert.deepEqual([...frameMessage(1,0x36,[1])],
    [0xF0,0x7D,0x4E,0x43,0x70,0,2,1,0,0x36,0,1,0,0,1,0xF7]);
  const malformed=[0xF0,0x7D,0x4E,0x43,0x70,0,2,1,0,0x36,0,1,1,0,0,0xF7];
  assert.throws(()=>parseFrame(malformed),/length mismatch/);
});
test("bad-payload response is preserved as a device error",()=>{
  const response=parseAmpSlotInfoResponse([0xF0,0x7D,0x4E,0x43,0x71,0,2,1,0,0x36,0,1,0,0,0,0xF7]);
  assert.equal(response.status,1);
  assert.equal(response.payload.length,0);
  assert.equal(response.name,null);
});
test("request length encodes both bytes",()=>{
  const payload=new Uint8Array(256).fill(0x55);
  const frame=frameMessage(1,0x36,payload);
  const inner=unpack7Bit(frame.slice(5,-1));
  assert.deepEqual([...inner.slice(5,7)],[0,1]);
  assert.deepEqual(parseFrame(frame).payload,payload);
});
test("second live capture preserves slot identity and padded model name",()=>{
  const hex="F0 7D 4E 43 71 00 02 01 00 36 00 00 1E 10 00 01 01 00 52 2F 00 08 00 64 5F 3C 44 1A 1A 00 00 42 6F 67 58 54 43 00 32 00 00 00 00 00 00 00 00 00 00 F7";
  const parsed=parseAmpSlotInfoResponse(hex.split(" ").map(x=>parseInt(x,16)));
  assert.equal(parsed.status,0);
  assert.equal(parsed.slot,1);
  assert.equal(parsed.name,"BogXTC2");
  assert.deepEqual([...parsed.metadata],[1,1,0,0xD2,0x2F,0,0,0x64,0x5F,0xBC,0x44,0x1A,0x1A,0]);
});

test("rejects corrupted packing instead of accepting disguised valid frames", () => {
  const valid = [...frameMessage(1, 0x36, [1])];
  const statusInBody = [...valid]; statusInBody[6] = 0x82;
  assert.throws(() => parseFrame(statusInBody), /7-bit/);
  const strayHighBits = [...valid]; strayHighBits[13] = 2;
  assert.throws(() => parseFrame(strayHighBits), /packing group/);
  const orphanMask = [...valid.slice(0, -1), 0, 0xF7];
  assert.throws(() => parseFrame(orphanMask), /packing group/);
  assert.throws(() => frameMessage(1, 0x36, [256]), /byte value/);
  assert.throws(() => frameMessage(1, 0x36, [-1]), /byte value/);
  assert.throws(() => parseFrame(valid.map((b, i) => i === 6 ? b + 256 : b)), /byte value/);
});
