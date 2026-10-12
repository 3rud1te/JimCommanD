import { PRESET_SLOT_COUNT, presetSlot } from "./slot-map.js";

export class PresetStore {
  constructor(storage = globalThis.localStorage) { this.storage = storage; }
  save(slot, snapshot) { presetSlot(slot); const record = { ...structuredClone(snapshot), slot, savedAt: Date.now() }; this.storage.setItem(`jimcommand:preset:${slot}`, JSON.stringify(record)); return record; }
  load(slot) { presetSlot(slot); const raw = this.storage.getItem(`jimcommand:preset:${slot}`); return raw ? JSON.parse(raw) : null; }
  slots() { return Array.from({ length: PRESET_SLOT_COUNT }, (_, i) => this.load(i + 1)); }
}
