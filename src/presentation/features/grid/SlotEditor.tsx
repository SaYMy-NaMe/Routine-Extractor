import { useEffect, useId, useState } from 'react'
import {
  type ClassFrequency,
  DAY_LABELS,
  FREQUENCY_LABELS,
  type ScheduleSlot,
  type SessionType,
  type TimeSlot,
  defaultFrequency,
  fromInputTime,
  fullCourseCode,
  parseCourseCode,
  toInputTime,
} from '../../../domain'
import { Button, Field, Input, Segmented } from '../../components/ui'

interface Props {
  slot: ScheduleSlot
  isNew: boolean
  /** When given, the editor lets the user move the session to another column. */
  columns?: readonly TimeSlot[]
  onSave: (slot: ScheduleSlot) => void
  onDelete: (id: string) => void
  onClose: () => void
}

/** Modal editor for a single class session (day and evening columns alike). */
export function SlotEditor({ slot, isNew, columns, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState(slot)
  const [codeInput, setCodeInput] = useState(fullCourseCode(slot))
  const [codeError, setCodeError] = useState<string | null>(null)
  const titleId = useId()
  const column = columns?.find((c) => c.id === draft.slotId)
  const evening = Boolean(column?.evening)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const commit = () => {
    const parsed = parseCourseCode(codeInput)
    if (!parsed) {
      setCodeError('Use the form DEPT 123 or DEPT 123.4 (e.g. CSE 443.2)')
      return
    }
    if (draft.endMin <= draft.startMin) {
      setCodeError('The class must end after it starts')
      return
    }
    onSave({
      ...draft,
      courseCode: parsed.courseCode,
      section: parsed.section,
      room: draft.room.trim().slice(0, 20),
      source: 'manual',
      ...(evening
        ? { frequency: draft.frequency ?? defaultFrequency(draft.type) }
        : { frequency: undefined }),
    })
  }

  const setType = (type: SessionType) =>
    setDraft((d) => ({
      ...d,
      type,
      ...(evening && !d.frequency ? { frequency: defaultFrequency(type) } : {}),
    }))

  const moveToColumn = (id: string) => {
    const col = columns?.find((c) => c.id === id)
    if (col) setDraft((d) => ({ ...d, slotId: col.id, startMin: col.startMin, endMin: col.endMin }))
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <h3 id={titleId} className="text-base font-semibold text-slate-900 dark:text-slate-50">
          {isNew ? 'Add class' : 'Edit class'}
          <span className="ml-2 text-sm font-normal text-slate-500">{DAY_LABELS[slot.day]}</span>
        </h3>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field
            label="Course code · section"
            className="col-span-2"
            hint="e.g. CSE 443.2 — section after the dot"
            error={codeError ?? undefined}
          >
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                autoFocus
                value={codeInput}
                invalid={Boolean(codeError)}
                onChange={(e) => {
                  setCodeInput(e.target.value)
                  setCodeError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && commit()}
                placeholder="CSE 443.2"
                className="font-mono"
                maxLength={20}
              />
            )}
          </Field>
          {columns && (
            <Field label="Time slot" className="col-span-2">
              {(id) => (
                <select
                  id={id}
                  value={draft.slotId}
                  onChange={(e) => moveToColumn(e.target.value)}
                  className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.evening ? '🌙 ' : ''}
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label="Room">
            {(id) => (
              <Input
                id={id}
                value={draft.room}
                onChange={(e) => setDraft({ ...draft, room: e.target.value })}
                placeholder="N204"
                maxLength={20}
              />
            )}
          </Field>
          <Field label="Type">
            {() => (
              <Segmented
                label="Session type"
                value={draft.type}
                onChange={setType}
                options={[
                  { value: 'theory', label: 'Theory', tone: 'theory' },
                  { value: 'lab', label: 'Lab', tone: 'lab' },
                ]}
              />
            )}
          </Field>
          {evening ? (
            <Field
              label="Frequency"
              className="col-span-2"
              hint={`Default for ${draft.type}: ${FREQUENCY_LABELS[defaultFrequency(draft.type)]}`}
            >
              {() => (
                <Segmented<ClassFrequency>
                  label="Frequency"
                  value={draft.frequency ?? defaultFrequency(draft.type)}
                  onChange={(frequency) => setDraft({ ...draft, frequency })}
                  options={[
                    { value: 'weekly', label: 'Every week' },
                    { value: 'alternate', label: 'Alternating week' },
                  ]}
                />
              )}
            </Field>
          ) : (
            <>
              <Field label="Starts">
                {(id) => (
                  <Input
                    id={id}
                    type="time"
                    value={toInputTime(draft.startMin)}
                    onChange={(e) => setDraft({ ...draft, startMin: fromInputTime(e.target.value) })}
                  />
                )}
              </Field>
              <Field label="Ends">
                {(id) => (
                  <Input
                    id={id}
                    type="time"
                    value={toInputTime(draft.endMin)}
                    onChange={(e) => setDraft({ ...draft, endMin: fromInputTime(e.target.value) })}
                  />
                )}
              </Field>
            </>
          )}
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
