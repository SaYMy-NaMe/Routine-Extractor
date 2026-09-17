/** Turns the text lines of one matrix cell into course fields. */

import { isTimeRange, parseCourseCode, parseTimeRange, type TimeRange } from '../../domain'

export interface CellFields {
  readonly courseCode: string
  readonly section: string
  readonly facultyTag: string
  /** In-cell time override such as "CSE 215.1 (11.30-1.30)". */
  readonly override?: TimeRange
}

const NOISE_RE = /^(no class|weekend|holiday|off|break|-+)$/i

export function parseCellText(lines: readonly string[]): CellFields | null {
  const clean = lines.map((l) => l.trim()).filter(Boolean)
  if (!clean.length || clean.every((l) => NOISE_RE.test(l))) return null

  const courseIdx = clean.findIndex((l) => parseCourseCode(l) !== null)
  if (courseIdx === -1) return null
  const { courseCode, section, rest } = parseCourseCode(clean[courseIdx])!

  const paren = /\(([^)]*)\)/.exec(rest)
  const override = paren && isTimeRange(paren[1]) ? (parseTimeRange(paren[1]) ?? undefined) : undefined

  // Faculty tag: everything after the course line.
  const facultyTag = clean
    .slice(courseIdx + 1)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  return { courseCode, section, facultyTag, override }
}
