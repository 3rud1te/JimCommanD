const CHANNEL_LENGTHS = Object.freeze({
  0x80: 2, 0x90: 2, 0xA0: 2, 0xB0: 2,
  0xC0: 1, 0xD0: 1, 0xE0: 2
});

const REALTIME_NAMES = Object.freeze({
  0xF8: "Timing Clock", 0xFA: "Start", 0xFB: "Continue",
  0xFC: "Stop", 0xFE: "Active Sensing", 0xFF: "System Reset"
});

export class MidiStreamDecoder {
  constructor({ maxSysExBytes = 1024 * 1024 } = {}) {
    this.maxSysExBytes = maxSysExBytes;
    this.reset();
  }

  reset() {
    this.runningStatus = 0;
    this.status = 0;
    this.expected = 0;
    this.data = [];
    this.sysex = null;
  }

  push(input) {
    const events = [];
    for (const raw of input ?? []) this.#consume(Number(raw) & 0xFF, events);
    return events;
  }

  #consume(byte, events) {
    if (byte >= 0xF8) {
      events.push({ type: "systemRealtime", status: byte, name: REALTIME_NAMES[byte] ?? "System Realtime", bytes: [byte] });
      return;
    }

    if (this.sysex) {
      if (byte === 0xF7) {
        this.sysex.push(byte);
        events.push({ type: "systemExclusive", bytes: this.sysex });
        this.sysex = null;
      } else if (byte === 0xF0) {
        this.sysex = [byte];
      } else if (byte & 0x80 || this.sysex.length >= this.maxSysExBytes) {
        this.sysex = null;
        this.#consume(byte, events);
      } else {
        this.sysex.push(byte);
      }
      return;
    }

    if (byte === 0xF0) {
      this.runningStatus = 0;
      this.status = 0;
      this.sysex = [byte];
      return;
    }

    if (byte & 0x80) {
      this.#beginStatus(byte, events);
      return;
    }

    if (!this.status && this.runningStatus) this.#beginStatus(this.runningStatus, events);
    if (!this.status || !this.expected) return;
    this.data.push(byte);
    if (this.data.length !== this.expected) return;
    events.push(decodeMessage(this.status, this.data));
    const channelMessage = this.status < 0xF0;
    this.status = channelMessage ? this.runningStatus : 0;
    this.expected = channelMessage ? CHANNEL_LENGTHS[this.runningStatus & 0xF0] : 0;
    this.data = [];
  }

  #beginStatus(status, events) {
    this.status = status;
    this.data = [];
    if (status < 0xF0) {
      this.runningStatus = status;
      this.expected = CHANNEL_LENGTHS[status & 0xF0] ?? 0;
      return;
    }
    this.runningStatus = 0;
    this.expected = ({ 0xF1: 1, 0xF2: 2, 0xF3: 1 }[status] ?? 0);
    if (!this.expected) {
      events.push({ type: "systemCommon", status, bytes: [status] });
      this.status = 0;
    }
  }
}

export function decodeMessage(status, data) {
  const bytes = [status, ...data];
  if (status >= 0xF0) return { type: "systemCommon", status, data: [...data], bytes };
  const channel = (status & 0x0F) + 1;
  switch (status & 0xF0) {
    case 0x80:
      return { type: "noteOff", channel, note: data[0], velocity: data[1], bytes };
    case 0x90:
      return data[1] === 0
        ? { type: "noteOff", channel, note: data[0], velocity: 0, bytes }
        : { type: "noteOn", channel, note: data[0], velocity: data[1], bytes };
    case 0xA0:
      return { type: "polyPressure", channel, note: data[0], pressure: data[1], bytes };
    case 0xB0:
      return { type: "controlChange", channel, controller: data[0], value: data[1], bytes };
    case 0xC0:
      return { type: "programChange", channel, program: data[0], preset: data[0] + 1, bytes };
    case 0xD0:
      return { type: "channelPressure", channel, pressure: data[0], bytes };
    case 0xE0: {
      const value = data[0] | (data[1] << 7);
      return { type: "pitchBend", channel, value, centered: value - 8192, bytes };
    }
    default:
      return { type: "unknown", status, data: [...data], bytes };
  }
}

export function describeMidiEvent(event) {
  switch (event.type) {
    case "mosaicNotification": {
      const opcode = `0x${event.opcode.toString(16).toUpperCase().padStart(2, "0")}`;
      if (event.kind === "preset") return `Mosaic preset ${event.preset} · ${opcode}`;
      if (event.kind === "parameter") return `Mosaic parameter ${event.group}:${event.parameter} = ${Number(event.value.toFixed(4))} · ${opcode}`;
      if (event.kind === "value") return `Mosaic value ${event.value} · ${opcode}`;
      return `Mosaic notification ${opcode} · ${event.payload.length} bytes`;
    }
    case "programChange": return `Preset ${event.preset} · Program Change · channel ${event.channel}`;
    case "controlChange": return `CC ${event.controller} = ${event.value} · channel ${event.channel}`;
    case "noteOn": return `Note ${event.note} on · velocity ${event.velocity} · channel ${event.channel}`;
    case "noteOff": return `Note ${event.note} off · channel ${event.channel}`;
    case "polyPressure": return `Poly pressure ${event.note} = ${event.pressure} · channel ${event.channel}`;
    case "channelPressure": return `Channel pressure ${event.pressure} · channel ${event.channel}`;
    case "pitchBend": return `Pitch bend ${event.centered >= 0 ? "+" : ""}${event.centered} · channel ${event.channel}`;
    case "systemExclusive": return `SysEx received · ${event.bytes.length} bytes`;
    case "systemRealtime": return event.name;
    default: return `MIDI ${hexBytes(event.bytes)}`;
  }
}

export function hexBytes(bytes) {
  return [...(bytes ?? [])].map(value => Number(value).toString(16).padStart(2, "0").toUpperCase()).join(" ");
}
