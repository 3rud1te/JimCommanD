export const REQUEST_HEADER = Uint8Array.of(0xF0, 0x7D, 0x4E, 0x43, 0x70);
export const RESPONSE_HEADER = Uint8Array.of(0xF0, 0x7D, 0x4E, 0x43, 0x71);
export const OUTER_HEADER = REQUEST_HEADER;
export const SYSEX_END = 0xF7;

export function pack7Bit(bytes) {
  const input = checkedBytes(bytes); const output = [];
  for (let offset = 0; offset < input.length; offset += 7) {
    const group = input.slice(offset, offset + 7); let msb = 0;
    group.forEach((value, i) => { if (value & 0x80) msb |= 1 << i; });
    output.push(msb, ...group.map(value => value & 0x7F));
  }
  return Uint8Array.from(output);
}

export function unpack7Bit(bytes) {
  const input = checkedBytes(bytes); const output = [];
  if (input.some(value => value > 0x7F)) throw new Error("SysEx body must contain 7-bit data");
  for (let offset = 0; offset < input.length;) {
    const msb = input[offset++];
    const count = Math.min(7, input.length - offset);
    if (!count || msb >> count) throw new Error("Invalid final 7-bit packing group");
    for (let i = 0; i < count; i++, offset++) output.push(input[offset] | (((msb >> i) & 1) << 7));
  }
  return Uint8Array.from(output);
}

function checkedBytes(values) {
  if (values == null || typeof values[Symbol.iterator] !== "function") throw new TypeError("Expected byte sequence");
  const bytes = Array.from(values);
  if (bytes.some(value => !Number.isInteger(value) || value < 0 || value > 255)) throw new RangeError("Invalid byte value");
  return Uint8Array.from(bytes);
}

export function buildInnerMessage(sequence, opcode, payload = []) {
  if (!Number.isInteger(sequence) || sequence < 0 || sequence > 0xFFFF) throw new RangeError("Sequence out of range");
  if (!Number.isInteger(opcode) || opcode < 0 || opcode > 0xFFFF) throw new RangeError("Opcode out of range");
  const data = checkedBytes(payload);
  if (data.length > 0xFFFF) throw new RangeError("Payload too large for one Mosaic message");
  const out = new Uint8Array(7 + data.length);
  out[0] = 0x02;
  write16(out, 1, sequence);
  write16(out, 3, opcode);
  write16(out, 5, data.length);
  out.set(data, 7);
  return out;
}

export function frameMessage(sequence, opcode, payload = []) {
  const packed = pack7Bit(buildInnerMessage(sequence, opcode, payload));
  return Uint8Array.from([...OUTER_HEADER, ...packed, SYSEX_END]);
}

export function parseFrame(frame) {
  const bytes = checkedBytes(frame);
  assertFrame(bytes, REQUEST_HEADER);
  const inner = unpack7Bit(bytes.slice(REQUEST_HEADER.length, -1));
  if (inner.length < 7 || inner[0] !== 0x02) throw new Error("Unsupported or truncated inner message");
  const length = read16(inner, 5);
  if (inner.length !== 7 + length) throw new Error("Payload length mismatch");
  return {
    sequence: read16(inner, 1),
    opcode: read16(inner, 3),
    payload: inner.slice(7),
  };
}

export function parseResponseFrame(frame) {
  const bytes = checkedBytes(frame);
  assertFrame(bytes, RESPONSE_HEADER);
  const inner = unpack7Bit(bytes.slice(RESPONSE_HEADER.length, -1));
  if (inner.length < 8 || inner[0] !== 0x02) throw new Error("Unsupported or truncated inner message");
  const length = read16(inner, 6);
  if (inner.length !== 8 + length) throw new Error("Response payload length mismatch");
  return {
    sequence: read16(inner, 1),
    opcode: read16(inner, 3),
    status: inner[5],
    payload: inner.slice(8),
  };
}

export function parseAmpSlotInfoResponse(frame) {
  const response = parseResponseFrame(frame);
  if (response.opcode !== 0x36) throw new Error("Not an amplifier slot-info response");
  if (response.status !== 0) return { ...response, metadata: null, name: null };
  // Vendor parser at 0xd5994 requires 30 bytes, checks slot at offset 0,
  // and reads a bounded, NUL-terminated name at offsets 14..29.
  if (response.payload.length < 30) throw new Error("Amplifier slot-info payload is too short");
  const metadata = response.payload.slice(0, 14);
  const nameBytes = response.payload.slice(14, 30);
  const zero = nameBytes.indexOf(0);
  const name = new TextDecoder().decode(zero === -1 ? nameBytes : nameBytes.slice(0, zero));
  return { ...response, slot: response.payload[0], metadata, name };
}

function write16(target, offset, value) { target[offset] = value & 0xFF; target[offset + 1] = value >> 8; }
function read16(source, offset) { return source[offset] | (source[offset + 1] << 8); }
function assertFrame(bytes, header) {
  if (bytes.length < 7 || !header.every((value, index) => bytes[index] === value) || bytes.at(-1) !== SYSEX_END) {
    throw new Error("Invalid Mosaic SysEx frame");
  }
}
