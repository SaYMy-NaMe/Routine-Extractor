import {
  DAY_LABELS,
  type DayName,
  type EmptyDaySettings,
  type OffDayStatus,
  type RoutineGrid,
  type ScheduleSlot,
  type TimeSlot,
  formatRange,
} from '../../../domain'
import {
  breakWaived,
  emptyDayView,
  freeColumns,
  isEveningOff,
  slotsAt,
  visibleDays,
} from '../../../application'
import { Button } from '../../components/ui'
import { EmptyDayBadge } from './EmptyDayBadge'
import type { CellOpen } from './GridTable'
import { SessionChip } from './SessionChip'

interface Props {
  grid: RoutineGrid
  columns: readonly TimeSlot[]
  scale: number
  emptyDay: EmptyDaySettings
  onOpen: (open: CellOpen) => void
  onSetOffDay: (day: DayName, status: OffDayStatus) => void
  onSetEveningOff: (day: DayName, off: boolean) => void
  newManualSlot: (day: DayName, column: TimeSlot) => ScheduleSlot
}

const NEXT_OFF: Record<OffDayStatus, OffDayStatus> = {
  none: 'no-class',
  'no-class': 'weekend',
  weekend: 'none',
}

/** Adaptive card view: one card per day, sessions listed chronologically. Used on phones. */
export function GridCards({
  grid,
  columns,
  scale,
  emptyDay,
  onOpen,
  onSetOffDay,
  onSetEveningOff,
  newManualSlot,
}: Props) {
  const evening = columns.find((c) => c.evening)

  return (
    <div className="grid gap-3 sm:grid-cols-2" style={{ fontSize: `${scale}em` }}>
      {visibleDays(grid, emptyDay).map((day) => {
        const off = grid.offDays[day]
        const badge = emptyDayView(grid, day, emptyDay)
        const rows = columns
          .filter((c) => !c.evening && !c.isBreak)
          .flatMap((c) => slotsAt(grid, day, c.id).map((s) => ({ column: c, slot: s })))
          .sort((a, b) => a.slot.startMin - b.slot.startMin)
        const eveningSession = evening ? slotsAt(grid, day, evening.id)[0] : undefined
        const eveningOff = evening ? isEveningOff(grid, day, evening) : false
        const free = freeColumns(grid, day).filter((c) => !c.evening)

        return (
          <section
            key={day}
            aria-label={DAY_LABELS[day]}
            className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          >
            <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{DAY_LABELS[day]}</h3>
              {badge ? (
                <EmptyDayBadge
                  style={emptyDay.badges[badge.kind]}
                  collapsed
                  onClick={() => onSetOffDay(day, NEXT_OFF[off])}
                  title="Change badge"
                />
              ) : (
                <span className="text-xs text-slate-500">
                  {rows.length + (eveningSession ? 1 : 0)} class
                  {rows.length + (eveningSession ? 1 : 0) === 1 ? '' : 'es'}
                </span>
              )}
            </header>

            <div className="flex flex-col gap-2 p-3">
              {rows.map(({ column, slot }) => (
                <div key={slot.id} className="flex items-start gap-2">
                  <span className="w-[4.5rem] shrink-0 pt-1.5 text-[11px] leading-tight text-slate-500 tabular-nums">
                    {formatRange(slot)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <SessionChip slot={slot} column={column} onClick={() => onOpen({ slot, isNew: false })} />
                  </div>
                </div>
              ))}

              {!badge && (
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-[4.5rem] shrink-0 text-slate-500 tabular-nums">1:00–1:30 PM</span>
                  {breakWaived(grid, day) ? (
                    <span className="text-slate-400 uppercase">No break — lab runs through</span>
                  ) : (
                    <span className="rounded bg-amber-50 px-2 py-0.5 font-bold tracking-widest text-amber-800 uppercase dark:bg-amber-950/40 dark:text-amber-200">
                      Break
                    </span>
                  )}
                </div>
              )}

              {evening && !badge?.spansEvening && (
                <div className="flex items-start gap-2 rounded-lg bg-indigo-50/60 p-2 dark:bg-indigo-950/30">
                  <span className="w-[4.5rem] shrink-0 pt-1.5 text-[11px] leading-tight text-indigo-700 tabular-nums dark:text-indigo-300">
                    🌙 6:30–9:30 PM
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {eveningOff ? (
                      <button
                        type="button"
                        onClick={() => onSetEveningOff(day, false)}
                        className="rounded-md border border-dashed border-slate-300 py-1 text-[11px] font-bold tracking-widest text-slate-400"
                      >
                        OFF · tap to unmark
                      </button>
                    ) : eveningSession ? (
                      <SessionChip
                        slot={eveningSession}
                        column={evening}
                        onClick={() => onOpen({ slot: eveningSession, isNew: false })}
                      />
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-indigo-600 dark:text-indigo-300"
                          onClick={() => onOpen({ slot: newManualSlot(day, evening), isNew: true })}
                        >
                          + evening class
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onSetEveningOff(day, true)}>
                          Mark off
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {free.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="self-start"
                  onClick={() => onOpen({ slot: newManualSlot(day, free[0]), isNew: true })}
                >
                  + Add class
                </Button>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
