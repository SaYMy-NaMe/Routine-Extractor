import { useEffect, useId, useRef, useState } from 'react'
import {
  type ClassFrequency,
  DAY_LABELS,
  FREQUENCY_LABELS,
  type ScheduleSlot,
  type SessionType,
  defaultFrequency,
  fullCourseCode,
  parseCourseCode,
} from '../../../domain'
import { Button, Field, Input, Segmented } from '../../components/ui'

interface Props {
  /** Bounding box of the cell the popover belongs to (viewport coordinates). */
  anchor: DOMRect | null
  slot: ScheduleSlot
  isNew: boolean
  /** Whether this day's evening cell is currently marked off. */
  isOff: boolean
  onSave: (slot: ScheduleSlot) => void
  onClear: (id: string) => void
  onMarkOff: (off: boolean) => void
  onClose: () => void
}

const WIDTH = 288
const HEIGHT = 420

/**
 * Anchored popover for the 6:30 PM – 9:30 PM column. Evening classes follow
 * their own rules: theory meets every week, labs alternate weeks — the
 * frequency follows the type until the user overrides it explicitly.
 */
export function EveningSlotPopover({
  anchor,
  slot,
  isNew,
  isOff,
  onSave,
  onClear,
  onMarkOff,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const [codeInput, setCodeInput] = useState(fullCourseCode(slot))
  const [codeError, setCodeError] = useState<string | null>(null)
  const [room, setRoom] = useState(slot.room)
  const [type, setType] = useState<SessionType>(slot.type)
  const [frequency, setFrequency] = useState<ClassFrequency>(slot.frequency ?? defaultFrequency(slot.type))
  const [frequencyTouched, setFrequencyTouched] = useState(Boolean(slot.frequency) && !isNew)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  const pickType = (t: SessionType) => {
    setType(t)
    if (!frequencyTouched) setFrequency(defaultFrequency(t))
  }

  const commit = () => {
    const parsed = parseCourseCode(codeInput)
    if (!parsed) {
      setCodeError('Use the form DEPT 123 (e.g. CSE 411)')
      return
    }
    onSave({
      ...slot,
      courseCode: parsed.courseCode,
      section: parsed.section,
      room: room.trim().slice(0, 20),
      type,
      frequency,
      source: 'manual',
    })
  }

  // Fixed positioning escapes the grid's scroll container; keep it inside the viewport.
  const style = anchor
    ? {
        top: Math.max(8, Math.min(anchor.bottom + 4, window.innerHeight - HEIGHT)),
        left: Math.max(8, Math.min(anchor.right - WIDTH, window.innerWidth - WIDTH - 8)),
      }
    : { top: 80, left: 8 }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={labelId}
      onMouseDown={(e) => e.stopPropagation()}
      style={style}
      className="fixed z-40 w-72 max-w-[calc(100vw-16px)] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-2 flex items-center justify-between">
        <p id={labelId} className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          🌙 {DAY_LABELS[slot.day]} · 6:30 PM – 9:30 PM
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1 text-slate-400 hover:text-slate-700"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {isOff ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">This evening slot is marked as an off-day.</p>
          <Button size="sm" variant="primary" onClick={() => onMarkOff(false)}>
            Unmark off-day
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <Field label="Course code" error={codeError ?? undefined}>
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
                placeholder="CSE 411"
                className="font-mono"
                maxLength={20}
              />
            )}
          </Field>
          <Field label="Room">
            {(id) => (
              <Input
                id={id}
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="N202"
                maxLength={20}
              />
            )}
          </Field>
          <Field label="Course type">
            {() => (
              <Segmented
                label="Course type"
                value={type}
                onChange={pickType}
                options={[
                  { value: 'theory', label: 'Theory', tone: 'theory' },
                  { value: 'lab', label: 'Lab', tone: 'lab' },
                ]}
              />
            )}
          </Field>
          <Field label="Frequency" hint={`Default for ${type}: ${FREQUENCY_LABELS[defaultFrequency(type)]}`}>
            {() => (
              <Segmented<ClassFrequency>
                label="Frequency"
                value={frequency}
                onChange={(f) => {
                  setFrequency(f)
                  setFrequencyTouched(true)
                }}
                options={[
                  { value: 'weekly', label: 'Every week' },
                  { value: 'alternate', label: 'Alternating week' },
                ]}
              />
            )}
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex gap-1">
              {!isNew && (
                <Button size="sm" variant="danger" onClick={() => onClear(slot.id)}>
                  Clear
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onMarkOff(true)}
                title="Mark this evening slot as off"
              >
                Off-day
              </Button>
            </div>
            <Button size="sm" variant="primary" onClick={commit} disabled={!codeInput.trim()}>
              {isNew ? 'Add' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
