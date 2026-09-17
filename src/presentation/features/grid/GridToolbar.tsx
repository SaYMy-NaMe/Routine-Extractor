import { useId, useState } from 'react'
import { type RoutineGrid, type TimeRange, fromInputTime } from '../../../domain'
import { manualEditCount } from '../../../application'
import { Button, Input, ToggleChip } from '../../components/ui'
import { SCALE_MAX, SCALE_MIN, SCALE_STEP } from './viewSettings'

interface Props {
  grid: RoutineGrid
  scale: number
  onScale: (scale: number) => void
  onAddTimeSlot: (range: TimeRange) => void
  onReset: () => void
}

/** Grid controls: layout scale, adding a time column, and resetting manual edits. */
export function GridToolbar({ grid, scale, onScale, onAddTimeSlot, onReset }: Props) {
  const [adding, setAdding] = useState(false)
  const [newCol, setNewCol] = useState({ start: '08:30', end: '10:00' })
  const scaleId = useId()
  const edited = manualEditCount(grid)
  const rangeValid = fromInputTime(newCol.end) > fromInputTime(newCol.start)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={scaleId}
          className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
        >
          Scale
          <input
            id={scaleId}
            type="range"
            min={SCALE_MIN}
            max={SCALE_MAX}
            step={SCALE_STEP}
            value={scale}
            onChange={(e) => onScale(Number(e.target.value))}
            className="accent-theory-500 w-28"
          />
          <span className="w-9 tabular-nums">{Math.round(scale * 100)}%</span>
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <ToggleChip active={adding} onClick={() => setAdding((v) => !v)} title="Add a time column">
            + Time slot
          </ToggleChip>
          <Button
            size="sm"
            variant="ghost"
            onClick={onReset}
            title="Discard manual edits and rebuild from the master routine"
          >
            ↺ Reset{edited ? ` (${edited})` : ''}
          </Button>
        </div>
      </div>

      {adding && (
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
            disabled={!rangeValid}
            onClick={() => {
              onAddTimeSlot({ startMin: fromInputTime(newCol.start), endMin: fromInputTime(newCol.end) })
              setAdding(false)
            }}
          >
            Add column
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
