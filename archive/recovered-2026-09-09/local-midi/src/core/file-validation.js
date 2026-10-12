import { parseWave } from "./wave-format.js";

const LIMITS = { nam: 64 * 1024 * 1024, nam2: 64 * 1024 * 1024, eadl: 64 * 1024 * 1024, wav: 256 * 1024 * 1024, ir: 256 * 1024 * 1024 };

export function extensionOf(name) {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

export function validateCaptureFile(file, kind) {
  if (!file || typeof file.name !== "string") throw new TypeError("A file is required");
  if (!["cabinet", "amplifier", "pedal"].includes(kind)) throw new Error("Unknown capture library");
  const extension = extensionOf(file.name);
  const allowed = kind === "cabinet" ? ["wav", "ir"] : ["nam", "nam2", "eadl"];
  if (!allowed.includes(extension)) throw new Error(`${kind === "cabinet" ? "Cabinet" : "NAM"} files must be ${allowed.map(x => `.${x}`).join(" or ")}`);
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new Error("The selected file is empty or has an invalid size");
  if (file.size > LIMITS[extension]) throw new Error(`The selected .${extension} file is too large`);
  return { extension, format: extension.toUpperCase(), size: file.size };
}

export async function inspectCaptureFile(file, kind) {
  const basic = validateCaptureFile(file, kind);
  if (basic.extension === "wav") {
    const { dataOffset, ...format } = parseWave(await file.arrayBuffer());
    const conversionReasons = [];
    if (format.sampleRate !== 44100) conversionReasons.push(`${format.sampleRate} Hz → 44100 Hz`);
    if (format.channels !== 1) conversionReasons.push(`${format.channels} channels → mono`);
    if (format.audioFormat !== 1 || format.bitsPerSample !== 24) conversionReasons.push(`${format.audioFormat === 3 ? "float" : "PCM"} ${format.bitsPerSample}-bit → PCM 24-bit`);
    return { ...basic, ...format, validContainer: true, deviceCompatibility: "unverified", conversionRequired: conversionReasons.length > 0, conversionReasons };
  }
  if (basic.extension === "eadl") return { ...basic, ...await inspectEadl(file) };
  if (basic.extension === "nam" || basic.extension === "nam2") return { ...basic, ...await inspectNam(file) };
  return { ...basic, validContainer: false, deviceCompatibility: "unverified", warning: "Opaque .ir file saved locally; its format and Mosaic compatibility have not been validated." };
}

async function inspectNam(file) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()).trimStart();
  if (!text.startsWith("{")) throw new Error("The selected NAM file is not a supported JSON NAM model");
  let model;
  try { model = JSON.parse(text); }
  catch (_) { throw new Error("The selected NAM file contains invalid JSON"); }
  if (typeof model.version !== "string" || !model.version.trim() || typeof model.architecture !== "string" || !model.architecture.trim() || !model.config || typeof model.config !== "object" || Array.isArray(model.config) || !Array.isArray(model.weights) || !model.weights.length) {
    throw new Error("The selected NAM file is missing its version, architecture, config, or weights");
  }
  if (!model.weights.every(weight => typeof weight === "number" && Number.isFinite(weight))) throw new Error("NAM weights must all be finite numbers");
  return {
    validContainer: true, modelVersion: model.version, architecture: model.architecture,
    weightCount: model.weights.length, nativeMosaicFormat: false, deviceCompatibility: "unverified", conversionRequired: true,
    warning: "NAM JSON validated; conversion to the pedal format is not implemented."
  };
}

async function inspectEadl(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 15 || String.fromCharCode(...bytes.slice(0, 4)) !== "EADL") throw new Error("The selected EADL file has an invalid header");
  const view = new DataView(bytes.buffer);
  const version = view.getUint16(4, true), metadataLength = view.getUint32(6, true);
  if (version !== 1) throw new Error(`Unsupported EADL container version ${version}`);
  if (metadataLength > 1024 * 1024 || 14 + metadataLength >= bytes.length) throw new Error("The selected EADL file has invalid metadata or an empty payload");
  let metadata;
  try { metadata = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(10, 10 + metadataLength))); }
  catch (_) { throw new Error("The selected EADL file has invalid metadata"); }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("EADL metadata must be an object");
  const payloadMagic = String.fromCharCode(...bytes.slice(10 + metadataLength, 14 + metadataLength));
  if (payloadMagic !== "SAPF") throw new Error("The selected EADL file has no SAPF model payload");
  return { validContainer: true, modelVersion: version, modelMetadata: metadata, nativeMosaicFormat: true, deviceCompatibility: "unverified", conversionRequired: false, warning: "EADL/SAPF container recognized; payload compatibility and device upload are unverified." };
}
