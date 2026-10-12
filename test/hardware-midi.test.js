import test from "node:test";
import assert from "node:assert/strict";
import { HardwareMidiTransport, createNativeMidiClient } from "../src/transports/hardware-midi.js";
import { pack7Bit } from "../src/protocol/sysex.js";

function response(slot, status = 0) {
  const payload = status ? [] : new Uint8Array(30);
  if (!status) { payload[0] = slot; payload.set(new TextEncoder().encode(`Model ${slot}`), 14); }
  return { frame: [0xF0,0x7D,0x4E,0x43,0x71,...pack7Bit([2,1,0,0x36,0,status,payload.length,0,...payload]),0xF7] };
}
test("hardware inventory requests exactly 30 slots serially", async () => {
  const calls = []; let inFlight = 0;
  const transport = new HardwareMidiTransport(async (action, args) => {
    calls.push([action,args]);
    if (action !== "readSlot") return {};
    assert.equal(++inFlight,1);
    await Promise.resolve(); inFlight--;
    return response(args.slot);
  });
  await transport.connect();
  const progress = [];
  const inventory = await transport.readInventory(n=>progress.push(n));
  assert.deepEqual(calls.slice(1).map(c=>c[1].slot),Array.from({length:30},(_,i)=>i));
  assert.equal(inventory.slots[29].name,"Model 29");
  assert.equal(progress.length,30);
  await assert.rejects(transport.send({type:"UPLOAD_CAPTURE"}),/not enabled/);
});
test("hardware transport sends only bounded, explicit MIDI CC commands",async()=>{
  const calls=[]; const transport=new HardwareMidiTransport(async(action,args)=>{calls.push([action,args]); return {};});
  await transport.connect();
  await transport.send({type:"SET_PARAMETER",midiCC:74,midiValue:127});
  assert.deepEqual(calls[1],["sendControlChange",{controller:74,value:127}]);
  await assert.rejects(transport.send({midiCC:128,midiValue:0}),/not enabled/);
  await assert.rejects(transport.send({midiCC:25,midiValue:0.5}),/not enabled/);
});
test("device errors and wrong slots stop a refresh without returning partial inventory", async () => {
  for (const bad of [response(0,1),response(9)]) {
    let reads = 0;
    const transport = new HardwareMidiTransport(async action => {
      if (action !== "readSlot") return {};
      return reads++ === 0 ? response(0) : bad;
    });
    await transport.connect();
    await assert.rejects(transport.readInventory(),/rejected|wrong record/);
    assert.equal(reads,2); assert.equal(transport.connected,false);
  }
});
test("disconnect cancels a pending inventory before another query is sent",async()=>{
  let resolve;
  const transport=new HardwareMidiTransport(async action=>action==="readSlot" ? new Promise(r=>{resolve=r;}) : {});
  await transport.connect();
  const inventory=transport.readInventory();
  await assert.rejects(transport.readInventory(),/already in progress/);
  await transport.disconnect(); resolve(response(0));
  await assert.rejects(inventory,/cancelled/);
});
test("native RPC correlates replies and reports unavailable or failed bridge",async()=>{
  const messages=[];
  const scope={webkit:{messageHandlers:{mosaic:{postMessage:m=>messages.push(m)}}}};
  const request=createNativeMidiClient(scope);
  const first=request("connect"), second=request("readSlot",{slot:0});
  scope.__mosaicReply({id:messages[1].id,result:{frame:[1]}});
  scope.__mosaicReply({id:messages[0].id,result:{name:"Mosaic"}});
  assert.equal((await first).name,"Mosaic"); assert.deepEqual((await second).frame,[1]);
  const error=request("readSlot",{slot:1});
  scope.__mosaicReply({id:messages[2].id,error:"USB removed"});
  await assert.rejects(error,/USB removed/);
  await assert.rejects(createNativeMidiClient({})("connect"),/Mac app/);
});
test("native packets become decoded transport events only while connected",async()=>{
  const scope={webkit:{messageHandlers:{mosaic:{postMessage:message=>queueMicrotask(()=>scope.__mosaicReply({id:message.id,result:{}}))}}}};
  const request=createNativeMidiClient(scope);
  const transport=new HardwareMidiTransport(request);
  const events=[];
  transport.onMidiEvent(event=>events.push(event));
  scope.__mosaicEvent({bytes:[0xB0,25,127],receivedAt:1});
  assert.equal(events.length,0);
  await transport.connect();
  scope.__mosaicEvent({bytes:[0xC0,4],receivedAt:123});
  scope.__mosaicEvent({bytes:[0xB0,25]});
  scope.__mosaicEvent({bytes:[0]});
  assert.equal(events[0].type,"programChange");
  assert.equal(events[0].preset,5);
  assert.equal(events[0].receivedAt,123);
  assert.equal(events[1].controller,25);
  scope.__mosaicEvent({bytes:[0xF0,0x7D,0x4E,0x43,0x72,0,2,0x60,0,1,0,0x14,0xF7],receivedAt:124});
  assert.equal(events[2].type,"mosaicNotification");
  assert.equal(events[2].preset,21);
  await transport.disconnect();
  scope.__mosaicEvent({bytes:[0xC0,5]});
  assert.equal(events.length,3);
});
