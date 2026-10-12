import { makeLibrary, PRESET_SLOT_COUNT } from "./core/slot-map.js";
import { capturedNamName, CAPTURED_INVENTORY_DATE } from "./core/captured-inventory.js";
import { inspectCaptureFile } from "./core/file-validation.js";
import { prepareCabinetIr } from "./core/ir-conversion.js";
import { CaptureStore } from "./core/capture-store.js";
import { PresetStore } from "./core/preset-store.js";
import { SimulatedMosaic } from "./transports/simulated-mosaic.js";
import { HardwareMidiTransport } from "./transports/hardware-midi.js";
import { describeMidiEvent, hexBytes } from "./protocol/midi-events.js";
import {
  EFFECT_BLOCKS,
  buildEffectParameterCommand,
  buildEffectTypeCommand,
  effectValueKey,
  getEffectType
} from "./core/effect-types.js";

const configs = {
  input: block("IN", "Input", "#22d3ee", [
    standardParameter("Input Gain", 0, -12, 12, "dB")
  ]),
  fx1: block("FX1", "Dynamics", "#6366f1", [
    standardParameter("Threshold", -48, -80, 0, "dB"),
    standardParameter("Attack", 10, 1, 100, "ms"),
    standardParameter("Release", 80, 10, 500, "ms"),
    standardParameter("Ratio", 4, 1, 20, "")
  ]),
  fx2: block("FX2", "Drive & Filter", "#ef4444", [
    standardParameter("Gain", 55, 0, 100, ""),
    standardParameter("Tone", 50, 0, 100, ""),
    standardParameter("Level", 60, 0, 100, "")
  ]),
  pedal: libraryBlock("PED", "Pedal Capture", "#f59e0b", "pedal"),
  amp: libraryBlock("AMP", "Amplifier", "#22d3ee", "amplifier", [
    standardParameter("Gain", 62, 0, 100, ""),
    standardParameter("Bass", 55, 0, 100, ""),
    standardParameter("Mid", 48, 0, 100, ""),
    standardParameter("Treble", 60, 0, 100, ""),
    standardParameter("Presence", 40, 0, 100, "")
  ]),
  cab: libraryBlock("CAB", "Cabinet IR", "#84cc16", "cabinet", [
    standardParameter("Low Cut", 80, 20, 500, "Hz"),
    standardParameter("High Cut", 8000, 2000, 20000, "Hz"),
    standardParameter("Level", 0, -12, 12, "dB")
  ]),
  delay: effectBlock("DEL", "Delay", "#f472b6", "delay"),
  mod: effectBlock("MOD", "Modulation", "#a78bfa", "mod"),
  reverb: effectBlock("REV", "Reverb", "#34d399", "reverb"),
  eq: block("EQ", "EQ", "#fb923c", [
    standardParameter("Low", 0, -15, 15, "dB"),
    standardParameter("Mid", 0, -15, 15, "dB"),
    standardParameter("High", 0, -15, 15, "dB"),
    standardParameter("Level", 0, -15, 15, "dB")
  ]),
  output: block("OUT", "Output", "#22d3ee", [
    standardParameter("Output Level", 80, 0, 100, "")
  ])
};
const state = {
  selected: "amp",
  enabled: Object.fromEntries(Object.keys(configs).map(id => [id, true])),
  values: {},
  effectTypes: { mod: 0, delay: 0, reverb: 0 },
  slots: { amplifier: 1, pedal: 1, cabinet: 1 },
  preset: 1
};

const captureStore = new CaptureStore();
const presetStore = new PresetStore();
let transport = new SimulatedMosaic();
let deviceInventory = null;
let usbBusy = false;
let unsubscribeMidi = null;
let midiPulseTimer = null;
const midiEvents = [];

const query = selector => document.querySelector(selector);
const chain = query("#chain");
const parameters = query("#parameters");
const library = query("#library");
initializeValues();
initializeChain();
initializePresetSlots();
initializeEvents();
render();
function render() {
  const id = state.selected;
  const config = configs[id];
  document.documentElement.style.setProperty("--accent", config.color);
  query("#blockTitle").textContent = config.title;
  query("#bypass").textContent = state.enabled[id] ? "Enabled" : "Bypassed";
  for (const button of chain.children) {
    button.classList.toggle("active", button.dataset.id === id);
  }
  parameters.replaceChildren();
  if (config.effectBlock) renderEffectControls(config.effectBlock);
  else renderStandardControls(id, config.parameters);
  renderLibrary(config.library);
  const readOnly = transport instanceof HardwareMidiTransport;
  query("#bypass").disabled = readOnly && !config.effectBlock;
  parameters.querySelectorAll("input, select, button").forEach(control => {
    control.disabled = readOnly && control.dataset.hardwareMidi !== "true";
  });
}

function renderEffectControls(blockId) {
  const typeId = state.effectTypes[blockId];
  const selectedType = getEffectType(blockId, typeId);
  renderEffectPicker(blockId, typeId);
  for (const definition of selectedType.parameters) {
    const key = effectValueKey(blockId, typeId, definition.name);
    const makeCommand = value => buildEffectParameterCommand(
      blockId,
      typeId,
      definition.name,
      value
    );
    renderParameter(definition, key, makeCommand);
  }
}

function renderStandardControls(blockId, definitions) {
  for (const definition of definitions) {
    const key = `${blockId}:${definition.name}`;
    const makeCommand = value => ({
      type: "SET_PARAMETER",
      block: blockId,
      parameter: definition.name,
      value,
      unit: definition.unit
    });
    renderParameter(definition, key, makeCommand);
  }
}

function renderEffectPicker(blockId, typeId) {
  const definition = EFFECT_BLOCKS[blockId];
  const wrapper = document.createElement("div");
  const label = document.createElement("label");
  const select = document.createElement("select");
  const hint = document.createElement("span");
  wrapper.className = "effect-picker";
  label.append("ALGORITHM ");
  select.name = blockId;
  select.setAttribute("aria-label", `${definition.name} algorithm`);
  for (const type of definition.types) {
    select.add(new Option(type.name, type.id));
  }
  select.value = typeId;
  select.dataset.hardwareMidi = "true";
  select.onchange = changeEffectType;
  hint.append(
    `TYPE CC${definition.typeCC} · exact ID `,
    String(typeId)
  );
  label.append(select);
  wrapper.append(label, hint);
  parameters.append(wrapper);
}

function changeEffectType(event) {
  const blockId = event.currentTarget.name;
  const typeId = Number(event.currentTarget.value);
  state.effectTypes[blockId] = typeId;
  const command = buildEffectTypeCommand(blockId, typeId);
  render();
  send(command);
}

function renderParameter(definition, key, makeCommand) {
  const control = document.createElement("div");
  const knob = document.createElement("div");
  const output = document.createElement("output");
  const label = document.createElement("label");
  const midi = document.createElement("small");
  const value = state.values[key] ?? definition.defaultValue;
  const input = definition.options
    ? createOptionInput(definition, value)
    : createRangeInput(definition, value);

  control.className = "control";
  knob.className = "knob";
  label.textContent = definition.name.toUpperCase();
  if (definition.midiCC !== undefined) {
    midi.textContent = `CC${definition.midiCC}`;
    input.dataset.hardwareMidi = "true";
  }

  const paint = () => {
    const numeric = Number(input.value);
    const span = definition.max - definition.min;
    const proportion = (numeric - definition.min) / span;
    knob.style.setProperty("--turn", `${-135 + proportion * 270}deg`);
    output.textContent = formatParameterValue(definition, numeric);
  };
  const update = () => {
    const numeric = Number(input.value);
    state.values[key] = numeric;
    paint();
    send(makeCommand(numeric));
  };

  input[definition.options ? "onchange" : "oninput"] = update;
  control.append(knob, input, output, label, midi);
  parameters.append(control);
  paint();
}

function createRangeInput(definition, value) {
  const input = document.createElement("input");
  input.type = "range";
  input.min = definition.min;
  input.max = definition.max;
  input.step = definition.step;
  input.value = value;
  return input;
}

function createOptionInput(definition, value) {
  const select = document.createElement("select");
  select.className = "parameter-select";
  for (const option of definition.options) {
    select.add(new Option(option.label, option.value));
  }
  select.value = value;
  return select;
}

function formatParameterValue(definition, value) {
  if (definition.options) {
    const selected = definition.options.find(option => option.value === value);
    return selected?.label ?? String(value);
  }
  return `${value}${definition.unit}`;
}
function initializeValues() {
  for (const [blockId, config] of Object.entries(configs)) {
    for (const definition of config.parameters) {
      state.values[`${blockId}:${definition.name}`] = definition.defaultValue;
    }
  }
  for (const [blockId, definition] of Object.entries(EFFECT_BLOCKS)) {
    for (const type of definition.types) {
      for (const parameter of type.parameters) {
        const key = effectValueKey(blockId, type.id, parameter.name);
        state.values[key] = parameter.defaultValue;
      }
    }
  }
}

function initializeChain() {
  for (const [id, config] of Object.entries(configs)) {
    const button = document.createElement("button");
    button.textContent = config.type;
    button.dataset.id = id;
    button.style.setProperty("--accent", config.color);
    button.onclick = () => {
      state.selected = id;
      render();
    };
    chain.append(button);
  }
}

function initializePresetSlots() {
  for (let slot = 1; slot <= PRESET_SLOT_COUNT; slot += 1) {
    query("#presetSlot").add(
      new Option(String(slot).padStart(2, "0"), slot)
    );
  }
}

function initializeEvents() {
  query("#presetSlot").onchange = loadPreset;
  query("#savePreset").onclick = savePreset;
  query("#transport").onchange = changeTransport;
  query("#bypass").onclick = toggleBypass;
  query("#refreshInventory").onclick = refreshDeviceInventory;
  query("#clearMidiLog").onclick = clearMidiLog;
  query("#copyMidiLog").onclick = copyMidiLog;
}

function loadPreset(event) {
  state.preset = Number(event.currentTarget.value);
  const saved = presetStore.load(state.preset);
  if (!saved) {
    query("#presetName").textContent = presetLabel(state.preset);
    setStatus("Empty preset slot");
    return;
  }
  const savedState = saved.state;
  state.selected = savedState.selected ?? state.selected;
  Object.assign(state.enabled, savedState.enabled ?? {});
  Object.assign(state.values, savedState.values ?? {});
  Object.assign(state.effectTypes, savedState.effectTypes ?? {});
  Object.assign(state.slots, savedState.slots ?? {});
  query("#presetName").textContent = saved.name ?? presetLabel(state.preset);
  render();
  setStatus(`Loaded preset ${state.preset}`);
}

function savePreset() {
  const name = query("#presetName").textContent;
  presetStore.save(state.preset, { name, state });
  setStatus(`Preset ${state.preset} saved locally`);
}

async function changeTransport(event) {
  if (usbBusy) return;
  const simulator = event.currentTarget.value === "simulator";
  if (transport instanceof HardwareMidiTransport) {
    try { await transport.disconnect(); } catch (_) { /* Already unavailable. */ }
  }
  transport = simulator
    ? new SimulatedMosaic()
    : createHardwareTransport();
  query("#connection").innerHTML = simulator
    ? "<i></i> SIMULATED MOSAIC"
    : "<i></i> MOSAIC USB · NOT CONNECTED";
  query("#refreshInventory").disabled = simulator;
  render();
  if (simulator) setStatus("Simulator active");
  else await refreshDeviceInventory();
}

function createHardwareTransport() {
  if (unsubscribeMidi) unsubscribeMidi();
  const next = new HardwareMidiTransport();
  unsubscribeMidi = next.onMidiEvent(handleMidiEvent);
  clearMidiLog("Waiting for Mosaic footswitch input…");
  return next;
}

function handleMidiEvent(event) {
  if (event.type === "systemExclusive" && usbBusy) return;
  if (event.type === "systemRealtime" && [0xF8, 0xFE].includes(event.status)) return;
  midiEvents.unshift(event);
  midiEvents.length = Math.min(midiEvents.length, 12);
  query("#midiLast").textContent = describeMidiEvent(event);
  query("#midiBytes").textContent = hexBytes(event.bytes);
  const pulse = query("#midiPulse");
  pulse.classList.add("live");
  clearTimeout(midiPulseTimer);
  midiPulseTimer = setTimeout(() => pulse.classList.remove("live"), 180);
  renderMidiLog();
  applyIncomingMidi(event);
}

function applyIncomingMidi(event) {
  if (event.type === "mosaicNotification" && event.kind === "preset") {
    selectIncomingPreset(event.preset);
    return;
  }
  if (event.type === "programChange" && event.preset >= 1 && event.preset <= PRESET_SLOT_COUNT) {
    selectIncomingPreset(event.preset);
    return;
  }
  if (event.type !== "controlChange") return;
  const blockId = Object.entries(EFFECT_BLOCKS).find(([, definition]) => definition.bypassCC === event.controller)?.[0];
  if (!blockId) return;
  state.enabled[blockId] = event.value >= 64;
  render();
  if (!usbBusy) setStatus(`Mosaic ${blockId.toUpperCase()} ${state.enabled[blockId] ? "enabled" : "bypassed"}`);
}

function selectIncomingPreset(preset) {
  if (preset < 1 || preset > PRESET_SLOT_COUNT) return;
  state.preset = preset;
  query("#presetSlot").value = preset;
  query("#presetName").textContent = presetLabel(preset);
  if (!usbBusy) setStatus(`Mosaic selected preset ${preset}`);
}

function clearMidiLog(message = "Waiting for Mosaic footswitch input…") {
  midiEvents.length = 0;
  query("#midiLast").textContent = message;
  query("#midiBytes").textContent = "—";
  renderMidiLog();
}

function renderMidiLog() {
  const log = query("#midiLog");
  log.replaceChildren(...midiEvents.map(event => {
    const item = document.createElement("li");
    item.textContent = describeMidiEvent(event);
    item.title = hexBytes(event.bytes);
    return item;
  }));
}

async function copyMidiLog() {
  if (!midiEvents.length) { setStatus("No Mosaic MIDI events to copy.", true); return; }
  const text = [...midiEvents].reverse().map(event =>
    `${new Date(event.receivedAt).toISOString()}\t${describeMidiEvent(event)}\t${hexBytes(event.bytes)}`
  ).join("\n");
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const area = document.createElement("textarea");
    area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
    document.body.append(area); area.select();
    if (!document.execCommand("copy")) throw new Error("Copy failed");
    area.remove();
  }
  setStatus(`Copied ${midiEvents.length} Mosaic MIDI events.`);
}

async function refreshDeviceInventory() {
  if (usbBusy || !(transport instanceof HardwareMidiTransport)) return;
  usbBusy = true;
  query("#transport").disabled = true;
  query("#refreshInventory").disabled = true;
  try {
    setStatus("Connecting to Mosaic USB…");
    if (!transport.connected) await transport.connect();
    query("#connection").textContent = "MOSAIC USB · READING";
    const inventory = await transport.readInventory((done, count) => setStatus(`Reading model names ${done}/${count}…`));
    deviceInventory = inventory;
    const bluetooth = transport.connectionInfo?.bluetoothNotifications;
    query("#connection").textContent = bluetooth ? "MOSAIC USB + BLUETOOTH · LIVE" : "MOSAIC USB · LIVE";
    setStatus(bluetooth
      ? "Read all 30 model names; listening to Bluetooth footswitch notifications."
      : "Read all 30 model names; Bluetooth footswitch MIDI was not available at connection time.");
    render();
  } catch (error) {
    query("#connection").textContent = "MOSAIC USB · READ FAILED";
    setStatus(error.message, true);
  } finally {
    usbBusy = false;
    query("#transport").disabled = false;
    query("#refreshInventory").disabled = false;
  }
}

function toggleBypass() {
  const blockId = state.selected;
  const config = configs[blockId];
  const enabled = !state.enabled[blockId];
  const definition = config.effectBlock
    ? EFFECT_BLOCKS[config.effectBlock]
    : null;
  state.enabled[blockId] = enabled;
  render();
  send({
    type: "SET_BLOCK_ENABLED",
    block: blockId,
    enabled,
    midiCC: definition?.bypassCC,
    midiValue: enabled ? 127 : 0
  });
}
function renderLibrary(kind) {
  library.replaceChildren();
  if (!kind) {
    library.hidden = true;
    return;
  }
  library.hidden = false;
  const slots = makeLibrary(kind);
  const title = libraryTitle(kind);
  const heading = document.createElement("h3");
  const description = document.createElement("p");
  const row = document.createElement("div");
  const select = document.createElement("select");
  const fileLabel = document.createElement("label");
  const fileInput = document.createElement("input");
  const mapping = document.createElement("span");

  heading.textContent = title;
  description.textContent = libraryDescription(kind, slots.length);
  row.className = "library-row";
  select.setAttribute("aria-label", `${title} slot`);
  fileLabel.className = "file";
  fileLabel.append(kind === "cabinet" ? "+ Import WAV / IR…" : "+ Import NAM / EADL…");
  fileInput.type = "file";
  fileInput.accept = kind === "cabinet" ? ".wav,.ir" : ".nam,.nam2,.eadl";
  mapping.className = "mapping";

  for (const slot of slots) {
    select.add(new Option(librarySlotLabel(kind, slot), slot.logicalSlot));
  }
  select.value = state.slots[kind];
  select.onchange = () => selectLibrarySlot(kind, slots, select, mapping);
  fileInput.onchange = () => storeCapture(kind, slots, fileInput);
  fileLabel.append(fileInput);
  row.append(select, fileLabel, mapping);
  library.append(heading, description, row);
  showSlotMapping(slots, select, mapping);
}

function selectLibrarySlot(kind, slots, select, mapping) {
  state.slots[kind] = Number(select.value);
  const slot = slots[state.slots[kind] - 1];
  showSlotMapping(slots, select, mapping);
  if (transport instanceof HardwareMidiTransport) {
    setStatus("Browsing captured model names. Selecting a row does not change the pedal yet.");
    return;
  }
  send({ type: "SELECT_LIBRARY_SLOT", kind, ...slot });
}

function showSlotMapping(slots, select, mapping) {
  const slot = slots[Number(select.value) - 1];
  mapping.textContent =
    `Logical ${slot.logicalSlot} → hardware ${slot.hardwareSlot}`;
}

async function storeCapture(kind, slots, input) {
  try {
    const file = input.files[0];
    const metadata = await inspectCaptureFile(file, kind);
    const preparedFile = kind === "cabinet" ? await prepareCabinetIr(file, metadata) : file;
    const slot = slots[state.slots[kind] - 1];
    await captureStore.put(kind, slot.hardwareSlot, preparedFile, {
      logicalSlot: slot.logicalSlot,
      format: metadata.format,
      originalName: file.name,
      converted: preparedFile !== file,
      inspection: metadata
    });
    const command = {
      type: "UPLOAD_CAPTURE",
      kind,
      logicalSlot: slot.logicalSlot,
      hardwareSlot: slot.hardwareSlot,
      metadata: {
        name: preparedFile.name,
        size: preparedFile.size,
        format: metadata.format
      }
    };
    if (transport instanceof HardwareMidiTransport) {
      const conversion = metadata.conversionRequired
        ? ` · conversion required${metadata.conversionReasons?.length ? ` (${metadata.conversionReasons.join(", ")})` : ""}`
        : " · Mosaic-ready container";
      setStatus(`${file.name} staged for hardware slot ${slot.hardwareSlot}${conversion}`);
    } else {
      await send(command);
      setStatus(`${file.name} saved locally in ${kind} slot ${slot.logicalSlot}`);
    }
  } catch (error) {
    setStatus(error.message, true);
  }
}

function libraryTitle(kind) {
  if (kind === "amplifier") return "AMPLIFIER LIBRARY";
  if (kind === "pedal") return "PEDAL LIBRARY";
  return "CABINET IR LIBRARY";
}

function libraryDescription(kind, count) {
  if (kind === "cabinet") return count + " IR positions. Device names have not been read yet.";
  if (deviceInventory) return `Last USB read: ${new Date(deviceInventory.capturedAt).toLocaleString()} · 30 model names. ` +
    "Model selection and uploads are not enabled on the pedal yet.";
  return `Device names captured ${CAPTURED_INVENTORY_DATE} · saved snapshot, not a live connection. ` +
    "Amplifier/pedal groups follow your app layout. File imports are stored locally.";
}

function librarySlotLabel(kind, slot) {
  const prefix = kind === "cabinet"
    ? "Cabinet IR"
    : kind[0].toUpperCase() + kind.slice(1);
  const label = `${prefix} ${String(slot.logicalSlot).padStart(2, "0")}`;
  if (kind === "cabinet") return label;
  const name = deviceInventory?.slots[slot.hardwareSlot - 1]?.name ?? capturedNamName(slot.hardwareSlot);
  return `${label} — ${name || "[blank name]"}`;
}
function block(type, title, color, parameters = []) {
  return { type, title, color, parameters };
}

function libraryBlock(type, title, color, libraryName, parameters = []) {
  return {
    ...block(type, title, color, parameters),
    library: libraryName
  };
}

function effectBlock(type, title, color, effectBlockId) {
  return {
    ...block(type, title, color),
    effectBlock: effectBlockId
  };
}

function standardParameter(name, defaultValue, min, max, unit) {
  return {
    name,
    defaultValue,
    min,
    max,
    unit,
    step: max - min <= 20 ? 0.1 : 1,
    options: null
  };
}

function presetLabel(slot) {
  return `Preset ${String(slot).padStart(2, "0")}`;
}

async function send(command) {
  try {
    await transport.send(command);
    const label = command.type.replaceAll("_", " ").toLowerCase();
    const midi = command.midiCC === undefined
      ? ""
      : ` · CC${command.midiCC}=${command.midiValue}`;
    setStatus(`${label} acknowledged${midi}`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function setStatus(message, error = false) {
  const status = query("#status");
  status.textContent = message;
  status.style.color = error ? "#ff6b6b" : "#89919f";
}
