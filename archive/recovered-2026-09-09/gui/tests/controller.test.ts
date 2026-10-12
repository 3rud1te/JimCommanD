import test from 'node:test'
import assert from 'node:assert/strict'
import { controlChange, planCommand, modulationDestination } from '../src/controller.ts'

test('documented bypass and tuner messages use correct MIDI channel nibbles', () => {
  const documented = [['fx1', 20], ['fx2', 21], ['amp', 23], ['cab', 24], ['mod', 25], ['del', 26], ['rev', 27], ['eq', 28]] as const
  for (const [block, cc] of documented) {
    assert.deepEqual(planCommand({ type: 'SET_BYPASS', block, enabled: true }, 1).bytes, [0xb0, cc, 127])
    assert.deepEqual(planCommand({ type: 'SET_BYPASS', block, enabled: false }, 16).bytes, [0xbf, cc, 0])
  }
  assert.deepEqual(planCommand({ type: 'SET_TUNER', enabled: true }, 2).bytes, [0xb1, 80, 127])
  assert.deepEqual(planCommand({ type: 'SET_TUNER', enabled: false }).bytes, [0xb0, 80, 0])
})

test('MIDI boundary validation rejects fractional, out-of-range and nonfinite bytes', () => {
  for (const channel of [0, 17, 1.5, NaN, Infinity]) assert.throws(() => controlChange(channel, 20, 0))
  for (const value of [-1, 128, 0.5, NaN, Infinity]) {
    assert.throws(() => controlChange(1, value, 0))
    assert.throws(() => controlChange(1, 20, value))
  }
  assert.deepEqual(controlChange(16, 127, 127), [0xbf, 127, 127])
})

test('preset recall requires a catalogue entry rather than assuming 128 stored presets', () => {
  assert.deepEqual(planCommand({ type: 'RECALL_PRESET', program: 74, knownPrograms: [0, 74] }, 16).bytes, [0xcf, 74])
  assert.throws(() => planCommand({ type: 'RECALL_PRESET', program: 75, knownPrograms: [0, 74] }), /catalogue/)
  assert.throws(() => planCommand({ type: 'RECALL_PRESET', program: 0, knownPrograms: [] }), /catalogue/)
  for (const program of [-1, 128, 1.5, NaN]) assert.throws(() => planCommand({ type: 'RECALL_PRESET', program, knownPrograms: [program] }))
})

test('physical controls and PED remain unmapped instead of inventing device encodings', () => {
  const commands = [
    { type: 'SET_BYPASS', block: 'pedal', enabled: true },
    { type: 'SET_INPUT_GAIN', db: -12 },
    { type: 'SET_INPUT_GAIN', db: 12 },
    { type: 'SET_OUTPUT_GAIN', db: -12 },
    { type: 'SET_OUTPUT_GAIN', db: 0 },
    { type: 'SET_OUTPUT_GAIN', db: 12 },
    { type: 'SET_PARAMETER', block: 'mod', parameter: 'Rate', value: 0.8 },
    { type: 'SET_PARAMETER', block: 'amp', parameter: 'Presence', value: 40 },
  ] as const
  for (const command of commands) {
    const plan = planCommand(command)
    assert.equal(plan.disposition, 'unmapped')
    assert.deepEqual(plan.bytes, [])
  }
  for (const db of [-12.01, 12.01, NaN, Infinity]) assert.throws(() => planCommand({ type: 'SET_INPUT_GAIN', db }))
  for (const db of [-12.01, 12.01, NaN, Infinity]) assert.throws(() => planCommand({ type: 'SET_OUTPUT_GAIN', db }))
  assert.throws(() => planCommand({ type: 'SET_PARAMETER', block: 'amp', parameter: 'Gain', value: NaN }))
})

test('CC68–73 destination follows the documented special FX2 algorithms', () => {
  for (const fx2Type of [0, 1, 2, 3, 4, 5, 6, 7]) assert.equal(modulationDestination(fx2Type), 'mod')
  for (const fx2Type of [8, 9, 10]) assert.equal(modulationDestination(fx2Type), 'fx2')
  for (const invalid of [-1, 11, 8.5, NaN]) assert.throws(() => modulationDestination(invalid))
})
