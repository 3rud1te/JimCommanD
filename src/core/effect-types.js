const WAVE_OPTIONS = Object.freeze([
  { label: "Sine", value: 0 },
  { label: "Triangle", value: 1 },
  { label: "Square", value: 2 },
  { label: "Saw", value: 3 }
]);

const p = (name, defaultValue, min, max, unit, midiCC, options = {}) => Object.freeze({
  name, defaultValue, min, max, unit, midiCC,
  step: options.step ?? (Number.isInteger(min) && Number.isInteger(max) ? 1 : max - min <= 10 ? 0.01 : 0.1),
  options: options.options ?? null
});
const level = midiCC => p("Level", 70, 0, 100, "", midiCC);
const effect = (id, name, parameters) => Object.freeze({ id, name, parameters: Object.freeze(parameters) });

const mod = Object.freeze({
  name: "Modulation", typeCC: 45, bypassCC: 25,
  types: Object.freeze([
    effect(0, "Chorus", [
      p("Rate", 1.2, 0.1, 3.74, "Hz", 68, { step: 0.01 }),
      p("Depth", 0.5, 0, 1, "ms", 69, { step: 0.01 }), level(70)
    ]),
    effect(1, "Phaser", [
      p("Rate", 0.8, 0.05, 5, "Hz", 68, { step: 0.01 }),
      p("Feedback", 0, -95, 95, "", 69), p("Mix", 50, 0, 100, "", 70), level(71)
    ]),
    effect(2, "Flanger", [
      p("Rate", 0.7, 0.05, 5, "Hz", 68, { step: 0.01 }),
      p("Feedback", 25, -95, 95, "", 69), p("Mix", 45, 0, 100, "", 70), level(71)
    ]),
    effect(3, "Tremolo", [
      p("Rate", 4, 0.01, 20, "Hz", 68, { step: 0.01 }), p("Depth", 50, 0, 100, "", 69),
      p("Wave", 0, 0, 3, "", 70, { options: WAVE_OPTIONS }), p("Smooth", 10, 0, 40, "Hz", 71, { step: 0.1 }),
      p("Mix", 100, 0, 100, "", 72), level(73)
    ]),
    effect(4, "Vibrato", [
      p("Rate", 4, 0.01, 20, "Hz", 68, { step: 0.01 }), p("Depth", 4, 0, 20, "ms", 69, { step: 0.1 }),
      p("Wave", 0, 0, 3, "", 70, { options: WAVE_OPTIONS }), p("Mix", 100, 0, 100, "", 71), level(72)
    ])
  ])
});

const delay = Object.freeze({
  name: "Delay", typeCC: 46, bypassCC: 26,
  types: Object.freeze([
    effect(0, "BBD", [
      p("Delay", 350, 1, 2000, "ms", 74), p("Feedback", 35, 0, 95, "", 75),
      p("Age", 30, 0, 100, "", 76), p("Mix", 28, 0, 100, "", 77), level(78)
    ]),
    effect(1, "Digital", [
      p("Time", 350, 0.1, 3000, "ms", 74, { step: 0.1 }), p("Feedback", 35, 0, 95, "", 75),
      p("Mix", 28, 0, 100, "", 76), level(77)
    ]),
    effect(2, "Duck", [
      p("Time", 350, 0.1, 3000, "ms", 74, { step: 0.1 }), p("Feedback", 35, 0, 95, "", 75),
      p("Filter", 50, 0, 100, "", 76), p("Mix", 28, 0, 100, "", 77), level(78)
    ]),
    effect(3, "Ice", [
      p("Time", 450, 0.1, 3000, "ms", 74, { step: 0.1 }), p("Feedback", 40, 0, 95, "", 75),
      p("Interval", 12, -12, 12, "st", 76), p("Mix", 35, 0, 100, "", 77), level(78)
    ]),
    effect(4, "Reverse", [
      p("Time", 500, 0.1, 3000, "ms", 74, { step: 0.1 }), p("Feedback", 35, 0, 95, "", 75),
      p("Mix", 35, 0, 100, "", 76), level(77)
    ]),
    effect(5, "LoFi", [
      p("Time", 420, 2, 3000, "ms", 74, { step: 0.1 }), p("Feedback", 35, 0, 95, "", 75),
      p("Bit Depth", 10, 4, 16, "bit", 76), p("LoFi Mix", 45, 0, 100, "", 77),
      p("Mix", 30, 0, 100, "", 78), level(79)
    ]),
    effect(6, "Smear", [
      p("Time", 500, 0.1, 3000, "ms", 74, { step: 0.1 }), p("Feedback", 40, 0, 95, "", 75),
      p("Smear", 45, 0, 100, "", 76), p("Filter", 50, 0, 100, "", 77),
      p("Mix", 32, 0, 100, "", 78), level(79)
    ]),
    effect(7, "Mod Delay", [
      p("Time", 420, 0.1, 3000, "ms", 74, { step: 0.1 }), p("Feedback", 38, 0, 95, "", 75),
      p("Mod Depth", 4, 0, 20, "ms", 76, { step: 0.1 }), p("Mod Rate", 0.8, 0.05, 5, "Hz", 77, { step: 0.01 }),
      p("Mix", 32, 0, 100, "", 78), level(79)
    ])
  ])
});
const reverbParameters = (decayMin, decayMax, preDelayMin, preDelayMax, thirdName, fourthName) => [
  p("Decay", 2.4, decayMin, decayMax, "s", 85, { step: 0.1 }),
  p("PreDelay", 20, preDelayMin, preDelayMax, "ms", 86, { step: 0.1 }),
  p(thirdName, 55, 0, 100, "", 87), p(fourthName, 30, 0, 100, "", 88),
  p("Mix", 28, 0, 100, "", 89), level(90)
];

const reverb = Object.freeze({
  name: "Reverb", typeCC: 47, bypassCC: 27,
  types: Object.freeze([
    effect(0, "Room", reverbParameters(0.5, 12, 0, 80, "Tone", "Mod")),
    effect(1, "Plate", reverbParameters(0.5, 12, 0, 80, "Tone", "Mod")),
    effect(2, "Hall", reverbParameters(0.5, 12, 0, 80, "Tone", "LF Damp")),
    effect(3, "Concert", reverbParameters(0.5, 12, 0, 80, "HF Damp", "Mod")),
    effect(4, "Shimmer", [
      p("Decay", 5, 0, 12, "s", 85, { step: 0.1 }), p("PreDelay", 30, 5, 120, "ms", 86, { step: 0.1 }),
      p("Tone", 55, 0, 100, "", 87), p("Pitch", 12, -24, 24, "st", 88),
      p("Mix", 30, 0, 100, "", 89), level(90)
    ]),
    effect(5, "Cloud", [
      p("Decay", 18, 1, 100, "s", 85, { step: 0.1 }), p("Tone", 55, 0, 100, "", 86),
      p("Mod Depth", 40, 0, 100, "", 87), p("Mod Rate", 0.1, 0.02, 0.25, "Hz", 88, { step: 0.01 }),
      p("Mix", 35, 0, 100, "", 89), level(90)
    ]),
    effect(6, "Spring", [
      p("Decay", 2.5, 0, 12, "s", 85, { step: 0.1 }), p("PreDelay", 15, 5, 80, "ms", 86, { step: 0.1 }),
      p("Crossover", 2400, 800, 8000, "Hz", 87), p("Mod", 20, 0, 100, "", 88),
      p("Mix", 28, 0, 100, "", 89), level(90)
    ])
  ])
});

export const EFFECT_BLOCKS = Object.freeze({ mod, delay, reverb });

export function getEffectType(block, typeId) {
  const definition = EFFECT_BLOCKS[block];
  if (!definition) throw new RangeError(`Unknown effect block: ${block}`);
  const type = definition.types.find(candidate => candidate.id === Number(typeId));
  if (!type) throw new RangeError(`Unknown ${block} type ID: ${typeId}`);
  return type;
}

export function effectValueKey(block, typeId, parameterName) {
  return `${block}:${typeId}:${parameterName}`;
}

export function toMidi7Bit(value, definition) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new TypeError(`${definition.name} must be numeric`);
  const clamped = Math.min(definition.max, Math.max(definition.min, numeric));
  return Math.round(((clamped - definition.min) / (definition.max - definition.min)) * 127);
}

export function buildEffectTypeCommand(block, typeId) {
  const definition = EFFECT_BLOCKS[block];
  const selected = getEffectType(block, typeId);
  return { type: "SET_EFFECT_TYPE", block, effectType: selected.name, typeId: selected.id, midiCC: definition.typeCC, midiValue: selected.id };
}

export function buildEffectParameterCommand(block, typeId, parameterName, value) {
  const selected = getEffectType(block, typeId);
  const definition = selected.parameters.find(candidate => candidate.name === parameterName);
  if (!definition) throw new RangeError(`Unknown ${selected.name} parameter: ${parameterName}`);
  return {
    type: "SET_PARAMETER", block, effectType: selected.name, typeId: selected.id,
    parameter: definition.name, value: Number(value), unit: definition.unit,
    midiCC: definition.midiCC, midiValue: toMidi7Bit(value, definition)
  };
}
