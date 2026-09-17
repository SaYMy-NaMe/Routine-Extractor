import { memo } from 'react'
import {
  FREQUENCY_LABELS,
  type ScheduleSlot,
  type TimeSlot,
  formatRange,
  fullCourseCode,
} from '../../../domain'
import { cx } from '../../components/ui'

interface Props {
  slot: ScheduleSlot
  column: TimeSlot
  onClick: () => void
}

/** Colour-coded session pill used by both the table and the card views. */
export const SessionChip = memo(function SessionChip({ slot, column, onClick }: Props) {
  const lab = slot.type === 'lab'
  const offGrid = !column.evening && (slot.startMin !== column.startMin || slot.endMin !== column.endMin)
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${fullCourseCode(slot)} · ${formatRange(slot)} · click to edit`}
      className={cx(
        'focus-visible:ring-theory-500/50 w-full rounded-md border px-2 py-1.5 text-left transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:outline-none',
        lab
          ? 'border-lab-500/40 bg-lab-100 text-lab-900 dark:bg-lab-900/50 dark:text-lab-100'
          : 'border-theory-500/40 bg-theory-100 text-theory-900 dark:bg-theory-900/50 dark:text-theory-100',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-xs font-bold">{fullCourseCode(slot)}</span>
        <span className="flex items-center gap-1">
          {lab && <span className="bg-lab-500 rounded px-1 text-[9px] font-bold text-white">LAB</span>}
          {column.evening && slot.frequency && (
            <span className="rounded bg-indigo-500 px-1 text-[9px] font-bold text-white">
              {FREQUENCY_LABELS[slot.frequency]}
            </span>
          )}
          {slot.source === 'manual' && <span className="text-[9px] opacity-70">edited</span>}
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-between text-[11px] opacity-80">
        <span>{slot.room ? `Room ${slot.room}` : 'Room —'}</span>
        {offGrid && <span>{formatRange(slot)}</span>}
      </div>
    </button>
  )
})
