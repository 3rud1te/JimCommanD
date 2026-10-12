import { useState } from 'react'

/** Enumeration only, separate from the offline controller. Never opens outputs or sends data. */
export default function MidiDiagnostics() {
  const [result, setResult] = useState('Port inspection is optional. The editor works without a MIDI device.')
  const [pending, setPending] = useState(false)
  async function inspect() {
    if (!navigator.requestMIDIAccess) {
      setResult('Web MIDI is unavailable in this browser. You can still edit and export drafts.')
      return
    }
    setPending(true)
    setResult('Awaiting browser MIDI access…')
    const timer = setTimeout(() => setResult('MIDI access is still pending in the browser. No connection has been confirmed.'), 15000)
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false })
      const inputs = Array.from(access.inputs.values()).map(port => `${port.name ?? 'Unnamed'} (${port.state})`)
      const outputs = Array.from(access.outputs.values()).map(port => `${port.name ?? 'Unnamed'} (${port.state})`)
      setResult(`Inputs: ${inputs.join(', ') || 'none'}. Outputs: ${outputs.join(', ') || 'none'}. This lists ports only; the controller remains offline.`)
    } catch (error) {
      setResult(`MIDI access did not complete: ${error instanceof Error ? error.message : String(error)}. The controller remains offline.`)
    } finally { clearTimeout(timer); setPending(false) }
  }
  return <details className="text-xs text-zinc-400">
    <summary className="cursor-pointer py-1">MIDI port diagnostic</summary>
    <p className="mt-2 mb-2" role="status">{result}</p>
    <button className="rounded border border-zinc-600 px-3 py-1.5 text-zinc-200 disabled:opacity-50" disabled={pending} onClick={inspect}>
      {pending ? 'Awaiting MIDI access…' : 'Check MIDI ports'}
    </button>
  </details>
}
