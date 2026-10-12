import { parseWave } from "./wave-format.js";
const TARGET_RATE = 44100;

export async function prepareCabinetIr(file, inspection) {
  if (inspection.extension !== "wav" || !inspection.conversionRequired) return file;
  const converted = convertWaveToMosaicIr(await file.arrayBuffer());
  const stem = file.name.replace(/\.[^.]+$/, "");
  const name = `${stem}-44k1-mono.wav`;
  if (typeof File === "function") return new File([converted], name, { type: "audio/wav", lastModified: file.lastModified || Date.now() });
  const blob = new Blob([converted], { type: "audio/wav" });
  Object.defineProperty(blob, "name", { value: name });
  return blob;
}

export function convertWaveToMosaicIr(input) {
  const bytes = new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parsed = parseWave(bytes);
  const format = { code: parsed.audioFormat, channels: parsed.channels, rate: parsed.sampleRate, blockAlign: parsed.blockAlign, bits: parsed.bitsPerSample };
  const dataOffset = parsed.dataOffset;
  const frames = parsed.frames;
  const outputFrames = Math.max(1, Math.round(frames * TARGET_RATE / format.rate));
  // Memory guard for the local editor; this is not a pedal storage limit.
  if (frames > 16 * 1024 * 1024 || outputFrames > 16 * 1024 * 1024) throw new Error("IR conversion exceeds the local editor sample limit");
  const mono = new Float32Array(frames);
  const bytesPerSample = format.bits / 8;
  for (let frame = 0; frame < frames; frame++) {
    let sum = 0;
    for (let channel = 0; channel < format.channels; channel++) {
      const offset = dataOffset + frame * format.blockAlign + channel * bytesPerSample;
      sum += readSample(view, offset, format.code, format.bits);
    }
    mono[frame] = sum / format.channels;
  }
  const resampled = new Float32Array(outputFrames);
  const ratio = format.rate / TARGET_RATE;
  if (format.rate === TARGET_RATE) resampled.set(mono);
  else {
    // Windowed-sinc low-pass resampling prevents the aliasing of linear interpolation
    // when a source IR contains frequencies above the target Nyquist frequency.
    const cutoff = Math.min(1, TARGET_RATE / format.rate);
    const radius = Math.ceil(32 / cutoff);
    if (radius > 4096) throw new Error("WAV sample rate is outside the local converter range");
    for (let i = 0; i < outputFrames; i++) {
      const position = i * ratio;
      let sum = 0, weightSum = 0;
      for (let j = Math.ceil(position - radius); j <= Math.floor(position + radius); j++) {
        const distance = position - j;
        const x = Math.PI * distance * cutoff;
        const sinc = Math.abs(x) < 1e-10 ? 1 : Math.sin(x) / x;
        const window = 0.42 + 0.5 * Math.cos(Math.PI * distance / radius) + 0.08 * Math.cos(2 * Math.PI * distance / radius);
        const weight = cutoff * sinc * window;
        // Outside the IR is silence, not repetition of the first/last sample.
        if (j >= 0 && j < frames) sum += mono[j] * weight;
        weightSum += weight;
      }
      resampled[i] = sum / weightSum;
    }
  }
  return encodePcm24Wave(resampled, TARGET_RATE);
}

function readSample(view, offset, code, bits) {
  if (code === 3 && bits === 32) return view.getFloat32(offset, true);
  if (code !== 1) throw new Error("Only PCM and 32-bit float WAV files can be converted");
  if (bits === 8) return (view.getUint8(offset) - 128) / 128;
  if (bits === 16) return view.getInt16(offset, true) / 32768;
  if (bits === 24) {
    let value = view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
    if (value & 0x800000) value |= 0xFF000000;
    return value / 8388608;
  }
  if (bits === 32) return view.getInt32(offset, true) / 2147483648;
  throw new Error(`Unsupported PCM bit depth: ${bits}`);
}

function encodePcm24Wave(samples, rate) {
  const dataSize = samples.length * 3;
  const bytes = new Uint8Array(44 + dataSize + (dataSize & 1));
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, "RIFF"); view.setUint32(4, bytes.length - 8, true);
  writeAscii(bytes, 8, "WAVE"); writeAscii(bytes, 12, "fmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 3, true); view.setUint16(32, 3, true); view.setUint16(34, 24, true);
  writeAscii(bytes, 36, "data"); view.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1 - 1 / 8388608, samples[i]));
    const value = Math.round(clamped * 8388608);
    const offset = 44 + i * 3;
    bytes[offset] = value & 0xFF; bytes[offset + 1] = (value >> 8) & 0xFF; bytes[offset + 2] = (value >> 16) & 0xFF;
  }
  return bytes;
}

function ascii(bytes, offset, count) { return String.fromCharCode(...bytes.slice(offset, offset + count)); }
function writeAscii(bytes, offset, text) { for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i); }
