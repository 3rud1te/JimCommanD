import { CAPACITY, type Asset, type LibraryKind } from './project.ts'
import { BUILT_IN_AMPS, assetLabel, libraryOptionLabel } from './amplifiers.ts'

type Props = { kind: LibraryKind; slot: number; assets: Asset[]; busy: boolean; onSlot(slot: number): void; onFile(file: File): void;
  ampSource: 'CAPTURE' | 'BUILT_IN'; builtInAmpId: string; onBuiltIn(id: string): void }
export default function LibraryPanel({ kind, slot, assets, busy, onSlot, onFile, ampSource, builtInAmpId, onBuiltIn }: Props) {
  const label = kind === 'AMPLIFIER' ? 'Amplifier' : kind === 'PEDAL' ? 'Pedal' : 'Cabinet'
  const asset = assets.find(item => item.kind === kind && item.slot === slot)
  const builtIn = kind === 'AMPLIFIER' && ampSource === 'BUILT_IN' ? BUILT_IN_AMPS.find(amp => amp.id === builtInAmpId) : undefined
  const options = Array.from({ length: CAPACITY[kind] }, (_, i) => <option key={i + 1} value={`slot:${i + 1}`}>
    {libraryOptionLabel(i + 1, assets.find(item => item.kind === kind && item.slot === i + 1))}
  </option>)
  return <section className="mt-5 flex flex-col gap-3" aria-label={`${label} library`}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label} Library</h2>
        <p className="text-xs mt-1 text-zinc-400">{kind === 'AMPLIFIER' ? '20 custom slots · 30 built-in amps' : `${CAPACITY[kind]} local ${kind === 'CABINET' ? 'IR' : 'NAM'} positions`}</p>
      </div>
      <select aria-label={kind === 'AMPLIFIER' ? 'Choose amplifier' : `${label} library position`}
        value={builtIn ? `builtin:${builtIn.id}` : `slot:${slot}`}
        onChange={event => { const [source, value] = event.target.value.split(':'); if (source === 'builtin') onBuiltIn(value); else onSlot(Number(value)) }}
        className="max-w-[55%] rounded-lg px-3 py-2 text-xs bg-[#1c1c20] text-zinc-200 border border-[#3f3f46] cursor-pointer">
        {kind === 'AMPLIFIER' ? <>
          <optgroup label="Your custom amp slots (20)">{options}</optgroup>
          <optgroup label="Mosaic built-in amps (30)">{BUILT_IN_AMPS.map(amp => <option key={amp.id} value={`builtin:${amp.id}`}>{amp.name}</option>)}</optgroup>
        </> : options}
      </select>
    </div>
    {builtIn ? <div className="rounded-lg bg-[#17171b] border border-zinc-800 px-3 py-3 text-xs space-y-1">
      <p className="text-cyan-300 font-medium">{builtIn.name} <span className="text-zinc-400 font-normal">· Built-in amp</span></p>
      <p className="text-zinc-400">Listed as {builtIn.id} in the Mosaic manual. Selected in your draft; availability on your pedal will be checked when connected.</p>
    </div> : <>
    <p className="text-[11px] text-zinc-400">{kind === 'PEDAL'
      ? 'Pedal captures use the NAM library. A separate simultaneous pedal stage is unverified.'
      : 'Device slot assignments will be confirmed when a pedal session is available.'}</p>
    <label className={`rounded-lg px-3 py-3 text-xs border border-dashed border-zinc-600 text-zinc-300 ${busy ? 'opacity-50' : 'cursor-pointer hover:border-cyan-500'}`}>
      {busy ? 'Checking file…' : asset ? `Choose replacement for ${asset.name}` : kind === 'CABINET' ? '+ Check an IR file…' : '+ Check a NAM capture…'}
      <input type="file" aria-label={`Check ${label.toLowerCase()} file`} className="sr-only" disabled={busy}
        accept={kind === 'CABINET' ? '.wav,.ir' : '.nam,.nam2'}
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onFile(file) }} />
    </label>
    {asset ? <div className="text-xs rounded-lg bg-[#17171b] border border-zinc-800 px-3 py-3 space-y-1 break-words">
      <p className="text-zinc-200">{assetLabel(asset)} <span className="text-amber-300">· Recorded locally</span></p>
      <p className="text-zinc-500">File: {asset.name}</p>
      <p className="text-zinc-400">{asset.summary}</p>
      <p className="text-zinc-500">{asset.bytes.toLocaleString('en-GB')} bytes · SHA-256 {asset.sha256.slice(0, 16)}…</p>
      <p className="text-zinc-400">Keep the original file. This draft stores its details, not the file itself.</p>
    </div> : null}
    </>}
  </section>
}
