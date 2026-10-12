import { slotNumber, type Asset, type LibraryKind } from './project.ts'

export const MAX_ASSET_BYTES = 32 * 1024 * 1024 // Editor limit, not a Mosaic capacity claim.
type FileLike = { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }
const ascii = (view: DataView, start: number, length: number) =>
  String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + start, length))

/** Inspect a RIFF container without changing, resampling or claiming device support. */
export function inspectWav(buffer: ArrayBuffer): string {
  const v = new DataView(buffer)
  if (v.byteLength < 12 || ascii(v, 0, 4) !== 'RIFF' || ascii(v, 8, 4) !== 'WAVE')
    throw new Error('The WAV file is not a RIFF/WAVE container.')
  const end = v.getUint32(4, true) + 8
  if (end !== v.byteLength) throw new Error('WAV container size is inconsistent or truncated.')
  let format: { channels: number; rate: number; align: number; bits: number; code: number } | undefined
  let dataBytes: number | undefined
  for (let p = 12; p < end;) {
    if (p + 8 > end) throw new Error('Truncated WAV chunk header.')
    const id = ascii(v, p, 4), size = v.getUint32(p + 4, true), start = p + 8
    const next = start + size + (size % 2)
    if (next > end) throw new Error('Truncated WAV chunk.')
    if (id === 'fmt ') {
      if (format || size < 16) throw new Error('Invalid WAV format chunk.')
      const code = v.getUint16(start, true), channels = v.getUint16(start + 2, true)
      const rate = v.getUint32(start + 4, true), byteRate = v.getUint32(start + 8, true)
      const align = v.getUint16(start + 12, true), bits = v.getUint16(start + 14, true)
      if (![1, 3].includes(code)) throw new Error('This editor currently inspects PCM or IEEE float WAV files only.')
      if (!channels || !rate || !align || ![8, 16, 24, 32, 64].includes(bits) ||
          (code === 3 && ![32, 64].includes(bits)) || align !== channels * bits / 8 || byteRate !== rate * align)
        throw new Error('WAV sample format is inconsistent.')
      format = { channels, rate, align, bits, code }
    }
    if (id === 'data') {
      if (dataBytes !== undefined) throw new Error('Multiple WAV data chunks are not supported by this inspector.')
      dataBytes = size
    }
    p = next
  }
  if (!format || !dataBytes || dataBytes % format.align) throw new Error('WAV has no complete audio samples.')
  const ms = dataBytes / format.align / format.rate * 1000
  return `${format.channels} channel${format.channels === 1 ? '' : 's'} · ${format.rate} Hz · ${format.bits}-bit ${format.code === 3 ? 'float' : 'PCM'} · ${ms.toFixed(1)} ms. Device compatibility unverified.`
}

export async function inspectAsset(file: FileLike, kind: LibraryKind, slot: number): Promise<Asset> {
  slotNumber(kind, slot)
  if (!file.size || file.size > MAX_ASSET_BYTES) throw new Error('Choose a non-empty file up to 32 MB (editor limit).')
  if (!file.name || file.name.length > 255) throw new Error('Invalid file name.')
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!(kind === 'CABINET' ? ['wav', 'ir'] : ['nam', 'nam2']).includes(extension))
    throw new Error(kind === 'CABINET' ? 'Choose a .wav or .ir file.' : 'Choose a .nam or .nam2 file.')
  const buffer = await file.arrayBuffer()
  if (buffer.byteLength !== file.size) throw new Error('File changed while being read.')
  let summary: string
  let displayName: string | undefined
  if (extension === 'nam') {
    let model: unknown
    try { model = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)) }
    catch { throw new Error('The .nam file is not valid UTF-8 JSON.') }
    if (!model || typeof model !== 'object' || Array.isArray(model)) throw new Error('NAM JSON must contain a model object.')
    const m = model as Record<string, unknown>
    const metadata = m.metadata as Record<string, unknown> | undefined
    if (metadata && typeof metadata.name === 'string' && metadata.name.trim() && metadata.name.trim().length <= 120)
      displayName = metadata.name.trim()
    if (typeof m.architecture !== 'string' || !m.architecture.trim() || m.architecture.length > 100 ||
        typeof m.version !== 'string' || !m.version.trim() || m.version.length > 30 ||
        !m.config || typeof m.config !== 'object' || Array.isArray(m.config) ||
        !Array.isArray(m.weights) || !m.weights.length || !m.weights.every(w => typeof w === 'number' && Number.isFinite(w)))
      throw new Error('NAM needs version, architecture, configuration and finite numeric weights. This inspector may not support newer formats.')
    summary = `${m.architecture} · NAM ${m.version} · ${m.weights.length.toLocaleString('en-GB')} weights. Device compatibility unverified.`
  } else if (extension === 'wav') {
    summary = inspectWav(buffer)
  } else {
    summary = 'Fingerprint recorded. This format’s contents and device compatibility are unverified.'
  }
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  const sha256 = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
  return { kind, slot, name: file.name, bytes: buffer.byteLength, sha256, format: extension.toUpperCase(), summary, inspectedAt: new Date().toISOString(), ...(displayName ? { displayName } : {}) }
}
