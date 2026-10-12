// ── Types ──────────────────────────────────────────────────────────────────
export type Param = {
  name: string
  value: number
  min: number
  max: number
  unit?: string
}
export type Block = {
  id: string
  type: string
  label: string
  color: string
  enabled: boolean
  params: Param[]
}

// ── Default chain ──────────────────────────────────────────────────────────
export const makeChain = (): Block[] => [
  {
    id: "fx1",
    type: "FX1",
    label: "Dynamics",
    color: "#6366f1",
    enabled: true,
    params: [
      { name: "Threshold", value: -48, min: -80, max: 0, unit: "dB" },
      { name: "Attack", value: 10, min: 1, max: 100, unit: "ms" },
      { name: "Release", value: 80, min: 10, max: 500, unit: "ms" },
      { name: "Ratio", value: 4, min: 1, max: 20 },
      { name: "Level", value: 0, min: -12, max: 12, unit: "dB" },
    ],
  },
  {
    id: "fx2",
    type: "FX2",
    label: "Drive & Filter",
    color: "#ef4444",
    enabled: true,
    params: [
      { name: "Gain", value: 55, min: 0, max: 100 },
      { name: "Tone", value: 50, min: 0, max: 100 },
      { name: "Level", value: 60, min: 0, max: 100 },
      { name: "Bass", value: 45, min: 0, max: 100 },
      { name: "Mid", value: 55, min: 0, max: 100 },
    ],
  },
  {
    id: "pedal",
    type: "PED",
    label: "Pedal Capture",
    color: "#f59e0b",
    enabled: true,
    params: [],
  },
  {
    id: "amp",
    type: "AMP",
    label: "Amplifier",
    color: "#22d3ee",
    enabled: true,
    params: [
      { name: "Gain", value: 62, min: 0, max: 100 },
      { name: "Bass", value: 55, min: 0, max: 100 },
      { name: "Mid", value: 48, min: 0, max: 100 },
      { name: "Treble", value: 60, min: 0, max: 100 },
      { name: "Presence", value: 40, min: 0, max: 100 },
      { name: "Master", value: 70, min: 0, max: 100 },
    ],
  },
  {
    id: "cab",
    type: "CAB",
    label: "Cabinet IR",
    color: "#84cc16",
    enabled: true,
    params: [
      { name: "Low Cut", value: 80, min: 20, max: 500, unit: "Hz" },
      { name: "High Cut", value: 8000, min: 2000, max: 20000, unit: "Hz" },
      { name: "Level", value: 0, min: -12, max: 12, unit: "dB" },
    ],
  },
  {
    id: "del",
    type: "DEL",
    label: "Delay",
    color: "#f472b6",
    enabled: true,
    params: [
      { name: "Time", value: 350, min: 1, max: 2000, unit: "ms" },
      { name: "Feedback", value: 35, min: 0, max: 99 },
      { name: "Mix", value: 28, min: 0, max: 100 },
      { name: "High Cut", value: 6000, min: 500, max: 20000, unit: "Hz" },
    ],
  },
  {
    id: "mod",
    type: "MOD",
    label: "Modulation",
    color: "#a78bfa",
    enabled: false,
    params: [
      { name: "Rate", value: 0.8, min: 0.1, max: 10, unit: "Hz" },
      { name: "Depth", value: 40, min: 0, max: 100 },
      { name: "Mix", value: 50, min: 0, max: 100 },
      { name: "Tone", value: 60, min: 0, max: 100 },
    ],
  },
  {
    id: "rev",
    type: "REV",
    label: "Reverb",
    color: "#34d399",
    enabled: true,
    params: [
      { name: "Decay", value: 2.4, min: 0.1, max: 10, unit: "s" },
      { name: "Pre-Delay", value: 20, min: 0, max: 200, unit: "ms" },
      { name: "Mix", value: 22, min: 0, max: 100 },
      { name: "Damping", value: 55, min: 0, max: 100 },
    ],
  },
  {
    id: "eq",
    type: "EQ",
    label: "EQ",
    color: "#fb923c",
    enabled: true,
    params: [
      { name: "Low", value: 0, min: -12, max: 12, unit: "dB" },
      { name: "Low-Mid", value: 0, min: -12, max: 12, unit: "dB" },
      { name: "High-Mid", value: 0, min: -12, max: 12, unit: "dB" },
      { name: "High", value: 0, min: -12, max: 12, unit: "dB" },
      { name: "Level", value: 0, min: -12, max: 12, unit: "dB" },
    ],
  },
]

export const PRESETS = [
  { name: "Clean Shimmer", amp: "FENDER '65", active: false },
  { name: "Blues Driver", amp: "MARSHALL JTM", active: true },
  { name: "Hi-Gain Lead", amp: "EVH 5150", active: false },
  { name: "Crunchy Rhythm", amp: "VOXAC30", active: false },
  { name: "Modern Metal", amp: "MESA BOOGIE", active: false },
  { name: "Ambient Clean", amp: "ROLAND JC-120", active: false },
  { name: "Classic Rock", amp: "MARSHALL PLEXI", active: false },
]

export const IR_OPTIONS = [
  "4×12 Vintage Greenback",
  "2×12 Celestion Blue",
  "1×12 Jensen C12N",
  "4×12 Mesa Oversized",
  "Open-Back Alnico",
]

export const AMP_LIBRARY = Array.from({ length: 20 }, (_, index) => ({
  logicalSlot: index + 1,
}))

export const PEDAL_LIBRARY = Array.from({ length: 10 }, (_, index) => ({
  logicalSlot: index + 1,
}))
