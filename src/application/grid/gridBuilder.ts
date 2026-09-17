/**
 * Projects the faculty's parsed cells onto the personal routine grid
 * (Day × TimeSlot). Lab blocks (2 h) are folded into the theory column they
 * overlap most, mirroring how the official personal routine prints
 * "3:00 PM - 4:30 PM / 3:30 PM - 5:30 PM" in a single column.
 */

import {
  DAYS,
  DEFAULT_TIME_RANGES,
  type DayName,
  type OffDayStatus,
  type ParsedCell,
  type RoutineGrid,
  type ScheduleSlot,
  type SessionType,
  type TimeRange,
  type TimeSlot,
  defaultFrequency,
  formatRange,
  makeTimeSlot,
  occupantOf,
  overlapMinutes,
  sameRange,
  timeSlotId,
} from '../../domain'

let counter = 0
/** Unique, sortable id for a session (time-based prefix keeps ids unique across reloads). */
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
  return /\blab\b/i.test(cell.rawText) ? 'lab' : 'theory'
}

/**
 * Pick the grid column for a session: an exact match, otherwise the column it
 * overlaps most (ties broken by the closest start time).
 */
export function chooseColumn(slots: readonly TimeSlot[], range: TimeRange): TimeSlot | null {
  const candidates = slots.filter((s) => !s.isBreak)
  const exact = candidates.find((s) => sameRange(s, range))
  if (exact) return exact
  let best: TimeSlot | null = null
  let bestOverlap = 0
  let bestDist = Infinity
  for (const s of candidates) {
    const o = overlapMinutes(s, range)
    const d = Math.abs(s.startMin - range.startMin)
    if (o > bestOverlap || (o === bestOverlap && o > 0 && d < bestDist)) {
      best = s
      bestOverlap = o
      bestDist = d
    }
  }
  return best
}

export function computeOffDays(
  slots: readonly ScheduleSlot[],
  weekendDays: readonly DayName[],
): Record<DayName, OffDayStatus> {
  const busy = new Set(slots.map((s) => s.day))
  const out = {} as Record<DayName, OffDayStatus>
  for (const d of DAYS) out[d] = busy.has(d) ? 'none' : weekendDays.includes(d) ? 'weekend' : 'no-class'
  return out
}

export interface BuildOptions {
  /** Days that are printed as WEEKEND when empty (default: Friday). */
  readonly weekendDays?: readonly DayName[]
  /** Theory columns found in the source document, added to the defaults. */
  readonly theoryColumns?: readonly TimeRange[]
}

export const DEFAULT_WEEKEND: readonly DayName[] = ['Fri']

export interface BuildResult {
  readonly grid: RoutineGrid
  /** Parsed cells that could not be placed because their cell was already taken (one class per cell). */
  readonly skipped: readonly ParsedCell[]
}

export function buildRoutineGrid(cells: readonly ParsedCell[], options: BuildOptions = {}): RoutineGrid {
  return buildRoutine(cells, options).grid
}

export function buildRoutine(cells: readonly ParsedCell[], options: BuildOptions = {}): BuildResult {
  const weekendDays = options.weekendDays ?? DEFAULT_WEEKEND

  // Column set: defaults ∪ theory columns seen in the document.
  const slotMap = new Map<string, TimeSlot>()
  for (const r of [...DEFAULT_TIME_RANGES, ...(options.theoryColumns ?? [])]) {
    const id = timeSlotId(r)
    if (!slotMap.has(id)) slotMap.set(id, makeTimeSlot(r))
  }
  const timeSlots = [...slotMap.values()]

  const slots: ScheduleSlot[] = []
  const skipped: ParsedCell[] = []
  for (const cell of cells) {
    const type = inferSessionType(cell)
    let col = chooseColumn(timeSlots, cell)
    if (!col) {
      col = makeTimeSlot(cell)
      timeSlots.push(col)
    } else if (type === 'lab' && !sameRange(col, cell) && !col.altLabel) {
      const idx = timeSlots.indexOf(col)
      col = { ...col, altLabel: formatRange(cell) }
      timeSlots[idx] = col
    }
    if (occupantOf(slots, cell.day, col.id)) {
      skipped.push(cell)
      continue
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
    grid: {
      days: [...DAYS],
      timeSlots: timeSlots.sort((a, b) => a.startMin - b.startMin),
      slots,
      offDays: computeOffDays(slots, weekendDays),
      eveningOff: [],
    },
    skipped,
  }
}

export const EMPTY_GRID: RoutineGrid = Object.freeze({
  days: [...DAYS],
  timeSlots: DEFAULT_TIME_RANGES.map((r) => makeTimeSlot(r)),
  slots: [],
  offDays: computeOffDays([], DEFAULT_WEEKEND),
  eveningOff: [],
})
