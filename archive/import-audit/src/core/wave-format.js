// Container validation only. A valid WAV does not establish pedal compatibility.
export function parseWave(input) {
  const waveBytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const waveView = new DataView(waveBytes.buffer, waveBytes.byteOffset, waveBytes.byteLength);
  const tag = offset => String.fromCharCode(...waveBytes.subarray(offset, offset + 4));
  if (waveBytes.length < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("Invalid RIFF/WAVE header");
  const end = waveView.getUint32(4, true) + 8;
  if (end !== waveBytes.length) throw new Error("WAV RIFF length does not match the file");
  let waveFormat = null, waveDataOffset = -1, waveDataSize = 0;
  for (let offset = 12; offset < end;) {
    if (offset + 8 > end) throw new Error("Truncated WAV chunk header");
    const id = tag(offset), size = waveView.getUint32(offset + 4, true), body = offset + 8;
    if (body + size + (size & 1) > end) throw new Error("Truncated WAV chunk or missing padding");
    if (id === "fmt ") {
      if (waveFormat || size < 16) throw new Error("Invalid or duplicate WAV format chunk");
      waveFormat = {
        audioFormat: waveView.getUint16(body, true), channels: waveView.getUint16(body + 2, true),
        sampleRate: waveView.getUint32(body + 4, true), byteRate: waveView.getUint32(body + 8, true),
        blockAlign: waveView.getUint16(body + 12, true), bitsPerSample: waveView.getUint16(body + 14, true)
      };
    } else if (id === "data") {
      if (waveDataOffset !== -1) throw new Error("Multiple WAV data chunks are not supported");
      waveDataOffset = body; waveDataSize = size;
    }
    offset = body + size + (size & 1);
  }
  if (!waveFormat || waveDataOffset < 0) throw new Error("WAV format or audio data is missing");
  const { audioFormat, channels, sampleRate, byteRate, blockAlign, bitsPerSample } = waveFormat;
  if (![1, 3].includes(audioFormat) || (audioFormat === 1 ? ![8, 16, 24, 32].includes(bitsPerSample) : bitsPerSample !== 32)) throw new Error("Unsupported WAV encoding or bit depth");
  if (channels < 1 || channels > 2) throw new Error("Cabinet IR WAV files must be mono or stereo");
  if (!sampleRate || blockAlign !== channels * bitsPerSample / 8 || byteRate !== sampleRate * blockAlign) throw new Error("Invalid WAV sample rate, byte rate or block alignment");
  if (!waveDataSize) throw new Error("WAV contains no audio samples");
  if (waveDataSize % blockAlign) throw new Error("WAV audio ends within a sample frame");
  if (audioFormat === 3) {
    for (let offset = waveDataOffset; offset < waveDataOffset + waveDataSize; offset += 4) {
      if (!Number.isFinite(waveView.getFloat32(offset, true))) throw new Error("WAV contains non-finite audio samples");
    }
  }
  return { ...waveFormat, dataOffset: waveDataOffset, dataSize: waveDataSize, frames: waveDataSize / blockAlign };
}
