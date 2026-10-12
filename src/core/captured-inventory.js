// User-supplied USB opcode 0x36 inventory, 2026-09-09. This is a saved
// snapshot, never a connection indicator or a set of factory defaults.
export const CAPTURED_INVENTORY_DATE = "2026-09-09";
export const CAPTURED_NAM_NAMES = Object.freeze([
  "Octave Velvet F",
  "Peavey 5150 Rhy",
  "Orange Rockerve",
  "Octave Velvet F",
  "First Wave Fuzz",
  "British Attack",
  "1972 Marshall J",
  "MarDSL1",
  "Marshall 8100 t",
  "Retro Wedge Fuz",
  "Mar8002",
  "90sDualRec-Full",
  "Mesa Boogie Dua",
  "Mesa Boogie Dua",
  "Brit 800 Lead",
  "1966BluesBreake",
  "Pi Fuzz",
  "Pey6505",
  "LION custom sho",
  "RanT22",
  "Tonebender MK I",
  "SlashRig",
  "Essex A30",
  "Mesa MK IV 6L6-",
  "Big Muff Sustai",
  "marshall bluesb",
  "Marshall JCM 80",
  "Rockerverb MK3",
  "Vox AC30 Top Bo",
  "MarSup"
]);

export function capturedNamName(hardwareSlot) {
  if (!Number.isInteger(hardwareSlot) || hardwareSlot < 1 || hardwareSlot > CAPTURED_NAM_NAMES.length) {
    throw new RangeError("Captured NAM hardware position must be 1–30");
  }
  return CAPTURED_NAM_NAMES[hardwareSlot - 1];
}
