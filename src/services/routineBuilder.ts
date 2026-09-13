/**
 * Projects the faculty's parsed cells onto the personal routine grid
 * (Day × TimeSlot). Lab blocks (2 h) are folded into the theory column they
 * overlap most, mirroring how the official personal routine prints
 * "3:00 PM - 4:30 PM / 3:30 PM - 5:30 PM" in a single column.
 */

import type {
  DayName,
  OffDayStatus,
  ParsedCell,
  RoutineGrid,
  ScheduleSlot,
  SessionType,
  TimeSlot,
} from '../types/routine'
import { DAYS, EVENING_SLOT, defaultFrequency } from '../types/routine'
import { formatRange, overlapMinutes } from './timeUtils'

/** Standard theory columns used when the PDF gives us nothing better. */
export const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  ['08:30', '10:00'],
  ['10:00', '11:30'],
  ['11:30', '13:00'],
  ['13:30', '15:00'],
  ['15:00', '16:30'],
  ['16:30', '18:00'],
  ['18:30', '21:30'],
].map(([s, e]) => makeTimeSlot(hm(s), hm(e)))

function hm(v: string): number {
  const [h, m] = v.split(':').map(Number)
  return h * 60 + m
}

export function slotId(startMin: number, endMin: number): string {
  return `${startMin}-${endMin}`
}

export function makeTimeSlot(startMin: number, endMin: number): TimeSlot {
  const slot: TimeSlot = {
    id: slotId(startMin, endMin),
    label: formatRange(startMin, endMin),
    startMin,
    endMin,
  }
  if (isEveningRange(startMin, endMin)) slot.evening = true
  return slot
}

export function isEveningRange(startMin: number, endMin: number): boolean {
  return startMin === EVENING_SLOT.startMin && endMin === EVENING_SLOT.endMin
}

export const EVENING_SLOT_ID = slotId(EVENING_SLOT.startMin, EVENING_SLOT.endMin)

let counter = 0
export function newSlotId(): string {
  counter += 1
  return `s${Date.now().toString(36)}${counter}`
}

/**
 * Decide whether a cell is a lab. The table it came from is authoritative;
 * "LAB" in the raw text is a secondary signal.
 */
export function inferSessionType(cell: ParsedCell): SessionType {
  if (cell.tableKind === 'lab') return 'lab'
  if (/\blab\b/i.test(cell.rawText)) return 'lab'
  return 'theory'
}

/**
 * Pick the grid column for a session: an exact match, otherwise the column it
 * overlaps most (ties broken by the closest start time).
 */
export function chooseColumn(slots: TimeSlot[], startMin: number, endMin: number): TimeSlot | null {
  const exact = slots.find((s) => s.startMin === startMin && s.endMin === endMin)
  if (exact) return exact
  let best: TimeSlot | null = null
  let bestOverlap = 0
  let bestDist = Infinity
  for (const s of slots) {
    const o = overlapMinutes(s, { startMin, endMin })
    const d = Math.abs(s.startMin - startMin)
    if (o > bestOverlap || (o === bestOverlap && o > 0 && d < bestDist)) {
      best = s
      bestOverlap = o
      bestDist = d
    }
  }
  return best
}

export interface BuildOptions {
  /** Days that are printed as WEEKEND when empty (default: Friday). */
  weekendDays?: DayName[]
  /** Theory columns collected from the PDF, in addition to the defaults. */
  theoryColumns?: { startMin: number; endMin: number }[]
}

export function buildRoutineGrid(cells: ParsedCell[], options: BuildOptions = {}): RoutineGrid {
  const weekendDays = options.weekendDays ?? ['Fri']

  // Column set: defaults ∪ theory columns seen in the PDF.
  const slotMap = new Map<string, TimeSlot>()
  for (const s of DEFAULT_TIME_SLOTS) slotMap.set(s.id, s)
  for (const c of options.theoryColumns ?? []) {
    const id = slotId(c.startMin, c.endMin)
    if (!slotMap.has(id)) slotMap.set(id, makeTimeSlot(c.startMin, c.endMin))
  }
  const timeSlots = [...slotMap.values()].sort((a, b) => a.startMin - b.startMin)

  const slots: ScheduleSlot[] = []
  for (const cell of cells) {
    const type = inferSessionType(cell)
    let col = chooseColumn(timeSlots, cell.startMin, cell.endMin)
    if (!col) {
      col = makeTimeSlot(cell.startMin, cell.endMin)
      timeSlots.push(col)
      timeSlots.sort((a, b) => a.startMin - b.startMin)
    } else if (type === 'lab' && (col.startMin !== cell.startMin || col.endMin !== cell.endMin)) {
      col.altLabel = formatRange(cell.startMin, cell.endMin)
    }
    slots.push({
      id: newSlotId(),
      day: cell.day,
      slotId: col.id,
      courseCode: cell.courseCode,
      section: cell.section,
      room: cell.room,
      type,
      startMin: cell.startMin,
      endMin: cell.endMin,
      facultyTag: cell.facultyTag,
      source: 'parsed',
      ...(col.evening ? { frequency: defaultFrequency(type) } : {}),
    })
  }

  return {
    days: [...DAYS],
    timeSlots,
    slots,
    offDays: computeOffDays(slots, weekendDays),
    eveningOff: [],
  }
}

export function computeOffDays(slots: ScheduleSlot[], weekendDays: DayName[]): Record<DayName, OffDayStatus> {
  const busy = new Set(slots.map((s) => s.day))
  const out = {} as Record<DayName, OffDayStatus>
  for (const d of DAYS) {
    out[d] = busy.has(d) ? 'none' : weekendDays.includes(d) ? 'weekend' : 'no-class'
  }
  return out
}

/** Columns that contain at least one session, plus the pinned evening column. */
export function usedTimeSlots(grid: RoutineGrid): TimeSlot[] {
  const used = new Set(grid.slots.map((s) => s.slotId))
  return grid.timeSlots.filter((t) => used.has(t.id) || t.evening)
}

/** Columns to render: every column when `showEmpty`, otherwise only the used ones. */
export function visibleTimeSlots(grid: RoutineGrid, showEmpty: boolean): TimeSlot[] {
  return showEmpty ? grid.timeSlots : usedTimeSlots(grid)
}

/** Sessions for one (day, column) cell, ordered by start time. */
export function slotsAt(grid: RoutineGrid, day: DayName, slotId: string): ScheduleSlot[] {
  return grid.slots
    .filter((s) => s.day === day && s.slotId === slotId)
    .sort((a, b) => a.startMin - b.startMin)
}
