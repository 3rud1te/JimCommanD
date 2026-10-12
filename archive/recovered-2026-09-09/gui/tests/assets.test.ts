import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { inspectAsset, inspectWav, MAX_ASSET_BYTES } from '../src/assets.ts'

function file(name: string, content: string | Uint8Array) {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content
  return { name, size: bytes.length, async arrayBuffer(): Promise<ArrayBuffer> { return Uint8Array.from(bytes).buffer } }
}
const nam = { version: '0.5.4', architecture: 'WaveNet', config: {}, weights: [0, 0.25, -0.5] }

function chunk(id: string, data: Buffer): Buffer {
  const header = Buffer.alloc(8)
  header.write(id, 0, 'ascii')
  header.writeUInt32LE(data.length, 4)
  return Buffer.concat([header, data, Buffer.alloc(data.length % 2)])
}
function fmt({ code = 1, channels = 1, rate = 48000, bits = 16, align = channels * bits / 8, byteRate = rate * align } = {}): Buffer {
  const data = Buffer.alloc(16)
  data.writeUInt16LE(code, 0); data.writeUInt16LE(channels, 2); data.writeUInt32LE(rate, 4)
  data.writeUInt32LE(byteRate, 8); data.writeUInt16LE(align, 12); data.writeUInt16LE(bits, 14)
  return chunk('fmt ', data)
}
function wav(...chunks: Buffer[]): ArrayBuffer {
  const body = Buffer.concat([Buffer.from('WAVE'), ...chunks])
  const header = Buffer.alloc(8)
  header.write('RIFF'); header.writeUInt32LE(body.length, 4)
  return Uint8Array.from(Buffer.concat([header, body])).buffer
}

test('NAM inspection fingerprints original bytes and records local slot identity', async () => {
  const content = JSON.stringify(nam, null, 2)
  const result = await inspectAsset(file('My Capture.NAM', content), 'PEDAL', 10)
  assert.equal(result.sha256, createHash('sha256').update(content).digest('hex'))
  assert.equal(result.kind, 'PEDAL')
  assert.equal(result.slot, 10)
  assert.equal(result.bytes, Buffer.byteLength(content))
  assert.equal(result.format, 'NAM')
  assert.match(result.summary, /WaveNet.*3 weights.*compatibility unverified/)
  assert.ok(Number.isFinite(Date.parse(result.inspectedAt)))
})

test('invalid or incomplete NAM is rejected instead of accepted by its extension', async () => {
  for (const content of ['broken', 'null', '[]', JSON.stringify({ ...nam, weights: [] }),
    JSON.stringify({ ...nam, weights: ['0.5'] }), JSON.stringify({ ...nam, config: [] }),
    JSON.stringify({ ...nam, architecture: '' }), JSON.stringify({ ...nam, version: 1 }),
    '{"version":"1","architecture":"WaveNet","config":{},"weights":[1e999]}']) {
    await assert.rejects(inspectAsset(file('model.nam', content), 'AMPLIFIER', 1))
  }
  await assert.rejects(inspectAsset(file('model.nam', Uint8Array.of(0xc3, 0x28)), 'AMPLIFIER', 1), /UTF-8 JSON/)
})

test('file size, extension, target bounds and changed file checks run before accepting metadata', async () => {
  let reads = 0
  const blocked = { name: 'capture.nam', size: MAX_ASSET_BYTES + 1, async arrayBuffer() { reads++; return new ArrayBuffer(0) } }
  await assert.rejects(inspectAsset(blocked, 'AMPLIFIER', 1), /32 MB/)
  await assert.rejects(inspectAsset({ ...blocked, size: 0 }, 'AMPLIFIER', 1), /non-empty/)
  assert.equal(reads, 0)
  await assert.rejects(inspectAsset(file('capture.nam', '{}'), 'AMPLIFIER', 21), /position/)
  await assert.rejects(inspectAsset(file('capture.wav', '{}'), 'PEDAL', 1), /nam/)
  await assert.rejects(inspectAsset(file('capture.nam', '{}'), 'CABINET', 1), /wav/)
  await assert.rejects(inspectAsset({ ...file('capture.nam', '{}'), size: 3 }, 'AMPLIFIER', 1), /changed/)
})

test('opaque NAM2 and IR files retain explicit uncertainty and distinct fingerprints', async () => {
  const first = await inspectAsset(file('capture.nam2', Uint8Array.of(1, 2, 3)), 'AMPLIFIER', 20)
  const second = await inspectAsset(file('cab.ir', Uint8Array.of(1, 2, 4)), 'CABINET', 30)
  assert.match(first.summary, /contents and device compatibility are unverified/)
  assert.match(second.summary, /contents and device compatibility are unverified/)
  assert.notEqual(first.sha256, second.sha256)
})

test('WAV inspector supports padded metadata chunks and audio data before the format chunk', () => {
  const normal = inspectWav(wav(chunk('JUNK', Buffer.from([1, 2, 3])), fmt(), chunk('data', Buffer.alloc(960))))
  assert.match(normal, /1 channel · 48000 Hz · 16-bit PCM · 10\.0 ms/)
  const reordered = inspectWav(wav(chunk('data', Buffer.alloc(3840)), fmt({ code: 3, channels: 2, bits: 32 })))
  assert.match(reordered, /2 channels · 48000 Hz · 32-bit float · 10\.0 ms/)
})

test('WAV rejects truncated sizes, duplicate chunks and inconsistent sample formats', () => {
  const good = wav(fmt(), chunk('data', Buffer.alloc(2)))
  const oversizedChunk = good.slice(0)
  new DataView(oversizedChunk).setUint32(40, 1000, true)
  const unsupported = [
    new ArrayBuffer(0), good.slice(0, -1), oversizedChunk,
    wav(fmt(), fmt(), chunk('data', Buffer.alloc(2))),
    wav(fmt(), chunk('data', Buffer.alloc(2)), chunk('data', Buffer.alloc(2))),
    wav(fmt(), chunk('data', Buffer.alloc(0))),
    wav(fmt(), chunk('data', Buffer.alloc(3))),
    wav(fmt({ byteRate: 100 }), chunk('data', Buffer.alloc(2))),
    wav(fmt({ code: 3, bits: 16 }), chunk('data', Buffer.alloc(2))),
    wav(fmt({ code: 6 }), chunk('data', Buffer.alloc(2))),
    wav(fmt({ channels: 0 }), chunk('data', Buffer.alloc(2))),
    wav(fmt({ rate: 0 }), chunk('data', Buffer.alloc(2))),
    wav(chunk('data', Buffer.alloc(2))),
  ]
  for (const buffer of unsupported) assert.throws(() => inspectWav(buffer))
})

test('WAV file workflow hashes the whole container without resampling it', async () => {
  const buffer = wav(fmt(), chunk('data', Buffer.alloc(960)))
  const result = await inspectAsset(file('Cabinet.wav', new Uint8Array(buffer)), 'CABINET', 3)
  assert.equal(result.sha256, createHash('sha256').update(new Uint8Array(buffer)).digest('hex'))
  assert.equal(result.bytes, buffer.byteLength)
  assert.match(result.summary, /compatibility unverified/)
})
