import test from 'node:test'
import assert from 'node:assert/strict'
import { initialDraft, parseDraft, encodeDraft, withAsset, slotNumber, MAX_PROJECT_BYTES, type Asset } from '../src/project.ts'

const asset = (kind: Asset['kind'], slot: number, name = 'capture.nam'): Asset => ({
  kind, slot, name, bytes: 100, sha256: 'ab'.repeat(32), format: 'NAM',
  summary: 'Inspected locally; device compatibility unverified.', inspectedAt: '2026-09-07T12:00:00.000Z',
})

test('draft export and import preserve edited rig and separate library positions', () => {
  let draft = initialDraft()
  draft.name = 'Evening rig 🎸'
  draft.inputGain = -6.5
  draft.outputLevel = 42
  draft.selectedAmpSlot = 20
  draft.selectedPedalSlot = 10
  draft.selectedCabSlot = 30
  draft.chain.find(b => b.id === 'amp')!.params[0].value = 35
  draft.chain.find(b => b.id === 'mod')!.enabled = true
  for (const item of [asset('AMPLIFIER', 1), asset('AMPLIFIER', 20), asset('PEDAL', 1), asset('PEDAL', 10), asset('CABINET', 30)])
    draft = withAsset(draft, item)
  const text = encodeDraft(draft)
  assert.deepEqual(parseDraft(text), draft)
  assert.equal(encodeDraft(parseDraft(text)), text)
})

test('replacing one library position keeps other libraries and original draft intact', () => {
  const original = initialDraft()
  original.assets = [asset('AMPLIFIER', 1), asset('AMPLIFIER', 2), asset('PEDAL', 1)]
  const updated = withAsset(original, asset('AMPLIFIER', 1, 'replacement.nam'))
  assert.equal(original.assets[0].name, 'capture.nam')
  assert.equal(updated.assets.length, 3)
  assert.equal(updated.assets.find(a => a.kind === 'AMPLIFIER' && a.slot === 1)?.name, 'replacement.nam')
  assert.equal(updated.assets.find(a => a.kind === 'AMPLIFIER' && a.slot === 2)?.name, 'capture.nam')
  assert.equal(updated.assets.find(a => a.kind === 'PEDAL')?.name, 'capture.nam')
})

test('untrusted imports cannot change parameter ranges, design metadata or device state', () => {
  const raw = JSON.parse(encodeDraft(initialDraft()))
  raw.connected = true
  raw.hardwareSlot = 255
  raw.chain[0].label = 'Imposter'
  raw.chain[0].params[0].min = -9999
  raw.chain[0].params[0].max = 9999
  raw.chain.reverse()
  const parsed = parseDraft(JSON.stringify(raw))
  assert.deepEqual(parsed, initialDraft())
  raw.chain.find((b: { id: string }) => b.id === 'fx1').params[0].value = -9999
  assert.throws(() => parseDraft(JSON.stringify(raw)), /between/)
})

test('incomplete, duplicated or wrong-version imports fail without changing the existing draft', () => {
  const existing = initialDraft()
  const before = encodeDraft(existing)
  const mutations = [
    (d: any) => { d.version = 2 },
    (d: any) => { d.schema = 'another-app' },
    (d: any) => { d.chain.pop() },
    (d: any) => { d.chain[1] = d.chain[0] },
    (d: any) => { d.chain[0].id = 'unknown' },
    (d: any) => { d.chain[0].enabled = 'true' },
    (d: any) => { d.chain[0].params[1] = d.chain[0].params[0] },
    (d: any) => { d.chain[0].params[0].name = 'unknown' },
    (d: any) => { d.chain[0].params[0].value = null },
    (d: any) => { d.name = ' ' },
  ]
  for (const mutate of mutations) {
    const imported = JSON.parse(before)
    mutate(imported)
    assert.throws(() => parseDraft(JSON.stringify(imported)))
    assert.equal(encodeDraft(existing), before)
  }
  for (const malformed of ['{', 'null', '[]']) assert.throws(() => parseDraft(malformed))
})

test('gain, level and library positions reject invalid values and accept boundaries', () => {
  for (const [key, bad] of [
    ['inputGain', -12.01], ['inputGain', 12.01], ['inputGain', '0'],
    ['outputLevel', -1], ['outputLevel', 101], ['outputLevel', null],
    ['selectedAmpSlot', 21], ['selectedPedalSlot', 11], ['selectedCabSlot', 31],
    ['selectedAmpSlot', 0], ['selectedAmpSlot', 1.5],
  ]) {
    assert.throws(() => parseDraft(JSON.stringify({ ...initialDraft(), [key as string]: bad })))
  }
  for (const kind of ['AMPLIFIER', 'PEDAL', 'CABINET'] as const) {
    for (const invalid of [NaN, Infinity, -Infinity, '1', null, 0, 1.1]) assert.throws(() => slotNumber(kind, invalid))
    assert.equal(slotNumber(kind, 1), 1)
  }
  const boundary = { ...initialDraft(), inputGain: -12, outputLevel: 100, selectedAmpSlot: 20, selectedPedalSlot: 10, selectedCabSlot: 30 }
  assert.deepEqual(parseDraft(encodeDraft(boundary)), boundary)
})

test('asset metadata rejects ambiguous positions, invalid hashes, sizes and dates', () => {
  const invalidAssets = [
    [asset('AMPLIFIER', 1), asset('AMPLIFIER', 1)],
    [{ ...asset('PEDAL', 1), kind: 'UNKNOWN' }],
    [{ ...asset('PEDAL', 1), slot: 11 }],
    [{ ...asset('PEDAL', 1), sha256: 'z'.repeat(64) }],
    [{ ...asset('PEDAL', 1), sha256: 'ab'.repeat(31) }],
    [{ ...asset('PEDAL', 1), bytes: 0 }],
    [{ ...asset('PEDAL', 1), bytes: 1.5 }],
    [{ ...asset('PEDAL', 1), bytes: 32 * 1024 * 1024 + 1 }],
    [{ ...asset('PEDAL', 1), inspectedAt: 'not a date' }],
  ]
  for (const assets of invalidAssets) assert.throws(() => parseDraft(JSON.stringify({ ...initialDraft(), assets })))
})

test('project size is bounded in UTF-8 bytes', () => {
  const draft = { ...initialDraft(), ignored: '🎸'.repeat(MAX_PROJECT_BYTES / 4) }
  assert.throws(() => parseDraft(JSON.stringify(draft)), /512 KB/)
})
