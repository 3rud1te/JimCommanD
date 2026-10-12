import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectAsset } from '../src/assets.ts'
import { assetLabel, libraryOptionLabel } from '../src/amplifiers.ts'
import { initialDraft, parseDraft, encodeDraft, withAsset } from '../src/project.ts'

test('a named capture follows its slot through export, selection changes and replacement', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ version: '0.5.4', architecture: 'Linear', config: {}, weights: [1], metadata: { name: 'Fender Blues' } }))
  const checked = await inspectAsset({ name: 'capture_024.nam', size: bytes.length, arrayBuffer: async () => bytes.buffer }, 'AMPLIFIER', 7)
  let draft = withAsset(initialDraft(), checked)
  draft.selectedAmpSlot = 7
  draft.ampSource = 'BUILT_IN'
  draft.builtInAmpId = 'Fd59Bm'
  const restored = parseDraft(encodeDraft(draft))
  assert.equal(restored.ampSource, 'BUILT_IN')
  assert.equal(restored.builtInAmpId, 'Fd59Bm')
  assert.equal(restored.selectedAmpSlot, 7)
  assert.equal(libraryOptionLabel(7, restored.assets[0]), '07 · Fender Blues')
  assert.equal(libraryOptionLabel(1, restored.assets.find(a => a.slot === 1)), '01 · Empty')
  draft = withAsset(restored, { ...checked, name: 'Vox_AC30.nam', displayName: undefined })
  assert.equal(libraryOptionLabel(7, draft.assets[0]), '07 · Vox AC30')
  assert.equal(restored.assets[0].name, 'capture_024.nam')
})

test('older drafts keep their capture slots, while invalid built-in selections are rejected', () => {
  const legacy = JSON.parse(encodeDraft(initialDraft()))
  delete legacy.ampSource
  delete legacy.builtInAmpId
  legacy.selectedAmpSlot = 20
  const restored = parseDraft(JSON.stringify(legacy))
  assert.equal(restored.selectedAmpSlot, 20)
  assert.equal(restored.ampSource, 'CAPTURE')
  assert.throws(() => parseDraft(JSON.stringify({ ...legacy, ampSource: 'BUILT_IN' })), /Missing built-in/)
  assert.throws(() => parseDraft(JSON.stringify({ ...legacy, builtInAmpId: 'FenderBlues' })), /Unknown built-in/)
  assert.throws(() => parseDraft(JSON.stringify({ ...legacy, ampSource: 'DEVICE' })), /Invalid amplifier source/)
  assert.equal(assetLabel(), 'Empty')
})
