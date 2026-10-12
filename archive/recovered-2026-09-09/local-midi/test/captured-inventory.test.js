import test from "node:test";
import assert from "node:assert/strict";
import { makeLibrary } from "../src/core/slot-map.js";
import { capturedNamName, CAPTURED_NAM_NAMES } from "../src/core/captured-inventory.js";

test("library grouping covers the captured wire inventory without index shifts", () => {
  const groups = [...makeLibrary("amplifier"), ...makeLibrary("pedal")];
  assert.deepEqual(groups.map(slot => capturedNamName(slot.hardwareSlot)), CAPTURED_NAM_NAMES);
  assert.equal(capturedNamName(makeLibrary("pedal")[0].hardwareSlot), "Tonebender MK I");
  assert.equal(capturedNamName(makeLibrary("pedal")[2].hardwareSlot), "ST_SF300_FUZZ2_");
  assert.throws(() => capturedNamName(0), RangeError);
});
