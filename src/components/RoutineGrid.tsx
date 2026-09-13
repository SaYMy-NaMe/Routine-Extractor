import { useMemo, useState } from 'react'
import type { DayName, OffDayStatus, RoutineGrid as Grid, ScheduleSlot, TimeSlot } from '../types/routine'
import { DAY_LABELS, fullCourseCode } from '../types/routine'
import { slotsAt, usedTimeSlots } from '../services/routineBuilder'
import { formatRange, fromInputTime } from '../services/timeUtils'
import { SlotEditor } from './SlotEditor'
import { Button, Input } from './ui'

interface Props {
  grid: Grid
  showEmptyColumns: boolean
  onToggleEmptyColumns: (v: boolean) => void
  onUpsertSlot: (slot: ScheduleSlot) => void
  onRemoveSlot: (id: string) => void
  onSetOffDay: (day: DayName, status: OffDayStatus) => void
  onAddTimeSlot: (startMin: number, endMin: number) => void
  onRemoveTimeSlot: (id: string) => void
  onReset: () => void
  newManualSlot: (day: DayName, column: TimeSlot) => ScheduleSlot
}

const OFF_DAY_LABEL: Record<OffDayStatus, string> = {
  none: '',
  'no-class': 'NO CLASS ON THIS DAY',
  weekend: 'WEEKEND',
}

const nextOffDay: Record<OffDayStatus, OffDayStatus> = {
  none: 'no-class',
  'no-class': 'weekend',
  weekend: 'none',
}

/** Editable Day × TimeSlot matrix with colour-coded theory/lab chips. */
export function RoutineGrid(props: Props) {
  const { grid, showEmptyColumns } = props
  const [editing, setEditing] = useState<{ slot: ScheduleSlot; isNew: boolean } | null>(null)
  const [addingColumn, setAddingColumn] = useState(false)
  const [newCol, setNewCol] = useState({ start: '18:30', end: '21:30' })

  const columns = useMemo(() => {
    const used = usedTimeSlots(grid)
    return showEmptyColumns || used.length === 0 ? grid.timeSlots : used
  }, [grid, showEmptyColumns])

  const usedIds = useMemo(() => new Set(grid.slots.map((s) => s.slotId)), [grid.slots])
  const manualCount = grid.slots.filter((s) => s.source === 'manual').length

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Legend />
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={showEmptyColumns}
            onChange={(e) => props.onToggleEmptyColumns(e.target.checked)}
            className="accent-theory-500"
          />
          Show empty time slots
        </label>
        <Button size="sm" onClick={() => setAddingColumn((v) => !v)}>
          + Time slot
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={props.onReset}
          title="Discard manual edits and re-extract from the PDF"
        >
          ↺ Re-extract{manualCount ? ` (${manualCount} edited)` : ''}
        </Button>
      </div>

      {addingColumn && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/60">
          <label className="flex flex-col gap-1">
            From
            <Input
              type="time"
              value={newCol.start}
              onChange={(e) => setNewCol({ ...newCol, start: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            To
            <Input
              type="time"
              value={newCol.end}
              onChange={(e) => setNewCol({ ...newCol, end: e.target.value })}
            />
          </label>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              const s = fromInputTime(newCol.start)
              const e = fromInputTime(newCol.end)
              if (e > s) {
                props.onAddTimeSlot(s, e)
                props.onToggleEmptyColumns(true)
                setAddingColumn(false)
              }
            }}
          >
            Add column
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAddingColumn(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Matrix */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-xs tracking-wide text-slate-600 uppercase dark:bg-slate-800 dark:text-slate-300">
              <th className="w-24 border-r border-b border-slate-200 px-3 py-2 text-left dark:border-slate-700">
                Day / Time
              </th>
              {columns.map((c) => (
                <th
                  key={c.id}
                  className="group relative border-b border-l border-slate-200 px-2 py-2 text-center font-semibold dark:border-slate-700"
                >
                  <div>{c.label}</div>
                  {c.altLabel && (
                    <div className="text-[10px] font-normal normal-case opacity-70">{c.altLabel}</div>
                  )}
                  {!usedIds.has(c.id) && (
                    <button
                      type="button"
                      onClick={() => props.onRemoveTimeSlot(c.id)}
                      title="Remove empty column"
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
            {grid.days.map((day) => {
              const off = grid.offDays[day]
              const daySlots = grid.slots.filter((s) => s.day === day)
              const showBadge = off !== 'none' && daySlots.length === 0
              return (
                <tr key={day} className="border-t border-slate-200 dark:border-slate-700">
                  <th
                    scope="row"
                    className="border-r border-slate-200 bg-slate-50 px-3 py-2 text-left align-middle text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
                  >
                    {DAY_LABELS[day]}
                    {daySlots.length === 0 && (
                      <button
                        type="button"
                        onClick={() => props.onSetOffDay(day, nextOffDay[off])}
                        className="hover:text-theory-500 mt-1 block text-[10px] font-normal text-slate-400"
                        title="Cycle: empty → no class → weekend"
                      >
                        {off === 'none' ? 'mark off-day' : 'change badge'}
                      </button>
                    )}
                  </th>
                  {showBadge ? (
                    <td colSpan={columns.length} className="px-3 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => props.onSetOffDay(day, nextOffDay[off])}
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold tracking-widest ${
                          off === 'weekend'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {OFF_DAY_LABEL[off]}
                      </button>
                    </td>
                  ) : (
                    columns.map((col) => {
                      const cellSlots = slotsAt(grid, day, col.id)
                      return (
                        <td
                          key={col.id}
                          className="group border-l border-slate-200 p-1.5 align-top dark:border-slate-700"
                        >
                          <div className="flex min-h-14 flex-col gap-1">
                            {cellSlots.map((s) => (
                              <SessionChip
                                key={s.id}
                                slot={s}
                                column={col}
                                onClick={() => setEditing({ slot: s, isNew: false })}
                              />
                            ))}
                            <button
                              type="button"
                              onClick={() => setEditing({ slot: props.newManualSlot(day, col), isNew: true })}
                              className={`hover:border-theory-500 hover:text-theory-500 rounded-md border border-dashed border-transparent py-1 text-[11px] text-slate-400 ${
                                cellSlots.length
                                  ? 'opacity-0 group-hover:opacity-100'
                                  : 'flex-1 opacity-0 group-hover:opacity-100'
                              }`}
                              aria-label={`Add class on ${DAY_LABELS[day]} at ${col.label}`}
                            >
                              + add
                            </button>
                          </div>
                        </td>
                      )
                    })
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <SlotEditor
          slot={editing.slot}
          isNew={editing.isNew}
          onSave={(s) => {
            props.onUpsertSlot(s)
            setEditing(null)
          }}
          onDelete={(id) => {
            props.onRemoveSlot(id)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function SessionChip({
  slot,
  column,
  onClick,
}: {
  slot: ScheduleSlot
  column: TimeSlot
  onClick: () => void
}) {
  const lab = slot.type === 'lab'
  const offGrid = slot.startMin !== column.startMin || slot.endMin !== column.endMin
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${fullCourseCode(slot)} · ${formatRange(slot.startMin, slot.endMin)} · click to edit`}
      className={`w-full rounded-md border px-2 py-1.5 text-left transition-shadow hover:shadow-md ${
        lab
          ? 'border-lab-500/40 bg-lab-100 text-lab-900 dark:border-lab-500/40 dark:bg-lab-900/50 dark:text-lab-100'
          : 'border-theory-500/40 bg-theory-100 text-theory-900 dark:border-theory-500/40 dark:bg-theory-900/50 dark:text-theory-100'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-xs font-bold">{fullCourseCode(slot)}</span>
        {lab && <span className="bg-lab-500 rounded px-1 text-[9px] font-bold text-white">LAB</span>}
        {slot.source === 'manual' && <span className="text-[9px] opacity-70">edited</span>}
      </div>
      <div className="mt-0.5 flex items-center justify-between text-[11px] opacity-80">
        <span>{slot.room ? `Room ${slot.room}` : 'Room —'}</span>
        {offGrid && <span>{formatRange(slot.startMin, slot.endMin)}</span>}
      </div>
    </button>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
      <span className="flex items-center gap-1.5">
        <span className="border-theory-500/40 bg-theory-100 dark:bg-theory-900/60 h-3 w-3 rounded-sm border" />{' '}
        Theory · 3 cr
      </span>
      <span className="flex items-center gap-1.5">
        <span className="border-lab-500/40 bg-lab-100 dark:bg-lab-900/60 h-3 w-3 rounded-sm border" /> Lab ·
        1.5 cr
      </span>
    </div>
  )
}
