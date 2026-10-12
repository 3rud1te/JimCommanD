import { makeLibrary, PRESET_SLOT_COUNT } from "./core/slot-map.js";
import { validateCaptureFile } from "./core/file-validation.js";
import { CaptureStore } from "./core/capture-store.js";
import { PresetStore } from "./core/preset-store.js";
import { SimulatedMosaic } from "./transports/simulated-mosaic.js";
import { HardwareMidiTransport } from "./transports/hardware-midi.js";
import {
  EFFECT_BLOCKS,
  buildEffectParameterCommand,
  buildEffectTypeCommand,
  effectValueKey,
  getEffectType
} from "./core/effect-types.js";

const configs = {
  input:{type:"IN",title:"Input",color:"#22d3ee",params:[["Input Gain",0,-12,12,"dB"]]},
  fx1:{type:"FX1",title:"Dynamics",color:"#6366f1",params:[["Threshold",-48,-80,0,"dB"],["Attack",10,1,100,"ms"],["Release",80,10,500,"ms"],["Ratio",4,1,20,""]]},
  fx2:{type:"FX2",title:"Drive & Filter",color:"#ef4444",params:[["Gain",55,0,100,""] ,["Tone",50,0,100,""] ,["Level",60,0,100,""]]},
  pedal:{type:"PED",title:"Pedal Capture",color:"#f59e0b",params:[],library:"pedal"},
  amp:{type:"AMP",title:"Amplifier",color:"#22d3ee",params:[["Gain",62,0,100,""] ,["Bass",55,0,100,""] ,["Mid",48,0,100,""] ,["Treble",60,0,100,""] ,["Presence",40,0,100,""]],library:"amplifier"},
  cab:{type:"CAB",title:"Cabinet IR",color:"#84cc16",params:[["Low Cut",80,20,500,"Hz"],["High Cut",8000,2000,20000,"Hz"],["Level",0,-12,12,"dB"]],library:"cabinet"},
  delay:{type:"DEL",title:"Delay",color:"#f472b6",params:[],effectBlock:"delay"},
  mod:{type:"MOD",title:"Modulation",color:"#a78bfa",params:[],effectBlock:"mod"},
  reverb:{type:"REV",title:"Reverb",color:"#34d399",params:[],effectBlock:"reverb"},
  eq:{type:"EQ",title:"EQ",color:"#fb923c",params:[["Low",0,-15,15,"dB"],["Mid",0,-15,15,"dB"],["High",0,-15,15,"dB"],["Level",0,-15,15,"dB"]]},
  output:{type:"OUT",title:"Output",color:"#22d3ee",params:[["Output Level",80,0,100,""]]}
};

const state={selected:"amp",enabled:Object.fromEntries(Object.keys(configs).map(k=>[k,true])),values:{},effectTypes:{mod:0,delay:0,reverb:0},slots:{amplifier:1,pedal:1,cabinet:1},preset:1};
for(const [id,c] of Object.entries(configs)) for(const p of c.params) state.values[`${id}:${p[0]}`]=p[1];
for(const [block,definition] of Object.entries(EFFECT_BLOCKS)) for(const effectType of definition.types) for(const parameter of effectType.parameters) state.values[effectValueKey(block,effectType.id,parameter.name)]=parameter.defaultValue;
const captureStore=new CaptureStore(), presetStore=new PresetStore(); let transport=new SimulatedMosaic();
const $=s=>document.querySelector(s), chain=$("#chain"), parameters=$("#parameters"), library=$("#library");

for(const [id,c] of Object.entries(configs)){const b=document.createElement("button");b.textContent=c.type;b.dataset.id=id;b.style.setProperty("--accent",c.color);b.onclick=()=>select(id);chain.append(b)}
for(let i=1;i<=PRESET_SLOT_COUNT;i++){const o=document.createElement("option");o.value=i;o.textContent=String(i).padStart(2,"0");$("#presetSlot").append(o)}
$("#presetSlot").onchange=e=>{state.preset=Number(e.target.value);const saved=presetStore.load(state.preset);if(saved){Object.assign(state,saved.state);render();setStatus(`Loaded preset ${state.preset}`)}else{$("#presetName").textContent=`Preset ${String(state.preset).padStart(2,"0")}`;setStatus("Empty preset slot")}};
$("#savePreset").onclick=()=>{presetStore.save(state.preset,{name:$("#presetName").textContent,state});setStatus(`Preset ${state.preset} saved locally`)};
$("#transport").onchange=e=>{transport=e.target.value==="simulator"?new SimulatedMosaic():new HardwareMidiTransport();$("#connection").innerHTML=e.target.value==="simulator"?"<i></i> SIMULATED MOSAIC":"<i></i> HARDWARE PENDING";setStatus(e.target.value==="simulator"?"Simulator active":"Physical Mosaic required")};
$("#bypass").onclick=()=>{const id=state.selected,c=configs[id],enabled=!state.enabled[id];state.enabled[id]=enabled;render();const definition=c.effectBlock?EFFECT_BLOCKS[c.effectBlock]:null;send({type:"SET_BLOCK_ENABLED",block:id,enabled,midiCC:definition?.bypassCC,midiValue:enabled?127:0})};

function select(id){state.selected=id;render()}
function render(){const c=configs[state.selected];document.documentElement.style.setProperty("--accent",c.color);$("#blockTitle").textContent=c.title;$("#bypass").textContent=state.enabled[state.selected]?"Enabled":"Bypassed";[...chain.children].forEach(b=>b.classList.toggle("active",b.dataset.id===state.selected));parameters.replaceChildren();
  for(const [name,,min,max,unit] of c.params){const key=`${state.selected}:${name}`,wrap=document.createElement("div");wrap.className="control";const value=state.values[key];wrap.innerHTML=`<div class="knob"></div><input type="range" min="${min}" max="${max}" step="${max-min<=20?0.1:1}" value="${value}"><output>${value}${unit}</output><label>${name.toUpperCase()}</label>`;const input=wrap.querySelector("input"),knob=wrap.querySelector(".knob"),out=wrap.querySelector("output");const paint=()=>knob.style.setProperty("--turn",`${-135+(Number(input.value)-min)/(max-min)*270}deg`);paint();input.oninput=()=>{state.values[key]=Number(input.value);out.textContent=`${input.value}${unit}`;paint();send({type:"SET_PARAMETER",block:state.selected,parameter:name,value:Number(input.value),unit})};parameters.append(wrap)}
  renderLibrary(c.library);}

render=function(){
  const id=state.selected,c=configs[id];
  document.documentElement.style.setProperty("--accent",c.color);
  $("#blockTitle").textContent=c.title;
  $("#bypass").textContent=state.enabled[id]?"Enabled":"Bypassed";
  [...chain.children].forEach(b=>b.classList.toggle("active",b.dataset.id===id));
  parameters.replaceChildren();
  if(c.effectBlock)renderEffectControls(c.effectBlock);
  else renderStandardControls(id,c.params);
  renderLibrary(c.library);
};

function renderEffectControls(block){
  const typeId=state.effectTypes[block],selectedType=getEffectType(block,typeId);
  renderEffectPicker(block,typeId);
  for(const definition of selectedType.parameters){
    const key=effectValueKey(block,typeId,definition.name);
    renderParameter(definition,key,value=>buildEffectParameterCommand(block,typeId,definition.name,value));
  }
}

function renderStandardControls(block,definitions){
  for(const [name,defaultValue,min,max,unit] of definitions){
    const definition={name,defaultValue,min,max,unit,step:max-min<=20?0.1:1,options:null};
    renderParameter(definition,`${block}:${name}`,value=>({type:"SET_PARAMETER",block,parameter:name,value,unit}));
  }
}

function renderLibrary(kind){library.replaceChildren();if(!kind){library.hidden=true;return}library.hidden=false;const slots=makeLibrary(kind);const title=kind==="amplifier"?"AMPLIFIER LIBRARY":kind==="pedal"?"PEDAL LIBRARY":"CABINET IR LIBRARY";const accept=kind==="cabinet"?".wav,.ir":".nam,.nam2";library.innerHTML=`<h3>${title}</h3><p>${slots.length} dedicated ${kind==="cabinet"?"IR":"NAM"} positions stored locally until hardware transfer is available.</p><div class="library-row"><select aria-label="${title} slot">${slots.map(s=>`<option value="${s.logicalSlot}">${kind==="cabinet"?"Cabinet IR":kind[0].toUpperCase()+kind.slice(1)} ${String(s.logicalSlot).padStart(2,"0")}</option>`).join("")}</select><label class="file">+ Load custom ${kind==="cabinet"?"IR file":"capture"}…<input type="file" accept="${accept}"></label><span class="mapping"></span></div>`;const select=library.querySelector("select"),file=library.querySelector("input"),mapping=library.querySelector(".mapping");select.value=state.slots[kind];const show=()=>{const s=slots[Number(select.value)-1];mapping.textContent=`Logical ${s.logicalSlot} → hardware ${s.hardwareSlot}`};show();select.onchange=()=>{state.slots[kind]=Number(select.value);show();send({type:"SELECT_LIBRARY_SLOT",kind,...slots[state.slots[kind]-1]})};file.onchange=async()=>{try{const f=file.files[0],meta=validateCaptureFile(f,kind);const s=slots[state.slots[kind]-1];await captureStore.put(kind,s.hardwareSlot,f,{logicalSlot:s.logicalSlot,format:meta.format});await send({type:"UPLOAD_CAPTURE",kind,logicalSlot:s.logicalSlot,hardwareSlot:s.hardwareSlot,metadata:{name:f.name,size:f.size,format:meta.format}});setStatus(`${f.name} saved locally in ${kind} slot ${s.logicalSlot}`)}catch(error){setStatus(error.message,true)}}}

async function send(command){try{await transport.send(command);setStatus(`${command.type.replaceAll("_"," ").toLowerCase()} acknowledged`)}catch(error){setStatus(error.message,true)}}
function setStatus(message,error=false){$("#status").textContent=message;$("#status").style.color=error?"#ff6b6b":"#89919f"}
function renderEffectPicker(block,typeId){
  const definition=EFFECT_BLOCKS[block];
  const wrap=document.createElement("div");
  const label=document.createElement("label");
  const picker=document.createElement("select");
  const hint=document.createElement("span");
  wrap.setAttribute("class","effect-picker");
  label.append("ALGORITHM ");
  picker.setAttribute("aria-label","Effect algorithm");
  const types=definition.types;
  types.forEach(t=>addEffectOption(picker,t));
  picker.value=typeId;
  hint.append("TYPE CC",definition.typeCC);
  hint.append(" · exact ID ",typeId);
  parameters.appendChild(wrap);
  label.appendChild(picker);
  wrap.appendChild(label);
  wrap.appendChild(hint);
  picker.name=block;
  picker.onchange=changeEffect;
}
function renderParameter(definition,key,makeCommand){}
function changeEffect({target:t}){setEffect(t.name,+t.value)}
function setEffect(block,typeId){}
function addEffectOption(p,t){p.add(new Option(t.name,t.id))}
// UI ready.
render();
