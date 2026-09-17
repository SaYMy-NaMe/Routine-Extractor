/**
 * Schedule model: the personal Day × TimeSlot routine and the sessions in it.
 * This module is pure — no React, no I/O, no framework imports.
 */

import { formatRange, sameRange, type TimeRange } from './time'

/* ------------------------------------------------------------------------- */
/* Days                                                                       */
/* ------------------------------------------------------------------------- */

/** Academic week in the order the routine is printed (Saturday first). */
export const DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const
export type DayName = (typeof DAYS)[number]

export const DAY_LABELS: Record<DayName, string> = {
  Sat: 'Saturday',
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
}

export const dayIndex = (d: DayName): number => DAYS.indexOf(d)

const DAY_RE = /^(sat(urday)?|sun(day)?|mon(day)?|tue(s|sday)?|wed(nesday)?|thu(rs|rsday)?|fri(day)?)$/i

/** Resolve "Saturday", "sat", "Thurs." … to a `DayName`, or null. */
export function parseDayName(text: string): DayName | null {
  const t = text.trim().replace(/[:.]$/, '')
  if (!DAY_RE.test(t)) return null
  const key = t.slice(0, 3).toLowerCase()
  return DAYS.find((d) => d.toLowerCase() === key) ?? null
}

/* ------------------------------------------------------------------------- */
/* Sessions                                                                   */
/* ------------------------------------------------------------------------- */

export type SessionType = 'theory' | 'lab'

/** How often an evening class meets. Day classes are implicitly weekly. */
export type ClassFrequency = 'weekly' | 'alternate'

export const FREQUENCY_LABELS: Record<ClassFrequency, string> = {
  weekly: 'Weekly',
  alternate: 'Alt. Week',
}

/** Evening rule: theory meets every week, labs alternate weeks. */
export function defaultFrequency(type: SessionType): ClassFrequency {
  return type === 'lab' ? 'alternate' : 'weekly'
}

/** The dedicated evening block (6:30 PM – 9:30 PM), always present in the grid. */
export const EVENING_RANGE: TimeRange = { startMin: 18 * 60 + 30, endMin: 21 * 60 + 30 }

export const isEveningRange = (r: TimeRange): boolean => sameRange(r, EVENING_RANGE)

/** The standard daily break (1:00 PM – 1:30 PM), laid out as its own column. */
export const BREAK_RANGE: TimeRange = { startMin: 13 * 60, endMin: 13 * 60 + 30 }

export const isBreakRange = (r: TimeRange): boolean => sameRange(r, BREAK_RANGE)

/** A lab that runs across the break (e.g. 11:30 AM – 1:30 PM) waives it for that day. */
export const coversBreak = (r: TimeRange): boolean =>
  r.startMin <= BREAK_RANGE.startMin && r.endMin >= BREAK_RANGE.endMin

/** A column of the personal routine grid. */
export interface TimeSlot extends TimeRange {
  readonly id: string
  /** Human label, e.g. "10:00 AM - 11:30 AM". */
  readonly label: string
  /** Secondary label when a lab block is folded into this column (e.g. "3:30 PM - 5:30 PM"). */
  readonly altLabel?: string
  /** The pinned evening column: always rendered, edited through its own popover. */
  readonly evening?: boolean
  /** A column the user added by hand: stays visible while empty until removed. */
  readonly pinned?: boolean
  /** The daily break column: never holds a class, waived on days with a lab running through it. */
  readonly isBreak?: boolean
}

export const timeSlotId = (r: TimeRange): string => `${r.startMin}-${r.endMin}`

export function makeTimeSlot(range: TimeRange, extra: Partial<Pick<TimeSlot, 'altLabel'>> = {}): TimeSlot {
  return {
    id: timeSlotId(range),
    label: formatRange(range),
    startMin: range.startMin,
    endMin: range.endMin,
    ...(isEveningRange(range) ? { evening: true } : {}),
    ...(isBreakRange(range) ? { isBreak: true, label: 'Break' } : {}),
    ...extra,
  }
}

export const EVENING_SLOT_ID = timeSlotId(EVENING_RANGE)

/** Standard theory columns used when the source document gives us nothing better. */
export const DEFAULT_TIME_RANGES: readonly TimeRange[] = [
  [8 * 60 + 30, 10 * 60],
  [10 * 60, 11 * 60 + 30],
  [11 * 60 + 30, 13 * 60],
  [BREAK_RANGE.startMin, BREAK_RANGE.endMin],
  [13 * 60 + 30, 15 * 60],
  [15 * 60, 16 * 60 + 30],
  [16 * 60 + 30, 18 * 60],
  [EVENING_RANGE.startMin, EVENING_RANGE.endMin],
].map(([startMin, endMin]) => ({ startMin, endMin }))

/** One class occurrence: a course section taught in a room on a day/column. */
export interface ScheduleSlot extends TimeRange {
  readonly id: string
  readonly day: DayName
  /** Id of the `TimeSlot` column this session is rendered in. */
  readonly slotId: string
  /** Base course code, e.g. "CSE 443". */
  readonly courseCode: string
  /** Section number as printed, e.g. "2" (empty when printed without one). */
  readonly section: string
  readonly room: string
  readonly type: SessionType
  /** Faculty short form found in the source cell (e.g. "ASHRAF"). */
  readonly facultyTag: string
  /** Manual edits are never overwritten by re-parsing. */
  readonly source: 'parsed' | 'manual'
  /** Meeting frequency — only meaningful for evening classes. */
  readonly frequency?: ClassFrequency
}

/** Full course code with section, e.g. "CSE 443.2". */
export function fullCourseCode(slot: Pick<ScheduleSlot, 'courseCode' | 'section'>): string {
  return slot.section ? `${slot.courseCode}.${slot.section}` : slot.courseCode
}

/** Printed chip text, e.g. "CSE 226.5 LAB" or "CSE 411 [Alt. Week]" for evening classes. */
export function sessionLabel(slot: ScheduleSlot, column?: Pick<TimeSlot, 'evening'>): string {
  let label = `${fullCourseCode(slot)}${slot.type === 'lab' ? ' LAB' : ''}`
  if (column?.evening && slot.frequency) label += ` [${FREQUENCY_LABELS[slot.frequency]}]`
  return label
}

/** Labs always print their explicit start–end timing; theory classes follow the column. */
export function sessionTiming(slot: ScheduleSlot): string | null {
  return slot.type === 'lab' ? formatRange(slot) : null
}

/* ------------------------------------------------------------------------- */
/* Grid                                                                       */
/* ------------------------------------------------------------------------- */

export type OffDayStatus = 'none' | 'no-class' | 'weekend'

export const OFF_DAY_LABELS: Record<Exclude<OffDayStatus, 'none'>, string> = {
  'no-class': 'NO CLASS ON THIS DAY',
  weekend: 'WEEKEND',
}

/** The personal routine matrix rendered in the preview and the exports. */
export interface RoutineGrid {
  readonly days: readonly DayName[]
  readonly timeSlots: readonly TimeSlot[]
  readonly slots: readonly ScheduleSlot[]
  /** Days with no sessions are annotated as either a "no class" day or the weekend. */
  readonly offDays: Readonly<Record<DayName, OffDayStatus>>
  /** Days whose evening cell is explicitly marked as an off slot. */
  readonly eveningOff: readonly DayName[]
}

/** Grid cells hold at most one class: this is the key that identifies a cell. */
export const cellKey = (day: DayName, slotId: string): string => `${day}|${slotId}`

/** The session already occupying a (day, column) cell, ignoring `excludeId` (the one being edited). */
export function occupantOf(
  slots: readonly ScheduleSlot[],
  day: DayName,
  slotId: string,
  excludeId?: string,
): ScheduleSlot | undefined {
  return slots.find((s) => s.day === day && s.slotId === slotId && s.id !== excludeId)
}

/** Course code normaliser shared by parser and editors: "cse-443.2" → { "CSE 443", "2" }. */
export const COURSE_CODE_RE = /^([A-Za-z]{2,5})\s*-?\s*(\d{3}[A-Za-z]?)(?:\.(\d{1,2}))?\b\s*(.*)$/

export function parseCourseCode(input: string): { courseCode: string; section: string; rest: string } | null {
  const m = COURSE_CODE_RE.exec(input.trim())
  if (!m) return null
  const [, dept, num, section = '', rest = ''] = m
  return { courseCode: `${dept.toUpperCase()} ${num.toUpperCase()}`, section, rest }
}
