export class SimulatedMosaic {
  constructor() { this.connected = true; this.commands = []; this.parameters = new Map(); this.inventory = new Map(); }
  async send(command) {
    const stamped = { ...structuredClone(command), acknowledgedAt: Date.now(), transport: "SIMULATOR" };
    this.commands.push(stamped);
    if (command.type === "SET_PARAMETER") this.parameters.set(`${command.block}:${command.parameter}`, command.value);
    if (command.type === "UPLOAD_CAPTURE") this.inventory.set(`${command.kind}:${command.hardwareSlot}`, command.metadata);
    return { ok: true, command: stamped };
  }
  async disconnect() { this.connected = false; }
}
