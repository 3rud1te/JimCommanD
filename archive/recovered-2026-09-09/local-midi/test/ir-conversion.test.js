import test from "node:test";
import assert from "node:assert/strict";
import { convertWaveToMosaicIr } from "../src/core/ir-conversion.js";

test("converts stereo 48 kHz PCM16 WAV to mono 44.1 kHz PCM24", () => {
  const source = pcm16Wave(48000, 2, [[-1, 1], [-0.5, 0.5], [0.25, 0.25], [1, -1]]);
  const converted = convertWaveToMosaicIr(source.buffer);
  const view = new DataView(converted.buffer);
  assert.equal(String.fromCharCode(...converted.slice(0, 4)), "RIFF");
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint16(34, true), 24);
  assert.ok(view.getUint32(40, true) > 0);
});

test("rejects malformed and empty WAV containers", () => {
  assert.throws(() => convertWaveToMosaicIr(new Uint8Array(44).buffer), /Invalid/);
  assert.throws(() => convertWaveToMosaicIr(pcm16Wave(44100, 1, []).buffer), /no audio/);
});

function pcm16Wave(rate, channels, frames) {
  const bytes = new Uint8Array(44 + frames.length * channels * 2);
  const view = new DataView(bytes.buffer);
  put(bytes, 0, "RIFF"); view.setUint32(4, bytes.length - 8, true); put(bytes, 8, "WAVEfmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
  put(bytes, 36, "data"); view.setUint32(40, frames.length * channels * 2, true);
  frames.flat().forEach((sample, index) => view.setInt16(44 + index * 2, Math.max(-32768, Math.min(32767, Math.round(sample * 32768))), true));
  return bytes;
}
function put(bytes, offset, text) { for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i); }
