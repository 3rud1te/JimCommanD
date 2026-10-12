import type { Asset } from './project.ts'

// Mosaic user manual, English pages 15–16. IDs are manual labels, NOT wire addresses.
export const BUILT_IN_AMPS = [
  { id: 'BogXTC1', name: 'Bogner XTC · Tone 1' },
  { id: 'BogXTC2', name: 'Bogner XTC · Tone 2' },
  { id: 'ENGP1', name: 'ENGL Powerball E645 · Tone 1' },
  { id: 'ENGP2', name: 'ENGL Powerball E645 · Tone 2' },
  { id: 'Fd59Bm', name: 'Fender ’59 Bassman' },
  { id: 'Fd65Dk', name: 'Fender ’65 Darkface' },
  { id: 'Hiw103', name: 'Hiwatt DR103' },
  { id: 'MarDSL1', name: 'Marshall DSL50 · Tone 1' },
  { id: 'MarDSL2', name: 'Marshall DSL50 · Tone 2' },
  { id: 'Mar8001', name: 'Marshall JCM800 · Tone 1' },
  { id: 'Mar8002', name: 'Marshall JCM800 · Tone 2' },
  { id: 'MesR1', name: 'Mesa Boogie Rectifier · Tone 1' },
  { id: 'MesR2', name: 'Mesa Boogie Rectifier · Tone 2' },
  { id: 'MesR3', name: 'Mesa Boogie Rectifier · Tone 3' },
  { id: 'OgG120', name: 'Orange Graphic 120' },
  { id: 'Pey51501', name: 'Peavey 5150 · Tone 1' },
  { id: 'Pey51502', name: 'Peavey 5150 · Tone 2' },
  { id: 'Pey6505', name: 'Peavey 6505' },
  { id: 'RanT21', name: 'Randall T2 · Tone 1' },
  { id: 'RanT22', name: 'Randall T2 · Tone 2' },
  { id: 'RoJC120', name: 'Roland JC-120' },
  { id: 'SLO1001', name: 'Soldano SLO-100 · Tone 1' },
  { id: 'SLO1002', name: 'Soldano SLO-100 · Tone 2' },
  { id: 'SLO1003', name: 'Soldano SLO-100 · Tone 3' },
  { id: 'VXAC30', name: 'Vox AC30' },
  { id: 'ApSVTVR', name: 'Ampeg SVT VR' },
  { id: 'ApSVTCL', name: 'Ampeg SVT-CL' },
  { id: 'Adn900', name: 'Ashdown ABM900 EVO II' },
  { id: 'Hiw320', name: 'Hiwatt Jupiter 320' },
  { id: 'MarSup', name: 'Marshall Super Bass' },
] as const

export function assetLabel(asset?: Asset): string {
  if (!asset) return 'Empty'
  return asset.displayName ?? (asset.name.replace(/\.(nam2?|wav|ir)$/i, '').replace(/_/g, ' ').trim() || asset.name)
}

export function libraryOptionLabel(slot: number, asset?: Asset): string {
  return `${String(slot).padStart(2, '0')} · ${assetLabel(asset)}`
}
