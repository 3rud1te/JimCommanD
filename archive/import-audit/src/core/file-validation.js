const LIMITS = { nam: 64 * 1024 * 1024, nam2: 64 * 1024 * 1024, eadl: 64 * 1024 * 1024, wav: 256 * 1024 * 1024, ir: 256 * 1024 * 1024 };

export function extensionOf(name) {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

export function validateCaptureFile(file, kind) {
  if (!file || typeof file.name !== "string") throw new TypeError("A file is required");
  const extension = extensionOf(file.name);
  const allowed = kind === "cabinet" ? ["wav", "ir"] : ["nam", "nam2", "eadl"];
  if (!allowed.includes(extension)) throw new Error(`${kind === "cabinet" ? "Cabinet" : "NAM"} files must be ${allowed.map(x => `.${x}`).join(" or ")}`);
  if (file.size <= 0) throw new Error("The selected file is empty");
  if (file.size > LIMITS[extension]) throw new Error(`The selected .${extension} file is too large`);
  return { extension, format: extension.toUpperCase(), size: file.size };
}

export async function inspectCaptureFile(file, kind) {
  const basic = validateCaptureFile(file, kind);
  if (basic.extension === "wav") return { ...basic, ...await inspectWave(file) };
  if (basic.extension === "eadl") return { ...basic, ...await inspectEadl(file) };
  if (basic.extension === "nam" || basic.extension === "nam2") return { ...basic, ...await inspectNam(file) };
  return { ...basic, validContainer: true, warning: "Proprietary .ir container; device compatibility will be verified before upload." };
}

async function inspectNam(file) {
  const text = new TextDecoder().decode(await file.arrayBuffer()).trimStart();
  if (!text.startsWith("{")) throw new Error("The selected NAM file is not a JSON NAM model");
  let model;
  try { model = JSON.parse(text); }
  catch (_) { throw new Error("The selected NAM file contains invalid JSON"); }
  if (typeof model.version !== "string" || typeof model.architecture !== "string" || !Array.isArray(model.weights) || !model.weights.length) {
    throw new Error("The selected NAM file is missing its version, architecture, or weights");
  }
  return {
    validContainer: true, modelVersion: model.version, architecture: model.architecture,
    weightCount: model.weights.length, nativeMosaicFormat: false, conversionRequired: true
  };
}

async function inspectEadl(file) {
  const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 64 * 1024)).arrayBuffer());
  if (bytes.length < 14 || String.fromCharCode(...bytes.slice(0, 4)) !== "EADL") throw new Error("The selected EADL file has an invalid header");
  const version = bytes[4] | (bytes[5] << 8);
  const metadataLength = read32(bytes, 6);
  if (metadataLength > bytes.length - 10 || 10 + metadataLength >= file.size) throw new Error("The selected EADL file has invalid metadata length");
  let metadata;
  try { metadata = JSON.parse(new TextDecoder().decode(bytes.slice(10, 10 + metadataLength))); }
  catch (_) { throw new Error("The selected EADL file has invalid metadata"); }
  const payloadMagic = String.fromCharCode(...bytes.slice(10 + metadataLength, 14 + metadataLength));
  if (payloadMagic !== "SAPF") throw new Error("The selected EADL file has no SAPF model payload");
  return { validContainer: true, modelVersion: version, modelMetadata: metadata, nativeMosaicFormat: true, conversionRequired: false };
}

async function inspectWave(file) {
  const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer());
  if (bytes.length < 44 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") throw new Error("The selected WAV file has an invalid RIFF/WAVE header");
  let format = null;
  let dataSize = null;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = ascii(bytes, offset, 4);
    const size = read32(bytes, offset + 4);
    const body = offset + 8;
    if (size > file.size || body + Math.min(size, 16) > bytes.length) break;
    if (id === "fmt " && size >= 16) {
      format = {
        audioFormat: read16(bytes, body), channels: read16(bytes, body + 2),
        sampleRate: read32(bytes, body + 4), bitsPerSample: read16(bytes, body + 14)
      };
    }
    if (id === "data") { dataSize = size; break; }
    offset = body + size + (size & 1);
  }
  if (!format) throw new Error("The selected WAV file has no readable format chunk");
  if (![1, 3].includes(format.audioFormat)) throw new Error(`WAV encoding ${format.audioFormat} is not supported`);
  if (format.channels < 1 || format.channels > 2) throw new Error("Cabinet IR WAV files must be mono or stereo");
  const conversionReasons = [];
  if (format.sampleRate !== 44100) conversionReasons.push(`${format.sampleRate} Hz → 44100 Hz`);
  if (format.channels !== 1) conversionReasons.push(`${format.channels} channels → mono`);
  return {
    ...format, dataSize, validContainer: true,
    conversionRequired: conversionReasons.length > 0,
    conversionReasons
  };
}

function ascii(bytes, offset, count) { return String.fromCharCode(...bytes.slice(offset, offset + count)); }
function read16(bytes, offset) { return bytes[offset] | (bytes[offset + 1] << 8); }
function read32(bytes, offset) { return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0; }
