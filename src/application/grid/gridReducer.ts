/**
 * Pure state transitions for the routine grid. Keeping every edit as a
 * reducer action makes the editing rules unit-testable and lets the UI store
 * stay a thin `useReducer` wrapper (Command pattern over grid edits).
 */

import {
  DAYS,
  type DayName,
  type OffDayStatus,
  type RoutineGrid,
  type ScheduleSlot,
  type TimeRange,
  defaultFrequency,
  makeTimeSlot,
  occupantOf,
  timeSlotId,
} from '../../domain'
import { DEFAULT_WEEKEND, computeOffDays } from './gridBuilder'

export type GridAction =
  | { type: 'grid/replace'; grid: RoutineGrid }
  | { type: 'grid/upsertSlot'; slot: ScheduleSlot }
  | { type: 'grid/removeSlot'; id: string }
  | { type: 'grid/setOffDay'; day: DayName; status: OffDayStatus }
  | { type: 'grid/setEveningOff'; day: DayName; off: boolean }
  | { type: 'grid/addTimeSlot'; range: TimeRange }
  | { type: 'grid/removeTimeSlot'; id: string }

export interface GridReducerOptions {
  readonly weekendDays?: readonly DayName[]
}

/** Keep a user's explicit off-day choice on days that are still empty. */
function mergeOffDays(
  prev: Readonly<Record<DayName, OffDayStatus>>,
  next: Record<DayName, OffDayStatus>,
): Record<DayName, OffDayStatus> {
  const out = { ...next }
  for (const d of DAYS) if (next[d] !== 'none' && prev[d] !== 'none') out[d] = prev[d]
  return out
}

function withSlots(
  grid: RoutineGrid,
  slots: readonly ScheduleSlot[],
  weekendDays: readonly DayName[],
): RoutineGrid {
  return { ...grid, slots, offDays: mergeOffDays(grid.offDays, computeOffDays(slots, weekendDays)) }
}

export function gridReducer(
  grid: RoutineGrid,
  action: GridAction,
  options: GridReducerOptions = {},
): RoutineGrid {
  const weekendDays = options.weekendDays ?? DEFAULT_WEEKEND
  switch (action.type) {
    case 'grid/replace':
      return action.grid

    case 'grid/upsertSlot': {
      const column = grid.timeSlots.find((t) => t.id === action.slot.slotId)
      if (!column) return grid
      const slot: ScheduleSlot = column.evening
        ? { ...action.slot, frequency: action.slot.frequency ?? defaultFrequency(action.slot.type) }
        : action.slot
      // One class per cell: refuse to stack a second session onto an occupied cell.
      if (occupantOf(grid.slots, slot.day, slot.slotId, slot.id)) return grid
      const exists = grid.slots.some((s) => s.id === slot.id)
      const slots = exists ? grid.slots.map((s) => (s.id === slot.id ? slot : s)) : [...grid.slots, slot]
      // A class in the evening cell clears any "off" marker on it.
      const eveningOff = column.evening ? grid.eveningOff.filter((d) => d !== slot.day) : grid.eveningOff
      return { ...withSlots(grid, slots, weekendDays), eveningOff }
    }

    case 'grid/removeSlot':
      return withSlots(
        grid,
        grid.slots.filter((s) => s.id !== action.id),
        weekendDays,
      )

    case 'grid/setOffDay':
      return { ...grid, offDays: { ...grid.offDays, [action.day]: action.status } }

    case 'grid/setEveningOff': {
      const evening = grid.timeSlots.find((t) => t.evening)
      const slots =
        action.off && evening
          ? grid.slots.filter((s) => !(s.day === action.day && s.slotId === evening.id))
          : grid.slots
      const eveningOff = action.off
        ? [...new Set([...grid.eveningOff, action.day])]
        : grid.eveningOff.filter((d) => d !== action.day)
      return { ...withSlots(grid, slots, weekendDays), eveningOff }
    }

    case 'grid/addTimeSlot': {
      if (action.range.endMin <= action.range.startMin) return grid
      const id = timeSlotId(action.range)
      if (grid.timeSlots.some((t) => t.id === id)) return grid
      // Hand-added columns are pinned so they stay visible until the user removes them.
      const added = { ...makeTimeSlot(action.range), pinned: true }
      const timeSlots = [...grid.timeSlots, added].sort((a, b) => a.startMin - b.startMin)
      return { ...grid, timeSlots }
    }

    case 'grid/removeTimeSlot': {
      const target = grid.timeSlots.find((t) => t.id === action.id)
      if (!target || target.evening) return grid // the evening column is pinned
      return withSlots(
        { ...grid, timeSlots: grid.timeSlots.filter((t) => t.id !== action.id) },
        grid.slots.filter((s) => s.slotId !== action.id),
        weekendDays,
      )
    }

    default:
      return grid
  }
}
