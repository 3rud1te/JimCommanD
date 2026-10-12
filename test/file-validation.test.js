import test from "node:test"; import assert from "node:assert/strict"; import { inspectCaptureFile, validateCaptureFile } from "../src/core/file-validation.js";
test("model libraries accept NAM, NAM2 and Mosaic EADL",()=>{assert.equal(validateCaptureFile({name:"amp.NAM",size:12},"amplifier").format,"NAM");assert.equal(validateCaptureFile({name:"pedal.nam2",size:12},"pedal").format,"NAM2");assert.equal(validateCaptureFile({name:"native.eadl",size:12},"pedal").format,"EADL");assert.throws(()=>validateCaptureFile({name:"wrong.wav",size:12},"pedal"))});
test("cabinet library accepts WAV and IR only",()=>{assert.equal(validateCaptureFile({name:"cab.wav",size:12},"cabinet").format,"WAV");assert.throws(()=>validateCaptureFile({name:"cab.nam",size:12},"cabinet"))});
test("inspects a real-shaped NAM header and Mosaic-native EADL container",async()=>{
  const nam=namedBlob([JSON.stringify({version:"0.5.1",architecture:"WaveNet",weights:[1],metadata:{}})],"amp.nam");
  const inspectedNam=await inspectCaptureFile(nam,"amplifier");
  assert.equal(inspectedNam.modelVersion,"0.5.1");
  assert.equal(inspectedNam.architecture,"WaveNet");
  assert.equal(inspectedNam.conversionRequired,true);
  const metadata=new TextEncoder().encode(JSON.stringify({gains:[0,1],v:1}));
  const header=new Uint8Array(10); header.set([0x45,0x41,0x44,0x4C,1,0]);
  new DataView(header.buffer).setUint32(6,metadata.length,true);
  const eadl=namedBlob([header,metadata,new TextEncoder().encode("SAPF"),new Uint8Array([1,2,3])],"pedal.eadl");
  const inspectedEadl=await inspectCaptureFile(eadl,"pedal");
  assert.equal(inspectedEadl.nativeMosaicFormat,true);
  assert.deepEqual(inspectedEadl.modelMetadata.gains,[0,1]);
});
test("reads WAV format and reports Mosaic conversion requirements",async()=>{
  const bytes=new Uint8Array(48); const view=new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("RIFF"),0); view.setUint32(4,40,true); bytes.set(new TextEncoder().encode("WAVEfmt "),8);
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,48000,true); view.setUint16(34,24,true);
  bytes.set(new TextEncoder().encode("data"),36); view.setUint32(40,4,true);
  const inspected=await inspectCaptureFile(namedBlob([bytes],"cab.wav"),"cabinet");
  assert.equal(inspected.sampleRate,48000); assert.equal(inspected.bitsPerSample,24);
  assert.deepEqual(inspected.conversionReasons,["48000 Hz → 44100 Hz"]);
});

function namedBlob(parts,name){const blob=new Blob(parts); Object.defineProperty(blob,"name",{value:name}); return blob;}
