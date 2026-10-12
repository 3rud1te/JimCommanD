// User-supplied USB opcode 0x36 inventory, 2026-09-09. This is a saved
// snapshot, never a connection indicator or a set of factory defaults.
export const CAPTURED_INVENTORY_DATE = "2026-09-09";
export const CAPTURED_NAM_NAMES = Object.freeze([
  "Marshall 1959BJ",
  "BogXTC2",
  "Orange Rockerve",
  "Jazz120",
  "2555X Ch2+ lync",
  "Fd65Dk",
  "SUHR SL100",
  "MarDSL1",
  "MarDSL2",
  "Mar8001",
  "Mar8002",
  "90sDualRec-Full",
  "MesR2",
  "MesR3",
  "OgG120",
  "1966BluesBreake",
  "Pey51502",
  "Pey6505",
  "LION custom sho",
  "RanT22",
  "Tonebender MK I",
  "SlashRig",
  "ST_SF300_FUZZ2_",
  "Mesa MK IV 6L6-",
  "Big Muff Sustai",
  "marshall bluesb",
  "Marshall JCM 80",
  "Rockerverb MK3",
  "Hiw320",
  "MarSup"
]);

export function capturedNamName(hardwareSlot) {
  if (!Number.isInteger(hardwareSlot) || hardwareSlot < 1 || hardwareSlot > CAPTURED_NAM_NAMES.length) {
    throw new RangeError("Captured NAM hardware position must be 1–30");
  }
  return CAPTURED_NAM_NAMES[hardwareSlot - 1];
}
