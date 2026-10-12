import test from "node:test";
import assert from "node:assert/strict";
import {
  EFFECT_BLOCKS,
  buildEffectParameterCommand,
  buildEffectTypeCommand,
  getEffectType,
  toMidi7Bit
} from "../src/core/effect-types.js";

test("Mosaic effect selectors use the documented type CCs and IDs", () => {
  assert.equal(EFFECT_BLOCKS.mod.typeCC, 45);
  assert.equal(EFFECT_BLOCKS.delay.typeCC, 46);
  assert.equal(EFFECT_BLOCKS.reverb.typeCC, 47);
  assert.deepEqual(
    EFFECT_BLOCKS.mod.types.map(type => [type.id, type.name]),
    [[0, "Chorus"], [1, "Phaser"], [2, "Flanger"], [3, "Tremolo"], [4, "Vibrato"]]
  );
  assert.deepEqual(
    EFFECT_BLOCKS.delay.types.map(type => [type.id, type.name]),
    [[0, "BBD"], [1, "Digital"], [2, "Duck"], [3, "Ice"], [4, "Reverse"], [5, "LoFi"], [6, "Smear"], [7, "Mod Delay"]]
  );
  assert.deepEqual(
    EFFECT_BLOCKS.reverb.types.map(type => [type.id, type.name]),
    [[0, "Room"], [1, "Plate"], [2, "Hall"], [3, "Concert"], [4, "Shimmer"], [5, "Cloud"], [6, "Spring"]]
  );
});

test("type-specific parameter names and CC positions match the Mosaic table", () => {
  assert.deepEqual(parameterMap("mod", 3), [
    ["Rate", 68], ["Depth", 69], ["Wave", 70],
    ["Smooth", 71], ["Mix", 72], ["Level", 73]
  ]);
  assert.deepEqual(parameterMap("delay", 5), [
    ["Time", 74], ["Feedback", 75], ["Bit Depth", 76],
    ["LoFi Mix", 77], ["Mix", 78], ["Level", 79]
  ]);
  assert.deepEqual(parameterMap("reverb", 4), [
    ["Decay", 85], ["PreDelay", 86], ["Tone", 87],
    ["Pitch", 88], ["Mix", 89], ["Level", 90]
  ]);
  assert.deepEqual(parameterMap("reverb", 5), [
    ["Decay", 85], ["Tone", 86], ["Mod Depth", 87],
    ["Mod Rate", 88], ["Mix", 89], ["Level", 90]
  ]);
});

test("effect commands contain exact selector IDs and normalized MIDI values", () => {
  assert.deepEqual(buildEffectTypeCommand("reverb", 4), {
    type: "SET_EFFECT_TYPE",
    block: "reverb",
    effectType: "Shimmer",
    typeId: 4,
    midiCC: 47,
    midiValue: 4
  });
  const pitch = buildEffectParameterCommand("reverb", 4, "Pitch", 0);
  assert.equal(pitch.midiCC, 88);
  assert.equal(pitch.midiValue, 64);
  const time = buildEffectParameterCommand("delay", 7, "Time", 3000);
  assert.equal(time.midiCC, 74);
  assert.equal(time.midiValue, 127);
});

test("all defaults are valid and physical ranges clamp to MIDI 0-127", () => {
  for (const block of Object.values(EFFECT_BLOCKS)) {
    for (const type of block.types) {
      for (const parameter of type.parameters) {
        assert.ok(parameter.defaultValue >= parameter.min);
        assert.ok(parameter.defaultValue <= parameter.max);
        assert.equal(toMidi7Bit(parameter.min, parameter), 0);
        assert.equal(toMidi7Bit(parameter.max, parameter), 127);
        assert.ok(toMidi7Bit(parameter.defaultValue, parameter) >= 0);
        assert.ok(toMidi7Bit(parameter.defaultValue, parameter) <= 127);
      }
    }
  }
});

function parameterMap(block, typeId) {
  return getEffectType(block, typeId).parameters.map(parameter => [
    parameter.name,
    parameter.midiCC
  ]);
}
