import { parseAmpSlotInfoResponse, parseNotificationFrame } from "../protocol/sysex.js";
import { MidiStreamDecoder } from "../protocol/midi-events.js";

export function createNativeMidiClient(scope = globalThis) {
  let nextId = 0;
  const pending = new Map();
  const eventListeners = new Set();
  scope.__mosaicReply = message => {
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error) entry.reject(new Error(message.error));
    else entry.resolve(message.result);
  };
  scope.__mosaicEvent = message => {
    for (const listener of eventListeners) listener(message);
  };
  const request = (action, values = {}) => new Promise((resolve, reject) => {
    const handler = scope.webkit?.messageHandlers?.mosaic;
    if (!handler) { reject(new Error("USB MIDI is available in the JimCommanD Mac app. Open the app to connect.")); return; }
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("The Mac MIDI bridge did not respond. Reconnect Mosaic USB."));
    }, 8000);
    pending.set(id, { resolve, reject, timer });
    try { handler.postMessage({ id, action, ...values }); }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
  });
  request.subscribe = listener => {
    if (typeof listener !== "function") throw new TypeError("MIDI event listener must be a function");
    eventListeners.add(listener);
    return () => eventListeners.delete(listener);
  };
  return request;
}

let nativeMidiClient;
export class HardwareMidiTransport {
  constructor(request) {
    this.request = request ?? (nativeMidiClient ??= createNativeMidiClient());
    this.connected = false;
    this.reading = false;
    this.generation = 0;
    this.decoder = new MidiStreamDecoder();
    this.listeners = new Set();
    this.unsubscribeNative = typeof this.request.subscribe === "function"
      ? this.request.subscribe(packet => this.receivePacket(packet))
      : null;
  }
  async connect() {
    this.connectionInfo = await this.request("connect");
    this.connected = true;
    return this.connectionInfo;
  }
  async readInventory(onProgress = () => {}) {
    if (!this.connected) throw new Error("Connect Mosaic USB first.");
    if (this.reading) throw new Error("An inventory read is already in progress.");
    const generation = this.generation;
    this.reading = true;
    const slots = [];
    try {
      for (let slot = 0; slot < 30; slot++) {
        if (!this.connected || generation !== this.generation) throw new Error("Inventory read cancelled.");
        const result = await this.request("readSlot", { slot });
        if (!this.connected || generation !== this.generation) throw new Error("Inventory read cancelled.");
        const decoded = parseAmpSlotInfoResponse(result.frame);
        if (decoded.status !== 0) throw new Error(`Mosaic rejected slot ${slot + 1} (status ${decoded.status}).`);
        if (decoded.slot !== slot) throw new Error(`Mosaic returned the wrong record for slot ${slot + 1}.`);
        slots.push({ wireIndex: slot, hardwareSlot: slot + 1, name: decoded.name, metadata: [...decoded.metadata] });
        onProgress(slot + 1, 30);
      }
      return { capturedAt: new Date().toISOString(), source: "Mosaic USB", slots };
    } catch (error) {
      this.connected = false;
      throw error;
    } finally { this.reading = false; }
  }
  async send(command) {
    if (!this.connected) throw new Error("Connect Mosaic USB first.");
    if (!Number.isInteger(command?.midiCC) || command.midiCC < 0 || command.midiCC > 127 ||
        !Number.isInteger(command?.midiValue) || command.midiValue < 0 || command.midiValue > 127) {
      throw new Error("This hardware operation is not enabled yet.");
    }
    return this.request("sendControlChange", { controller: command.midiCC, value: command.midiValue });
  }
  onMidiEvent(listener) {
    if (typeof listener !== "function") throw new TypeError("MIDI event listener must be a function");
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  receivePacket(packet) {
    if (!this.connected || !Array.isArray(packet?.bytes)) return;
    for (let event of this.decoder.push(packet.bytes)) {
      if (event.type === "systemExclusive") {
        try { event = { ...event, type: "mosaicNotification", ...parseNotificationFrame(event.bytes) }; }
        catch (_) { /* A response or non-Mosaic SysEx packet remains generic. */ }
      }
      const receivedAt = Number(packet.receivedAt) || Date.now();
      for (const listener of this.listeners) listener({ ...event, receivedAt });
    }
  }
  async disconnect() {
    this.connected = false;
    this.generation++;
    this.decoder.reset();
    await this.request("disconnect");
  }
}
