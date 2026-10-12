import { useEffect, useRef, useState } from 'react'
import { initialDraft, parseDraft, encodeDraft, STORAGE_KEY, MAX_PROJECT_BYTES, withAsset, type Draft, type LibraryKind } from './project.ts'
import { inspectAsset } from './assets.ts'
import { planCommand, type Command, type Plan } from './controller.ts'

declare global {
  interface Window {
    webkit?: { messageHandlers?: { exportDraft?: { postMessage(value: { name: string; text: string }): void } } }
  }
}
const errorText = (error: unknown) => error instanceof Error ? error.message : 'The operation could not be completed.'
function restore() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return { draft: saved ? parseDraft(saved) : initialDraft(), notice: saved ? 'Your local draft has been restored.' : 'Edit a draft while the pedal is unavailable.', canSave: true }
  } catch {
    return { draft: initialDraft(), notice: 'The saved draft could not be read. It has been left untouched. Import a valid draft or edit this new one to replace it.', canSave: false }
  }
}

export function useProject() {
  const [restored] = useState(restore)
  const [draft, updateDraft] = useState<Draft>(restored.draft)
  const [notice, setNotice] = useState(restored.notice)
  const [saveStatus, setSaveStatus] = useState(restored.canSave ? 'Saving draft…' : 'Saved draft needs attention')
  const [lastPlan, setLastPlan] = useState<Plan | null>(null)
  const [busySlots, setBusySlots] = useState<Set<string>>(new Set())
  const canSave = useRef(restored.canSave)
  const jobs = useRef(new Map<string, number>())
  const generation = useRef(0)
  const setDraft = (next: Draft | ((previous: Draft) => Draft)) => {
    canSave.current = true
    updateDraft(next)
  }
  useEffect(() => {
    if (!canSave.current) return
    try { localStorage.setItem(STORAGE_KEY, encodeDraft(draft)); setSaveStatus('Draft saved locally') }
    catch { setSaveStatus('Could not save locally — use Export draft') }
  }, [draft])
  useEffect(() => {
    const result = (event: Event) => {
      const detail = (event as CustomEvent<{ status: string; message?: string }>).detail
      setNotice(detail.status === 'saved' ? 'Draft exported. Original model and IR files are kept separately.' : detail.status === 'cancelled' ? 'Export cancelled.' : detail.message ?? 'Export failed.')
    }
    window.addEventListener('jimcommand-export-result', result)
    return () => window.removeEventListener('jimcommand-export-result', result)
  }, [])
  const record = (command: Command) => setLastPlan(planCommand(command))
  async function importProject(file: File) {
    const current = ++generation.current
    jobs.current.clear()
    setBusySlots(new Set())
    try {
      if (file.size > MAX_PROJECT_BYTES) throw new Error('Project exceeds 512 KB.')
      const incoming = parseDraft(await file.text())
      if (current !== generation.current) return
      setDraft(incoming)
      setLastPlan(null)
      setNotice('Draft imported. Model and IR files are referenced by fingerprint; keep the originals.')
    } catch (error) { if (current === generation.current) setNotice(`Import failed: ${errorText(error)} Your current draft is unchanged.`) }
  }
  function exportProject() {
    try {
      const text = encodeDraft(draft)
      const name = `${draft.name.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 70) || 'Mosaic'}.jimcommand.json`
      const native = window.webkit?.messageHandlers?.exportDraft
      if (native) { native.postMessage({ name, text }); return }
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url; link.download = name; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Draft download requested. Original model and IR files are kept separately.')
    } catch (error) { setNotice(`Export failed: ${errorText(error)}`) }
  }
  async function inspectFile(file: File, kind: LibraryKind, slot: number) {
    const key = `${kind}:${slot}`, job = (jobs.current.get(key) ?? 0) + 1, epoch = generation.current
    jobs.current.set(key, job)
    setBusySlots(previous => new Set([...previous, key]))
    try {
      const asset = await inspectAsset(file, kind, slot)
      if (generation.current !== epoch || jobs.current.get(key) !== job) return
      setDraft(previous => withAsset(previous, asset))
      setNotice(`${file.name} checked for ${kind.toLowerCase()} position ${slot}. Nothing uploaded.`)
    } catch (error) {
      if (generation.current === epoch && jobs.current.get(key) === job) setNotice(`File check failed: ${errorText(error)}`)
    } finally {
      if (generation.current === epoch && jobs.current.get(key) === job)
        setBusySlots(previous => { const next = new Set(previous); next.delete(key); return next })
    }
  }
  return { draft, setDraft, notice, setNotice, saveStatus, lastPlan, record, importProject, exportProject, inspectFile, busySlots }
}
