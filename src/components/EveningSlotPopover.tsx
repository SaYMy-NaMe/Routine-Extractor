import { useEffect, useRef, useState } from 'react'
import type { ClassFrequency, ScheduleSlot, SessionType } from '../types/routine'
import { DAY_LABELS, FREQUENCY_LABELS, defaultFrequency } from '../types/routine'
import { Button, Field, Input } from './ui'

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
  const [codeInput, setCodeInput] = useState(
    slot.section ? `${slot.courseCode}.${slot.section}` : slot.courseCode,
  )
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
    const m = /^([A-Za-z]{2,5})\s*-?\s*(\d{3}[A-Za-z]?)(?:\.(\d{1,2}))?/.exec(codeInput.trim())
    const courseCode = m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : codeInput.trim().toUpperCase()
    if (!courseCode) return
    onSave({
      ...slot,
      courseCode,
      section: m?.[3] ?? '',
      room: room.trim(),
      type,
      frequency,
      source: 'manual',
    })
  }

  const segment = (active: boolean, tone: 'theory' | 'lab' | 'neutral') =>
    `flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
      active
        ? tone === 'lab'
          ? 'bg-lab-500 text-white'
          : tone === 'theory'
            ? 'bg-theory-500 text-white'
            : 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
    }`

  // Fixed positioning escapes the grid's scroll container; keep it inside the viewport.
  const WIDTH = 288
  const style = anchor
    ? {
        top: Math.min(anchor.bottom + 4, window.innerHeight - 420),
        left: Math.max(8, Math.min(anchor.right - WIDTH, window.innerWidth - WIDTH - 8)),
      }
    : { top: 80, left: 8 }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Evening class on ${DAY_LABELS[slot.day]}`}
      onMouseDown={(e) => e.stopPropagation()}
      style={style}
      className="fixed z-40 w-72 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          🌙 {DAY_LABELS[slot.day]} · 6:30 PM – 9:30 PM
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700"
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
          <Field label="Course code">
            <Input
              autoFocus
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
              placeholder="CSE 411"
              className="font-mono"
            />
          </Field>
          <Field label="Room">
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="N202" />
          </Field>
          <Field label="Course type">
            <div className="flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
              <button
                type="button"
                onClick={() => pickType('theory')}
                className={segment(type === 'theory', 'theory')}
              >
                Theory
              </button>
              <button
                type="button"
                onClick={() => pickType('lab')}
                className={segment(type === 'lab', 'lab')}
              >
                Lab
              </button>
            </div>
          </Field>
          <Field label="Frequency" hint={`Default for ${type}: ${FREQUENCY_LABELS[defaultFrequency(type)]}`}>
            <div className="flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
              {(['weekly', 'alternate'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setFrequency(f)
                    setFrequencyTouched(true)
                  }}
                  className={segment(frequency === f, 'neutral')}
                >
                  {f === 'weekly' ? 'Every week' : 'Alternating week'}
                </button>
              ))}
            </div>
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
