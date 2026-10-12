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
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") throw new Error("Invalid RIFF/WAVE file");
  let format = null;
  let dataOffset = -1;
  let dataSize = 0;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (body + size > bytes.length) throw new Error("Truncated WAV chunk");
    if (id === "fmt " && size >= 16) {
      format = {
        code: view.getUint16(body, true), channels: view.getUint16(body + 2, true),
        rate: view.getUint32(body + 4, true), blockAlign: view.getUint16(body + 12, true),
        bits: view.getUint16(body + 14, true)
      };
    } else if (id === "data") {
      dataOffset = body;
      dataSize = size;
      break;
    }
    offset = body + size + (size & 1);
  }
  if (!format || dataOffset < 0) throw new Error("WAV format or audio data is missing");
  if (![1, 3].includes(format.code) || format.channels < 1 || format.channels > 2) throw new Error("Unsupported WAV encoding");
  const frames = Math.floor(dataSize / format.blockAlign);
  if (!frames) throw new Error("WAV contains no audio samples");
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
  const outputFrames = Math.max(1, Math.round(frames * TARGET_RATE / format.rate));
  const resampled = new Float32Array(outputFrames);
  const ratio = format.rate / TARGET_RATE;
  for (let i = 0; i < outputFrames; i++) {
    const position = Math.min(frames - 1, i * ratio);
    const left = Math.floor(position);
    const right = Math.min(frames - 1, left + 1);
    const fraction = position - left;
    resampled[i] = mono[left] + (mono[right] - mono[left]) * fraction;
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
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, "RIFF"); view.setUint32(4, 36 + dataSize, true);
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
