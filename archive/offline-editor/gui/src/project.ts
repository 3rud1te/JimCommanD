import { makeChain, type Block } from './model.ts'
import { BUILT_IN_AMPS } from './amplifiers.ts'

export type LibraryKind = 'AMPLIFIER' | 'PEDAL' | 'CABINET'
export type Asset = {
  kind: LibraryKind; slot: number; name: string; bytes: number; sha256: string
  format: string; summary: string; inspectedAt: string
  displayName?: string
}
export type Draft = {
  schema: 'jimcommand-draft'; version: 1; name: string
  chain: Block[]; inputGain: number; outputLevel: number
  selectedAmpSlot: number; selectedPedalSlot: number; selectedCabSlot: number
  ampSource: 'CAPTURE' | 'BUILT_IN'; builtInAmpId: string
  assets: Asset[]
}

export const CAPACITY = { AMPLIFIER: 20, PEDAL: 10, CABINET: 30 } as const
export const STORAGE_KEY = 'jimcommand.offline-project.v1'
export const MAX_PROJECT_BYTES = 512 * 1024
export const initialDraft = (): Draft => ({
  schema: 'jimcommand-draft', version: 1, name: 'My Mosaic draft', chain: makeChain(),
  inputGain: 0, outputLevel: 80, selectedAmpSlot: 1, selectedPedalSlot: 1,
  selectedCabSlot: 1, assets: [], ampSource: 'CAPTURE', builtInAmpId: 'BogXTC1',
})

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
function number(v: unknown, min: number, max: number, label: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    throw new Error(`${label} must be between ${min} and ${max}.`)
  return v
}
export function slotNumber(kind: LibraryKind, value: unknown): number {
  const slot = number(value, 1, CAPACITY[kind], `${kind} position`)
  if (!Number.isInteger(slot)) throw new Error('Library position must be a whole number.')
  return slot
}
function string(v: unknown, label: string, max = 255): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Error(`Invalid ${label}.`)
  return v
}

/** Rebuild from the trusted schema. Imported labels, ranges and transport claims never override it. */
export function parseDraft(text: string): Draft {
  if (new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) throw new Error('Project exceeds 512 KB.')
  const data: unknown = JSON.parse(text)
  if (!record(data) || data.schema !== 'jimcommand-draft' || data.version !== 1)
    throw new Error('Choose a JimCommanD version 1 draft (.jimcommand.json).')
  const draft = initialDraft()
  draft.name = string(data.name, 'draft name', 80)
  if (!Array.isArray(data.chain) || data.chain.length !== draft.chain.length)
    throw new Error('Project has an incomplete signal chain.')
  const ids = new Set<string>()
  for (const block of data.chain) {
    if (!record(block) || typeof block.id !== 'string' || ids.has(block.id)) throw new Error('Invalid or duplicate block.')
    ids.add(block.id)
  }
  draft.chain = draft.chain.map(template => {
    const saved = (data.chain as Record<string, unknown>[]).find(b => b.id === template.id)
    if (!saved || typeof saved.enabled !== 'boolean' || !Array.isArray(saved.params) || saved.params.length !== template.params.length)
      throw new Error(`Invalid ${template.label} settings.`)
    const params = saved.params
    if (new Set(params.map(p => record(p) ? p.name : null)).size !== params.length)
      throw new Error(`Duplicate ${template.label} parameter.`)
    return { ...template, enabled: saved.enabled, params: template.params.map(p => {
      const savedParam = params.find(q => record(q) && q.name === p.name)
      if (!record(savedParam)) throw new Error(`Missing ${template.label} ${p.name}.`)
      return { ...p, value: number(savedParam.value, p.min, p.max, `${template.label} ${p.name}`) }
    }) }
  })
  draft.inputGain = number(data.inputGain, -12, 12, 'Input gain')
  draft.outputLevel = number(data.outputLevel, 0, 100, 'Output level')
  draft.selectedAmpSlot = slotNumber('AMPLIFIER', data.selectedAmpSlot)
  draft.selectedPedalSlot = slotNumber('PEDAL', data.selectedPedalSlot)
  draft.selectedCabSlot = slotNumber('CABINET', data.selectedCabSlot)
  // Optional additions keep existing version-1 drafts readable.
  if (data.ampSource !== undefined) {
    if (data.ampSource !== 'CAPTURE' && data.ampSource !== 'BUILT_IN') throw new Error('Invalid amplifier source.')
    draft.ampSource = data.ampSource
  }
  if (data.builtInAmpId !== undefined) {
    if (!BUILT_IN_AMPS.some(amp => amp.id === data.builtInAmpId)) throw new Error('Unknown built-in amplifier.')
    draft.builtInAmpId = data.builtInAmpId as string
  } else if (draft.ampSource === 'BUILT_IN') throw new Error('Missing built-in amplifier selection.')
  if (!Array.isArray(data.assets) || data.assets.length > 60) throw new Error('Invalid library metadata.')
  const assetKeys = new Set<string>()
  draft.assets = data.assets.map(raw => {
    if (!record(raw) || !['AMPLIFIER', 'PEDAL', 'CABINET'].includes(raw.kind as string)) throw new Error('Invalid library kind.')
    const kind = raw.kind as LibraryKind
    const slot = slotNumber(kind, raw.slot), key = `${kind}:${slot}`
    if (assetKeys.has(key)) throw new Error('Duplicate library position.')
    assetKeys.add(key)
    const sha256 = string(raw.sha256, 'file fingerprint', 64)
    if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error('Invalid SHA-256 fingerprint.')
    const bytes = number(raw.bytes, 1, 32 * 1024 * 1024, 'File size')
    if (!Number.isInteger(bytes)) throw new Error('Invalid file size.')
    const inspectedAt = string(raw.inspectedAt, 'inspection date', 40)
    if (!Number.isFinite(Date.parse(inspectedAt))) throw new Error('Invalid inspection date.')
    return { kind, slot, name: string(raw.name, 'file name'), bytes, sha256,
      ...(raw.displayName === undefined ? {} : { displayName: string(raw.displayName, 'capture name', 120).trim() }),
      format: string(raw.format, 'file format', 30), summary: string(raw.summary, 'file summary', 400), inspectedAt }
  })
  return draft
}

export function encodeDraft(draft: Draft): string {
  // Run the same checks for exports and imports.
  return JSON.stringify(parseDraft(JSON.stringify(draft)), null, 2)
}

export function withAsset(draft: Draft, asset: Asset): Draft {
  return { ...draft, assets: [...draft.assets.filter(a => a.kind !== asset.kind || a.slot !== asset.slot), asset] }
}
