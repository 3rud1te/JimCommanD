import { useState, useId, useRef } from "react"
import { type Param, type Block } from "./model.ts"
import { useProject } from "./useProject.ts"
import LibraryPanel from "./LibraryPanel.tsx"
import MidiDiagnostics from "./MidiDiagnostics.tsx"
import { type LibraryKind } from "./project.ts"

// ── Knob component ─────────────────────────────────────────────────────────
function Knob({
  param,
  color,
  onChange,
}: {
  param: Param
  color: string
  onChange: (v: number) => void
}) {
  const gradientId = useId()
  const pct = (param.value - param.min) / (param.max - param.min)
  const startDeg = -135
  const endDeg = 135
  const angle = startDeg + pct * (endDeg - startDeg)
  const r = 18
  const cx = 22,
    cy = 22

  const polarXY = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  const arcStart = polarXY(startDeg)
  const arcCurrent = polarXY(angle)
  const arcEnd = polarXY(endDeg)
  const largeArc = angle - startDeg > 180 ? 1 : 0

  const dot = {
    x: cx + 11 * Math.cos(((angle - 90) * Math.PI) / 180),
    y: cy + 11 * Math.sin(((angle - 90) * Math.PI) / 180),
  }

  const fmt = (v: number) => {
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`
    if (Number.isInteger(v)) return `${v}`
    return `${v.toFixed(1)}`
  }

  let startY = 0
  let startVal = param.value

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <svg
        width={44}
        height={44}
        className="cursor-ns-resize"
        role="slider"
        tabIndex={0}
        aria-label={param.name}
        aria-valuemin={param.min}
        aria-valuemax={param.max}
        aria-valuenow={param.value}
        aria-valuetext={`${fmt(param.value)} ${param.unit ?? ""}`}
        onKeyDown={(event) => {
          const step = (param.max - param.min) / 100
          const direction = ["ArrowUp", "ArrowRight"].includes(event.key) ? 1 : ["ArrowDown", "ArrowLeft"].includes(event.key) ? -1 : 0
          if (direction || event.key === "Home" || event.key === "End") {
            event.preventDefault()
            onChange(event.key === "Home" ? param.min : event.key === "End" ? param.max : Math.max(param.min, Math.min(param.max, param.value + direction * step)))
          }
        }}
        onMouseDown={(e) => {
          startY = e.clientY
          startVal = param.value
          const range = param.max - param.min
          const onMove = (ev: MouseEvent) => {
            const delta = (startY - ev.clientY) / 80
            onChange(
              Math.max(
                param.min,
                Math.min(param.max, startVal + delta * range),
              ),
            )
          }
          const onUp = () => {
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup", onUp)
          }
          window.addEventListener("mousemove", onMove)
          window.addEventListener("mouseup", onUp)
        }}
        onWheel={(e) => {
          const step = (param.max - param.min) / 100
          onChange(
            Math.max(
              param.min,
              Math.min(param.max, param.value - Math.sign(e.deltaY) * step),
            ),
          )
        }}
      >
        <defs>
          <radialGradient id={gradientId} cx="40%" cy="30%">
            <stop offset="0%" stopColor="#3f3f46" />
            <stop offset="100%" stopColor="#18181b" />
          </radialGradient>
        </defs>
        {/* Track */}
        <path
          d={`M${arcStart.x},${arcStart.y} A${r},${r} 0 1 1 ${arcEnd.x},${arcEnd.y}`}
          fill="none"
          stroke="#27272a"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={`M${arcStart.x},${arcStart.y} A${r},${r} 0 ${largeArc} 1 ${arcCurrent.x},${arcCurrent.y}`}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.85}
        />
        {/* Cap */}
        <circle cx={cx} cy={cy} r={12} fill={`url(#${gradientId})`} />
        <circle cx={cx} cy={cy} r={12} fill="none" stroke="#ffffff08" />
        {/* Dot */}
        <circle
          cx={dot.x}
          cy={dot.y}
          r={2}
          fill={color}
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
      </svg>
      <span
        className="text-[10px] tabular-nums"
        style={{ color: "#a1a1aa", fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace" }}
      >
        {fmt(param.value)}
        {param.unit ? (
          <span style={{ color: "#52525b" }}>{param.unit}</span>
        ) : null}
      </span>
      <span
        className="text-[9px] text-center leading-tight"
        style={{
          color: "#52525b",
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
          maxWidth: 44,
        }}
      >
        {param.name}
      </span>
    </div>
  )
}

// ── Effect block card ──────────────────────────────────────────────────────
function BlockCard({
  block,
  selected,
  onClick,
  onToggle,
}: {
  block: Block
  selected: boolean
  onClick: () => void
  onToggle: () => void
}) {
  return (
    <div
      className="relative flex flex-col items-center cursor-pointer select-none shrink-0"
      style={{ width: 72 }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Select ${block.label}`}
      aria-pressed={selected}
      onKeyDown={event => { if (event.target === event.currentTarget && ["Enter", " "].includes(event.key)) { event.preventDefault(); onClick() } }}
    >
      {/* Connector line */}
      <div
        className="absolute top-7 left-0 w-full h-[2px]"
        style={{ background: "#27272a", zIndex: 0 }}
      />

      {/* Block body */}
      <div
        className="relative z-10 flex flex-col items-center gap-1.5 px-2 pt-3 pb-2 rounded-xl transition-all"
        style={{
          background: selected ? "#27272a" : "#1c1c1e",
          border: `1.5px solid ${selected ? block.color : "#3f3f46"}`,
          boxShadow: selected ? `0 0 20px ${block.color}30` : "none",
          width: 60,
          opacity: block.enabled ? 1 : 0.4,
        }}
      >
        {/* Type badge */}
        <div
          className="text-[8px] font-bold px-1.5 py-0.5 rounded"
          style={{
            background: `${block.color}20`,
            color: block.color,
            fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
            letterSpacing: "0.05em",
          }}
        >
          {block.type}
        </div>

        {/* Toggle dot */}
        <button
          className="w-3 h-3 rounded-full border transition-all"
          aria-label={`Toggle ${block.label} in draft`}
          aria-pressed={block.enabled}
          style={{
            background: block.enabled ? block.color : "transparent",
            borderColor: block.enabled ? block.color : "#52525b",
            boxShadow: block.enabled ? `0 0 6px ${block.color}` : "none",
          }}
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
        />
      </div>

      {/* Label */}
      <span
        className="mt-1.5 text-center leading-tight"
        style={{
          color: selected ? "#e4e4e7" : "#71717a",
          fontSize: 9,
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
          maxWidth: 60,
        }}
      >
        {block.label}
      </span>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const project = useProject()
  const { draft, setDraft } = project
  const { chain, outputGainDb } = draft
  const [selectedId, setSelectedId] = useState("amp")
  const importRef = useRef<HTMLInputElement>(null)
  const inputStage: Block = { id: "input", type: "IN", label: "Input", color: "#22d3ee", enabled: true,
    params: [{ name: "Input Gain", value: draft.inputGain, min: -12, max: 12, unit: "dB" }] }
  const selectedBlock = selectedId === "input" ? inputStage : chain.find(block => block.id === selectedId)!
  const updateParam = (blockId: string, paramName: string, value: number) => {
    if (blockId === "input") {
      project.record({ type: "SET_INPUT_GAIN", db: value })
      setDraft(previous => ({ ...previous, inputGain: value }))
    } else {
      project.record({ type: "SET_PARAMETER", block: blockId, parameter: paramName, value })
      setDraft(previous => ({ ...previous, chain: previous.chain.map(block => block.id === blockId
        ? { ...block, params: block.params.map(param => param.name === paramName ? { ...param, value } : param) } : block) }))
    }
  }
  const toggleBlock = (id: string) => {
    const enabled = !chain.find(block => block.id === id)!.enabled
    project.record({ type: "SET_BYPASS", block: id, enabled })
    setDraft(previous => ({ ...previous, chain: previous.chain.map(block => block.id === id ? { ...block, enabled } : block) }))
  }
  const kind: LibraryKind | null = selectedId === "amp" ? "AMPLIFIER" : selectedId === "pedal" ? "PEDAL" : selectedId === "cab" ? "CABINET" : null
  const slot = kind === "AMPLIFIER" ? draft.selectedAmpSlot : kind === "PEDAL" ? draft.selectedPedalSlot : draft.selectedCabSlot

  return (
    <div
      className="min-h-full flex items-center justify-center p-3"
      style={{ background: "#0a0a0b", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div
        style={{
          width: "min(960px, 100%)",
          background: "#111113",
          borderRadius: 14,
          border: "1px solid #2a2a2e",
          boxShadow: "0 40px 100px #000000dd, 0 0 0 1px #ffffff06 inset",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Title bar ── */}
        <div
          className="flex items-center gap-3 px-4 shrink-0"
          style={{
            height: 44,
            background: "#0d0d0f",
            borderBottom: "1px solid #2a2a2e",
          }}
        >
          <div className="flex gap-2">
            {["#ff5f57", "#ffbd2e", "#28c840"].map((c) => (
              <div
                key={c}
                className="w-3 h-3 rounded-full"
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex-1 flex items-center justify-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#22d3ee", boxShadow: "0 0 6px #22d3ee" }}
            />
            <span
              className="text-[13px] font-medium"
              style={{
                color: "#a1a1aa",
                letterSpacing: "0.05em",
                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              JimCommanD
            </span>
          </div>
          {/* Output level */}
          <div className="flex items-center gap-2">
            <span
              className="text-[10px]"
              style={{
                color: "#52525b",
                fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
              }}
            >
              OUT
            </span>
            <input
              type="range"
              min={-12}
              max={12}
              step={0.1}
              value={outputGainDb}
              aria-label="Output gain (dB)"
              aria-valuetext={`${outputGainDb > 0 ? '+' : ''}${outputGainDb.toFixed(1)} dB`}
              title="Output gain: −12 dB cut to +12 dB boost; 0 dB is neutral"
              onChange={(e) => { const db = Number(e.target.value); project.record({ type: "SET_OUTPUT_GAIN", db }); setDraft(previous => ({ ...previous, outputGainDb: db })) }}
              className="appearance-none"
              style={{
                width: 80,
                height: 2,
                accentColor: "#22d3ee",
                cursor: "ew-resize",
              }}
            />
            <span
              className="text-[10px] tabular-nums"
              style={{
                color: "#a1a1aa",
                fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
                minWidth: 60,
              }}
            >
              {outputGainDb > 0 ? '+' : outputGainDb < 0 ? '−' : ''}{Math.abs(outputGainDb).toFixed(1)} dB
            </span>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* ── Center: chain + params ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Preset header */}
            <div
              className="flex items-center justify-between px-5 py-2.5 shrink-0"
              style={{
                borderBottom: "1px solid #2a2a2e",
                background: "#0f0f12",
              }}
            >
              <div>
                <div
                  className="text-sm font-semibold"
                  style={{ color: "#e4e4e7" }}
                >
                  <input aria-label="Draft name" value={draft.name} maxLength={80}
                    className="bg-transparent text-sm w-56 outline-none"
                    onChange={event => { const name = event.target.value; setDraft(previous => ({ ...previous, name })) }}
                    onBlur={() => { if (!draft.name.trim()) setDraft(previous => ({ ...previous, name: "My Mosaic draft" })) }} />
                </div>
                <div
                  className="text-[10px] mt-0.5"
                  style={{
                    color: "#52525b",
                    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
                  }}
                >
                  Local draft · device settings have not been read
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => importRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg text-xs transition-colors"
                  style={{
                    background: "#1c1c20",
                    color: "#71717a",
                    border: "1px solid #2a2a2e",
                  }}
                >
                  Import draft
                </button>
                <button
                  onClick={project.exportProject}
                  className="px-3 py-1.5 rounded-lg text-xs transition-colors"
                  style={{
                    background: "#1c1c20",
                    color: "#71717a",
                    border: "1px solid #2a2a2e",
                  }}
                >
                  Export draft
                </button>
              </div>
            </div>

            <input ref={importRef} type="file" accept=".json" className="hidden" aria-label="Import JimCommanD draft"
              onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void project.importProject(file) }} />
            <div className="px-5 py-3 bg-amber-500/5 border-b border-zinc-800 text-xs text-zinc-400">
              <span className="text-amber-300 font-medium">Offline editor</span> · Changes stay in this draft. Nothing is sent to the pedal.
            </div>
            {/* Signal chain */}
            <div
              className="flex items-start px-4 pt-5 pb-3 overflow-x-auto shrink-0"
              style={{ gap: 4, scrollbarWidth: "none" }}
            >
              {/* Input node */}
              <button
                className="flex flex-col items-center shrink-0"
                style={{ width: 40, cursor: "pointer" }}
                onClick={() => {
                  setSelectedId("input")
                }}
                aria-label="Select input gain"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: selectedId === "input" ? "#22d3ee15" : "#1c1c20",
                    border: selectedId === "input"
                      ? "1.5px solid #22d3ee"
                      : "1.5px solid #3f3f46",
                    boxShadow: selectedId === "input" ? "0 0 8px #22d3ee55" : "none",
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: selectedId === "input" ? "#22d3ee" : "#52525b" }}
                  />
                </div>
                <span
                  className="mt-1.5 text-[8px]"
                  style={{ color: "#3f3f46" }}
                >
                  IN
                </span>
              </button>

              {/* Connectors + blocks */}
              {chain.map((block) => (
                <div key={block.id} className="flex items-center shrink-0">
                  <div
                    className="w-2 h-[2px]"
                    style={{ background: "#27272a" }}
                  />
                  <BlockCard
                    block={block}
                    selected={selectedId === block.id}
                    onClick={() => {
                      setSelectedId(block.id)
                    }}
                    onToggle={() => toggleBlock(block.id)}
                  />
                </div>
              ))}

              {/* Output node */}
              <div className="flex items-center shrink-0">
                <div
                  className="w-2 h-[2px]"
                  style={{ background: "#27272a" }}
                />
                <div
                  className="flex flex-col items-center"
                  style={{ width: 40 }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: "#1c1c20",
                      border: "1.5px solid #3f3f46",
                    }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: "#22d3ee",
                        boxShadow: "0 0 5px #22d3ee",
                      }}
                    />
                  </div>
                  <span
                    className="mt-1.5 text-[8px]"
                    style={{ color: "#3f3f46" }}
                  >
                    OUT
                  </span>
                </div>
              </div>
            </div>

            {/* ── Contextual parameter area ── */}
            <div
              className="flex-1 flex flex-col overflow-hidden"
              style={{ borderTop: "1px solid #2a2a2e" }}
            >
              <div
                className="px-5 py-3 flex items-center gap-2 shrink-0"
                style={{ borderBottom: "1px solid #1e1e21" }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: selectedBlock.enabled
                      ? selectedBlock.color
                      : "#3f3f46",
                    boxShadow: selectedBlock.enabled
                      ? `0 0 5px ${selectedBlock.color}`
                      : "none",
                  }}
                />
                <span
                  className="text-xs font-medium"
                  style={{
                    color: selectedBlock.enabled ? "#e4e4e7" : "#52525b",
                  }}
                >
                  {selectedBlock.label}
                </span>
              </div>

              <div
                className="flex-1 px-5 py-4 overflow-y-auto"
                style={{ scrollbarWidth: "none" }}
              >
                <div className="flex flex-wrap gap-6">
                  {selectedBlock.params.map((p) => (
                    <Knob
                      key={p.name}
                      param={p}
                      color={selectedBlock.color}
                      onChange={(v) =>
                        updateParam(selectedBlock.id, p.name, v)
                      }
                    />
                  ))}
                </div>

                {kind ? <LibraryPanel kind={kind} slot={slot}
                  assets={draft.assets}
                  ampSource={draft.ampSource} builtInAmpId={draft.builtInAmpId}
                  onBuiltIn={id => setDraft(previous => ({ ...previous, ampSource: 'BUILT_IN', builtInAmpId: id }))}
                  busy={project.busySlots.has(`${kind}:${slot}`)}
                  onSlot={value => setDraft(previous => ({ ...previous,
                    ...(kind === "AMPLIFIER" ? { selectedAmpSlot: value, ampSource: 'CAPTURE' as const } : kind === "PEDAL" ? { selectedPedalSlot: value } : { selectedCabSlot: value }) }))}
                  onFile={file => { void project.inspectFile(file, kind, slot) }} /> : null}
                <p className="mt-5 text-[11px] text-zinc-400">Controls show your draft values. Device ranges and available algorithms will be checked during connection testing.</p>

              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-zinc-800 space-y-2">
          <p role="status" className="text-xs text-zinc-300">{project.notice}</p>
          <details className="text-xs text-zinc-400">
            <summary className="cursor-pointer py-1">Command preview · 0 messages sent</summary>
            <p className="mt-2">{project.lastPlan?.message ?? "Change a control to inspect its offline command plan."}</p>
            {project.lastPlan?.bytes.length ? <code className="block mt-2 text-cyan-300">MIDI channel 1 · {project.lastPlan.bytes.map(byte => byte.toString(16).padStart(2, "0").toUpperCase()).join(" ")}</code> : null}
          </details>
          <MidiDiagnostics />
        </div>
        {/* ── Status bar ── */}
        <div
          className="flex items-center justify-between px-5 py-2 shrink-0"
          style={{ background: "#0d0d0f", borderTop: "1px solid #2a2a2e" }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "#fbbf24" }}
              />
              <span
                className="text-[10px]"
                style={{
                  color: "#52525b",
                  fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
                }}
              >
                Offline · no device session
              </span>
            </div>
            <span
              className="text-[10px]"
              style={{
                color: "#3f3f46",
                fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
              }}
            >
              {project.saveStatus}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span
              className="text-[10px]"
              style={{
                color: "#3f3f46",
                fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
              }}
            >
              {chain.filter((b) => b.enabled).length}/{chain.length} blocks in draft
            </span>
            <span
              className="text-[10px]"
              style={{
                color: "#3f3f46",
                fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
              }}
            >
              Editor 0.1.0
            </span>
          </div>
        </div>
      </div>

      <style>{`
        input[type='range'] { cursor: ew-resize; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
