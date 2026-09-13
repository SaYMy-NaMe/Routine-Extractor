/** Time helpers shared by the parser, grid builder and exporters. */

const TIME_RANGE_RE = /^(\d{1,2})[.:](\d{2})\s*(AM|PM)?\s*[-–—]\s*(\d{1,2})[.:](\d{2})\s*(AM|PM)?$/i

/** Is this string a "8.30-10.00" / "10:00 AM - 11:30 AM" style range? */
export function isTimeRange(text: string): boolean {
  return TIME_RANGE_RE.test(text.trim())
}

/**
 * Parse a time range into minutes since midnight.
 * Routine sheets omit AM/PM; hours below 8 are treated as afternoon, and an end
 * time that would precede the start is bumped into the PM half of the day.
 */
export function parseTimeRange(text: string): { startMin: number; endMin: number } | null {
  const m = TIME_RANGE_RE.exec(text.trim())
  if (!m) return null
  const [, sh, sm, sap, eh, em, eap] = m
  const start = toMinutes(+sh, +sm, sap)
  let end = toMinutes(+eh, +em, eap)
  if (end <= start) end += 12 * 60
  return { startMin: start, endMin: end }
}

function toMinutes(h: number, m: number, ampm?: string): number {
  let hour = h % 12
  if (ampm) {
    if (ampm.toUpperCase() === 'PM') hour += 12
  } else if (h < 8) {
    // No meridiem printed: 1.30, 3.00, 6.30 are afternoon/evening classes.
    hour = h + 12
  } else {
    hour = h
  }
  return hour * 60 + m
}

/** 810 → "1:30 PM" */
export function formatTime(min: number): string {
  const h24 = Math.floor(min / 60) % 24
  const m = min % 60
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

/** 600, 690 → "10:00 AM - 11:30 AM" */
export function formatRange(startMin: number, endMin: number): string {
  return `${formatTime(startMin)} - ${formatTime(endMin)}`
}

/** "HH:MM" (24h) for <input type="time"> */
export function toInputTime(min: number): string {
  return `${Math.floor(min / 60)
    .toString()
    .padStart(2, '0')}:${(min % 60).toString().padStart(2, '0')}`
}

export function fromInputTime(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Overlap length in minutes between two ranges (0 when disjoint). */
export function overlapMinutes(
  a: { startMin: number; endMin: number },
  b: { startMin: number; endMin: number },
): number {
  return Math.max(0, Math.min(a.endMin, b.endMin) - Math.max(a.startMin, b.startMin))
}
