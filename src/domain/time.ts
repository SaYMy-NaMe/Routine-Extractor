/**
 * Time-of-day helpers. All times are minutes since midnight so arithmetic
 * (overlap, ordering, comparison) is trivial and locale-independent.
 */

/** Minutes since midnight. */
export type Minutes = number

export interface TimeRange {
  readonly startMin: Minutes
  readonly endMin: Minutes
}

const TIME_RANGE_RE = /^(\d{1,2})[.:](\d{2})\s*(AM|PM)?\s*[-–—]\s*(\d{1,2})[.:](\d{2})\s*(AM|PM)?$/i

/** Is this string a "8.30-10.00" / "10:00 AM - 11:30 AM" style range? */
export function isTimeRange(text: string): boolean {
  return TIME_RANGE_RE.test(text.trim())
}

/**
 * Parse a printed time range.
 * Routine sheets usually omit AM/PM: hours below 8 are treated as afternoon,
 * and an end time that would precede the start is bumped into the PM half.
 */
export function parseTimeRange(text: string): TimeRange | null {
  const m = TIME_RANGE_RE.exec(text.trim())
  if (!m) return null
  const [, sh, sm, sap, eh, em, eap] = m
  const startMin = toMinutes(+sh, +sm, sap)
  let endMin = toMinutes(+eh, +em, eap)
  if (endMin <= startMin) endMin += 12 * 60
  return { startMin, endMin }
}

function toMinutes(h: number, m: number, meridiem?: string): Minutes {
  let hour: number
  if (meridiem) {
    hour = (h % 12) + (meridiem.toUpperCase() === 'PM' ? 12 : 0)
  } else {
    hour = h < 8 ? h + 12 : h
  }
  return hour * 60 + m
}

/** 810 → "1:30 PM" */
export function formatTime(min: Minutes): string {
  const h24 = Math.floor(min / 60) % 24
  const mm = min % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${mm.toString().padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`
}

/** 600, 690 → "10:00 AM - 11:30 AM" */
export function formatRange(range: TimeRange): string {
  return `${formatTime(range.startMin)} - ${formatTime(range.endMin)}`
}

/** "HH:MM" (24 h) for `<input type="time">`. */
export function toInputTime(min: Minutes): string {
  return `${Math.floor(min / 60)
    .toString()
    .padStart(2, '0')}:${(min % 60).toString().padStart(2, '0')}`
}

/** Inverse of `toInputTime`; invalid input yields 0. */
export function fromInputTime(value: string): Minutes {
  const [h, m] = value.split(':').map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

/** Overlap length in minutes between two ranges (0 when disjoint). */
export function overlapMinutes(a: TimeRange, b: TimeRange): Minutes {
  return Math.max(0, Math.min(a.endMin, b.endMin) - Math.max(a.startMin, b.startMin))
}

export function sameRange(a: TimeRange, b: TimeRange): boolean {
  return a.startMin === b.startMin && a.endMin === b.endMin
}
