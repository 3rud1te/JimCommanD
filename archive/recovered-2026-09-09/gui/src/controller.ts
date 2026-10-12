/** Offline command planning only. No MIDI API, device handle, queue or send operation. */
export type Command =
  | { type: 'SET_BYPASS'; block: string; enabled: boolean }
  | { type: 'SET_PARAMETER'; block: string; parameter: string; value: number }
  | { type: 'SET_INPUT_GAIN'; db: number }
  | { type: 'SET_OUTPUT_GAIN'; db: number }
  | { type: 'SET_TUNER'; enabled: boolean }
  | { type: 'RECALL_PRESET'; program: number; knownPrograms: readonly number[] }
export type Plan = { disposition: 'preview' | 'unmapped'; message: string; bytes: number[] }
export const BYPASS_CC: Readonly<Record<string, number>> = { fx1: 20, fx2: 21, amp: 23, cab: 24, mod: 25, del: 26, rev: 27, eq: 28 }
function integer(value: number, min: number, max: number, name: string) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}.`)
}
export function controlChange(channel: number, cc: number, value: number): number[] {
  integer(channel, 1, 16, 'MIDI channel'); integer(cc, 0, 127, 'CC'); integer(value, 0, 127, 'CC value')
  return [0xb0 | (channel - 1), cc, value]
}
export function planCommand(command: Command, channel = 1): Plan {
  integer(channel, 1, 16, 'MIDI channel')
  switch (command.type) {
    case 'SET_BYPASS': {
      const cc = BYPASS_CC[command.block]
      return cc === undefined
        ? { disposition: 'unmapped', bytes: [], message: 'Pedal Capture is a library choice; a separate pedal DSP bypass is unverified.' }
        : { disposition: 'preview', bytes: controlChange(channel, cc, command.enabled ? 127 : 0), message: `Documented CC ${cc}. Preview only; nothing sent.` }
    }
    case 'SET_TUNER':
      return { disposition: 'preview', bytes: controlChange(channel, 80, command.enabled ? 127 : 0), message: 'Documented tuner control. Preview only; nothing sent.' }
    case 'RECALL_PRESET':
      integer(command.program, 0, 127, 'program number')
      if (!command.knownPrograms.includes(command.program)) throw new Error('Preset is not in the verified device catalogue.')
      return { disposition: 'preview', bytes: [0xc0 | (channel - 1), command.program], message: 'Preset recall preview only; nothing sent.' }
    case 'SET_INPUT_GAIN':
      if (!Number.isFinite(command.db) || Math.abs(command.db) > 12) throw new Error('Input gain must be −12 to +12 dB.')
      return { disposition: 'unmapped', bytes: [], message: 'Input gain saved in dB. Device encoding remains unverified.' }
    case 'SET_OUTPUT_GAIN':
      if (!Number.isFinite(command.db) || Math.abs(command.db) > 12) throw new Error('Output gain must be −12 to +12 dB.')
      return { disposition: 'unmapped', bytes: [], message: 'Output gain saved in dB. Device encoding remains unverified.' }
    case 'SET_PARAMETER':
      if (!Number.isFinite(command.value)) throw new Error('Parameter value must be finite.')
      return { disposition: 'unmapped', bytes: [], message: `${command.parameter} saved locally. Algorithm and physical-unit mapping need verification.` }
  }
}

export function modulationDestination(fx2Type: number): 'fx2' | 'mod' {
  integer(fx2Type, 0, 10, 'FX2 type')
  return [8, 9, 10].includes(fx2Type) ? 'fx2' : 'mod'
}
