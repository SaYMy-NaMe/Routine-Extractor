/**
 * Read-only queries over a `RoutineGrid`.
 */

import type {
  DayName,
  EmptyDayKind,
  EmptyDaySettings,
  RoutineGrid,
  ScheduleSlot,
  TimeSlot,
} from '../../domain'

/** Sessions for one (day, column) cell, ordered by start time. */
export function slotsAt(grid: RoutineGrid, day: DayName, slotId: string): ScheduleSlot[] {
  return grid.slots
    .filter((s) => s.day === day && s.slotId === slotId)
    .sort((a, b) => a.startMin - b.startMin)
}

/**
 * Columns to render: those holding a session, the pinned evening column, and
 * columns the user added by hand (they stay until removed).
 */
export function usedTimeSlots(grid: RoutineGrid): TimeSlot[] {
  const used = new Set(grid.slots.map((s) => s.slotId))
  return grid.timeSlots.filter((t) => used.has(t.id) || t.evening || t.pinned)
}

/** Columns a new session can still go into on a given day (one class per cell). */
export function freeColumns(grid: RoutineGrid, day: DayName, excludeId?: string): TimeSlot[] {
  const taken = new Set(grid.slots.filter((s) => s.day === day && s.id !== excludeId).map((s) => s.slotId))
  return grid.timeSlots.filter((t) => !taken.has(t.id))
}

/** Is the (day, column) cell an explicitly marked-off evening slot? */
export function isEveningOff(grid: RoutineGrid, day: DayName, column: TimeSlot): boolean {
  return Boolean(column.evening) && grid.eveningOff.includes(day)
}

export const hasSessions = (grid: RoutineGrid, day: DayName): boolean => grid.slots.some((s) => s.day === day)

/* ------------------------------------------------------------------------- */
/* Empty days                                                                 */
/* ------------------------------------------------------------------------- */

/** How an empty day should be rendered, or null when the day shows its cells. */
export interface EmptyDayView {
  readonly kind: EmptyDayKind
  /** Whether the badge also covers the evening cell. */
  readonly spansEvening: boolean
  readonly collapsed: boolean
}

/**
 * Detect an empty day. With `spanEvening` the evening column counts towards
 * emptiness (and the badge covers it); without it only the day columns do.
 */
export function emptyDayView(
  grid: RoutineGrid,
  day: DayName,
  settings: EmptyDaySettings,
): EmptyDayView | null {
  if (settings.mode === 'cells') return null
  const evening = grid.timeSlots.find((t) => t.evening)
  const daySlots = grid.slots.filter((s) => s.day === day && s.slotId !== evening?.id)
  if (daySlots.length) return null
  const eveningSlots = evening ? grid.slots.filter((s) => s.day === day && s.slotId === evening.id) : []
  if (settings.spanEvening && eveningSlots.length) return null
  const status = grid.offDays[day]
  // 'none' on an empty day is the user's explicit "show me the cells" choice —
  // unless the day only looks empty because its evening class is excluded.
  const kind: EmptyDayKind | null = status !== 'none' ? status : eveningSlots.length ? 'no-class' : null
  if (!kind) return null
  return { kind, spansEvening: settings.spanEvening, collapsed: settings.mode === 'collapsed' }
}

/** Days to render once hidden-empty-day rules are applied. */
export function visibleDays(grid: RoutineGrid, settings: EmptyDaySettings): DayName[] {
  if (settings.mode !== 'hidden') return [...grid.days]
  return grid.days.filter((d) => emptyDayView(grid, d, settings) === null)
}

export const manualEditCount = (grid: RoutineGrid): number =>
  grid.slots.filter((s) => s.source === 'manual').length

export const distinctCourses = (grid: RoutineGrid): string[] =>
  [...new Set(grid.slots.map((s) => s.courseCode))].sort()
