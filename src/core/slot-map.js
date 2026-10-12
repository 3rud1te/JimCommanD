export const NAM_SLOT_COUNT = 30;
export const AMP_SLOT_COUNT = 20;
export const PEDAL_SLOT_COUNT = 10;
export const IR_SLOT_COUNT = 30;
export const PRESET_SLOT_COUNT = 75;

export function ampHardwareSlot(logicalSlot) {
  assertRange(logicalSlot, 1, AMP_SLOT_COUNT, "Amplifier slot");
  return logicalSlot;
}

export function pedalHardwareSlot(logicalSlot) {
  assertRange(logicalSlot, 1, PEDAL_SLOT_COUNT, "Pedal slot");
  return logicalSlot + AMP_SLOT_COUNT;
}

export function irHardwareSlot(logicalSlot) {
  assertRange(logicalSlot, 1, IR_SLOT_COUNT, "Cabinet IR slot");
  return logicalSlot;
}

export function presetSlot(slot) {
  assertRange(slot, 1, PRESET_SLOT_COUNT, "Preset slot");
  return slot;
}

function assertRange(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be an integer from ${min} to ${max}`);
  }
}

export function makeLibrary(kind) {
  const count = kind === "amplifier" ? AMP_SLOT_COUNT : kind === "pedal" ? PEDAL_SLOT_COUNT : IR_SLOT_COUNT;
  const hardware = kind === "amplifier" ? ampHardwareSlot : kind === "pedal" ? pedalHardwareSlot : irHardwareSlot;
  return Array.from({ length: count }, (_, index) => ({ kind, logicalSlot: index + 1, hardwareSlot: hardware(index + 1) }));
}
