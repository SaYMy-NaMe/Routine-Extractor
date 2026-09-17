import { useRef } from 'react'
import {
  DAY_LABELS,
  type DayName,
  type EmptyDaySettings,
  type OffDayStatus,
  type RoutineGrid,
  type ScheduleSlot,
  type TimeSlot,
} from '../../../domain'
import { emptyDayView, isEveningOff, slotsAt, visibleDays } from '../../../application'
import { cx } from '../../components/ui'
import { EmptyDayBadge } from './EmptyDayBadge'
import { SessionChip } from './SessionChip'

export interface CellOpen {
  slot: ScheduleSlot
  isNew: boolean
  anchor?: DOMRect
}

interface Props {
  grid: RoutineGrid
  columns: readonly TimeSlot[]
  scale: number
  emptyDay: EmptyDaySettings
  onOpenDay: (open: CellOpen) => void
  onOpenEvening: (open: CellOpen) => void
  onSetOffDay: (day: DayName, status: OffDayStatus) => void
  onRemoveTimeSlot: (id: string) => void
  newManualSlot: (day: DayName, column: TimeSlot) => ScheduleSlot
}

const NEXT_OFF: Record<OffDayStatus, OffDayStatus> = {
  none: 'no-class',
  'no-class': 'weekend',
  weekend: 'none',
}

/** Day × TimeSlot matrix for tablet/laptop/desktop. Every cell holds at most one class. */
export function GridTable(p: Props) {
  const { grid, columns, emptyDay } = p
  const days = visibleDays(grid, emptyDay)
  const dayColumnCount = columns.filter((c) => !c.evening).length
  const usedColumnIds = new Set(grid.slots.map((s) => s.slotId))

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      {/* `zoom` scales layout (not just transform), so the scroll area stays correct. */}
      <table className="w-full min-w-[640px] border-collapse text-sm" style={{ zoom: p.scale }}>
        <thead>
          <tr className="bg-slate-100 text-xs tracking-wide text-slate-600 uppercase dark:bg-slate-800 dark:text-slate-300">
            <th
              scope="col"
              className="w-24 border-r border-b border-slate-200 px-3 py-2 text-left dark:border-slate-700"
            >
              Day / Time
            </th>
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                className={cx(
                  'group relative border-b border-l border-slate-200 px-2 py-2 text-center font-semibold dark:border-slate-700',
                  c.evening && 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200',
                )}
              >
                <div>
                  {c.evening ? '🌙 ' : ''}
                  {c.label}
                </div>
                {c.altLabel && (
                  <div className="text-[10px] font-normal normal-case opacity-70">{c.altLabel}</div>
                )}
                {c.evening && (
                  <div className="text-[10px] font-normal normal-case opacity-70">
                    Evening · weekly / alt. week
                  </div>
                )}
                {c.pinned && !usedColumnIds.has(c.id) && (
                  <button
                    type="button"
                    onClick={() => p.onRemoveTimeSlot(c.id)}
                    title="Remove this empty column"
                    aria-label={`Remove column ${c.label}`}
                    className="absolute top-1 right-1 hidden h-5 w-5 items-center justify-center rounded text-slate-400 group-hover:flex hover:bg-red-100 hover:text-red-600"
                  >
                    ×
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const off = grid.offDays[day]
            const empty = !grid.slots.some((s) => s.day === day)
            const badge = emptyDayView(grid, day, emptyDay)
            return (
              <tr key={day} className="border-t border-slate-200 dark:border-slate-700">
                <th
                  scope="row"
                  className="border-r border-slate-200 bg-slate-50 px-3 py-2 text-left align-middle text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
                >
                  {DAY_LABELS[day]}
                  {empty && (
                    <button
                      type="button"
                      onClick={() => p.onSetOffDay(day, NEXT_OFF[off])}
                      className="hover:text-theory-500 mt-1 block text-[10px] font-normal text-slate-400"
                      title="Cycle: no class → weekend → show cells"
                    >
                      {off === 'none' ? 'mark off-day' : 'change badge'}
                    </button>
                  )}
                </th>
                {badge && (
                  <td
                    colSpan={badge.spansEvening ? columns.length : dayColumnCount}
                    className="px-3 py-4 text-center"
                  >
                    <EmptyDayBadge
                      style={emptyDay.badges[badge.kind]}
                      onClick={() => p.onSetOffDay(day, NEXT_OFF[off])}
                      title="Click to change the badge"
                    />
                  </td>
                )}
                {columns.map((col) =>
                  col.evening ? (
                    badge?.spansEvening ? null : (
                      <EveningCell
                        key={col.id}
                        day={day}
                        column={col}
                        grid={grid}
                        onOpen={p.onOpenEvening}
                        newManualSlot={p.newManualSlot}
                      />
                    )
                  ) : badge ? null : (
                    <DayCell
                      key={col.id}
                      day={day}
                      column={col}
                      occupant={slotsAt(grid, day, col.id)[0]}
                      onOpen={p.onOpenDay}
                      newManualSlot={p.newManualSlot}
                    />
                  ),
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

interface DayCellProps {
  day: DayName
  column: TimeSlot
  occupant: ScheduleSlot | undefined
  onOpen: (open: CellOpen) => void
  newManualSlot: Props['newManualSlot']
}

function DayCell({ day, column, occupant, onOpen, newManualSlot }: DayCellProps) {
  return (
    <td className="group border-l border-slate-200 p-1.5 align-top dark:border-slate-700">
      <div className="flex min-h-14 flex-col">
        {occupant ? (
          <SessionChip
            slot={occupant}
            column={column}
            onClick={() => onOpen({ slot: occupant, isNew: false })}
          />
        ) : (
          <button
            type="button"
            onClick={() => onOpen({ slot: newManualSlot(day, column), isNew: true })}
            className="hover:border-theory-500 hover:text-theory-500 flex-1 rounded-md border border-dashed border-transparent py-1 text-[11px] text-slate-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Add class on ${DAY_LABELS[day]} at ${column.label}`}
          >
            + add
          </button>
        )}
      </div>
    </td>
  )
}

interface EveningCellProps {
  day: DayName
  column: TimeSlot
  grid: RoutineGrid
  onOpen: (open: CellOpen) => void
  newManualSlot: Props['newManualSlot']
}

/** The 6:30–9:30 PM cell: rendered even on off-days and edited through the anchored popover. */
function EveningCell({ day, column, grid, onOpen, newManualSlot }: EveningCellProps) {
  const ref = useRef<HTMLTableCellElement>(null)
  const rect = () => ref.current?.getBoundingClientRect()
  const off = isEveningOff(grid, day, column)
  const occupant = slotsAt(grid, day, column.id)[0]
  return (
    <td
      ref={ref}
      className="group border-l border-slate-200 bg-indigo-50/40 p-1.5 align-top dark:border-slate-700 dark:bg-indigo-950/20"
    >
      <div className="flex min-h-14 flex-col">
        {off ? (
          <button
            type="button"
            onClick={() => onOpen({ slot: newManualSlot(day, column), isNew: true, anchor: rect() })}
            title="Evening slot marked off · click to change"
            className="flex-1 rounded-md border border-dashed border-slate-300 text-[11px] font-bold tracking-widest text-slate-400 dark:border-slate-600"
          >
            OFF
          </button>
        ) : occupant ? (
          <SessionChip
            slot={occupant}
            column={column}
            onClick={() => onOpen({ slot: occupant, isNew: false, anchor: rect() })}
          />
        ) : (
          <button
            type="button"
            onClick={() => onOpen({ slot: newManualSlot(day, column), isNew: true, anchor: rect() })}
            aria-label={`Add evening class on ${DAY_LABELS[day]}`}
            className="flex-1 rounded-md border border-dashed border-transparent py-1 text-[11px] text-indigo-400 opacity-60 group-hover:opacity-100 hover:border-indigo-500 hover:text-indigo-600 focus-visible:opacity-100"
          >
            + evening class
          </button>
        )}
      </div>
    </td>
  )
}
