import { useMemo, useRef, useState } from 'react'
import type { DayName, OffDayStatus, RoutineGrid as Grid, ScheduleSlot, TimeSlot } from '../types/routine'
import { DAY_LABELS, FREQUENCY_LABELS, fullCourseCode } from '../types/routine'
import { slotsAt, visibleTimeSlots } from '../services/routineBuilder'
import { formatRange, fromInputTime } from '../services/timeUtils'
import { EveningSlotPopover } from './EveningSlotPopover'
import { SlotEditor } from './SlotEditor'
import { Button, Input } from './ui'

interface Props {
  grid: Grid
  showEmptyColumns: boolean
  onToggleEmptyColumns: (v: boolean) => void
  onUpsertSlot: (slot: ScheduleSlot) => void
  onRemoveSlot: (id: string) => void
  onSetOffDay: (day: DayName, status: OffDayStatus) => void
  onSetEveningOff: (day: DayName, off: boolean) => void
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

type Editing = { slot: ScheduleSlot; isNew: boolean; anchor?: DOMRect } | null

/** Editable Day × TimeSlot matrix with colour-coded theory/lab chips and a pinned evening column. */
export function RoutineGrid(props: Props) {
  const { grid, showEmptyColumns } = props
  const [editing, setEditing] = useState<Editing>(null)
  const [evening, setEvening] = useState<Editing>(null)
  const [addingColumn, setAddingColumn] = useState(false)
  const [newCol, setNewCol] = useState({ start: '08:30', end: '10:00' })

  const columns = useMemo(() => visibleTimeSlots(grid, showEmptyColumns), [grid, showEmptyColumns])
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
          title="Discard manual edits and re-extract from the file"
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
                  className={`group relative border-b border-l border-slate-200 px-2 py-2 text-center font-semibold dark:border-slate-700 ${
                    c.evening ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200' : ''
                  }`}
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
                  {!usedIds.has(c.id) && !c.evening && (
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
                  {showBadge && (
                    <td colSpan={columns.filter((c) => !c.evening).length} className="px-3 py-4 text-center">
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
                  )}
                  {columns.map((col) => {
                    if (col.evening) {
                      return (
                        <EveningCell
                          key={col.id}
                          day={day}
                          column={col}
                          slots={slotsAt(grid, day, col.id)}
                          isOff={grid.eveningOff.includes(day)}
                          editing={evening && evening.slot.day === day ? evening : null}
                          onOpen={(slot, isNew, anchor) => setEvening({ slot, isNew, anchor })}
                          onClose={() => setEvening(null)}
                          newManualSlot={props.newManualSlot}
                          onUpsertSlot={props.onUpsertSlot}
                          onRemoveSlot={props.onRemoveSlot}
                          onSetEveningOff={props.onSetEveningOff}
                        />
                      )
                    }
                    if (showBadge) return null
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
                  })}
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

/* ------------------------------------------------------------------------- */
/* Evening column cell                                                        */
/* ------------------------------------------------------------------------- */

interface EveningCellProps {
  day: DayName
  column: TimeSlot
  slots: ScheduleSlot[]
  isOff: boolean
  editing: Exclude<Editing, null> | null
  onOpen: (slot: ScheduleSlot, isNew: boolean, anchor: DOMRect) => void
  onClose: () => void
  newManualSlot: Props['newManualSlot']
  onUpsertSlot: Props['onUpsertSlot']
  onRemoveSlot: Props['onRemoveSlot']
  onSetEveningOff: Props['onSetEveningOff']
}

/**
 * The 6:30–9:30 PM cell. Unlike day cells it is rendered even on off-days,
 * and it is edited through an anchored popover with the evening-specific
 * frequency rules rather than the modal editor.
 */
function EveningCell(p: EveningCellProps) {
  const ref = useRef<HTMLTableCellElement>(null)
  const rect = () => ref.current!.getBoundingClientRect()
  const openNew = () => p.onOpen(p.newManualSlot(p.day, p.column), true, rect())
  return (
    <td
      ref={ref}
      className="group relative border-l border-slate-200 bg-indigo-50/40 p-1.5 align-top dark:border-slate-700 dark:bg-indigo-950/20"
    >
      <div className="flex min-h-14 flex-col gap-1">
        {p.isOff ? (
          <button
            type="button"
            onClick={openNew}
            title="Evening slot marked off · click to change"
            className="flex-1 rounded-md border border-dashed border-slate-300 text-[11px] font-bold tracking-widest text-slate-400 dark:border-slate-600"
          >
            OFF
          </button>
        ) : (
          <>
            {p.slots.map((s) => (
              <SessionChip key={s.id} slot={s} column={p.column} onClick={() => p.onOpen(s, false, rect())} />
            ))}
            <button
              type="button"
              onClick={openNew}
              aria-label={`Add evening class on ${DAY_LABELS[p.day]}`}
              className={`rounded-md border border-dashed border-transparent py-1 text-[11px] text-indigo-400 hover:border-indigo-500 hover:text-indigo-600 ${
                p.slots.length
                  ? 'opacity-0 group-hover:opacity-100'
                  : 'flex-1 opacity-60 group-hover:opacity-100'
              }`}
            >
              + evening class
            </button>
          </>
        )}
      </div>
      {p.editing && (
        <EveningSlotPopover
          anchor={p.editing.anchor ?? null}
          slot={p.editing.slot}
          isNew={p.editing.isNew}
          isOff={p.isOff}
          onSave={(s) => {
            p.onUpsertSlot(s)
            p.onClose()
          }}
          onClear={(id) => {
            p.onRemoveSlot(id)
            p.onClose()
          }}
          onMarkOff={(off) => {
            p.onSetEveningOff(p.day, off)
            p.onClose()
          }}
          onClose={p.onClose}
        />
      )}
    </td>
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
        {offGrid && !column.evening && <span>{formatRange(slot.startMin, slot.endMin)}</span>}
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
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm border border-indigo-300 bg-indigo-50 dark:bg-indigo-950/60" />{' '}
        Evening 6:30–9:30 PM
      </span>
    </div>
  )
}
