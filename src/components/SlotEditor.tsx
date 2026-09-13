import { useEffect, useState } from 'react'
import type { ScheduleSlot, SessionType } from '../types/routine'
import { DAY_LABELS } from '../types/routine'
import { fromInputTime, toInputTime } from '../services/timeUtils'
import { Button, Field, Input } from './ui'

interface Props {
  slot: ScheduleSlot
  isNew: boolean
  onSave: (slot: ScheduleSlot) => void
  onDelete: (id: string) => void
  onClose: () => void
}

/** Modal editor for a single class session. */
export function SlotEditor({ slot, isNew, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState(slot)
  const [codeInput, setCodeInput] = useState(
    slot.section ? `${slot.courseCode}.${slot.section}` : slot.courseCode,
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const commit = () => {
    const m = /^([A-Za-z]{2,5})\s*-?\s*(\d{3}[A-Za-z]?)(?:\.(\d{1,2}))?/.exec(codeInput.trim())
    const courseCode = m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : codeInput.trim().toUpperCase()
    const section = m?.[3] ?? ''
    if (!courseCode) return
    onSave({ ...draft, courseCode, section, room: draft.room.trim(), source: 'manual' })
  }

  const setType = (type: SessionType) => setDraft((d) => ({ ...d, type }))

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-editor-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <h3 id="slot-editor-title" className="text-base font-semibold text-slate-900 dark:text-slate-50">
          {isNew ? 'Add class' : 'Edit class'}
          <span className="ml-2 text-sm font-normal text-slate-500">{DAY_LABELS[slot.day]}</span>
        </h3>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field
            label="Course code · section"
            className="col-span-2"
            hint="e.g. CSE 443.2 — section after the dot"
          >
            <Input
              autoFocus
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
              placeholder="CSE 443.2"
              className="font-mono"
            />
          </Field>
          <Field label="Room">
            <Input
              value={draft.room}
              onChange={(e) => setDraft({ ...draft, room: e.target.value })}
              placeholder="N204"
            />
          </Field>
          <Field label="Type">
            <div className="flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
              {(['theory', 'lab'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    draft.type === t
                      ? t === 'lab'
                        ? 'bg-lab-500 text-white'
                        : 'bg-theory-500 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Starts">
            <Input
              type="time"
              value={toInputTime(draft.startMin)}
              onChange={(e) => setDraft({ ...draft, startMin: fromInputTime(e.target.value) })}
            />
          </Field>
          <Field label="Ends">
            <Input
              type="time"
              value={toInputTime(draft.endMin)}
              onChange={(e) => setDraft({ ...draft, endMin: fromInputTime(e.target.value) })}
            />
          </Field>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          {!isNew ? (
            <Button variant="danger" size="sm" onClick={() => onDelete(slot.id)}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={commit} disabled={!codeInput.trim()}>
              {isNew ? 'Add' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
