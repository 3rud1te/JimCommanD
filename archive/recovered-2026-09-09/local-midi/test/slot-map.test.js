import test from "node:test"; import assert from "node:assert/strict";
import { ampHardwareSlot,pedalHardwareSlot,irHardwareSlot,makeLibrary } from "../src/core/slot-map.js";
test("amplifier slots map to NAM 1-20",()=>{assert.equal(ampHardwareSlot(1),1);assert.equal(ampHardwareSlot(20),20)});
test("pedal slots map to NAM 21-30",()=>{assert.equal(pedalHardwareSlot(1),21);assert.equal(pedalHardwareSlot(10),30)});
test("cabinet IR storage is independent",()=>{assert.equal(irHardwareSlot(1),1);assert.equal(irHardwareSlot(30),30)});
test("libraries have no overlapping amp/pedal hardware slots",()=>{const a=new Set(makeLibrary("amplifier").map(x=>x.hardwareSlot));const p=makeLibrary("pedal").map(x=>x.hardwareSlot);assert.ok(p.every(x=>!a.has(x))) });
