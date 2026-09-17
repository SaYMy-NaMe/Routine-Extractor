/**
 * A master routine is one uploaded departmental routine, indexed by a
 * semester title ("Summer 2026"). The parsed content is stored so the
 * document never has to be re-read, and the metadata alone is enough to
 * render the library list.
 */

import type { DocumentFormat, ParseResult } from './document'

export interface MasterRoutineMeta {
  readonly id: string
  /** Custom semester title the user gave on upload, e.g. "Fall 2026". */
  readonly title: string
  readonly fileName: string
  readonly format: DocumentFormat
  /** ISO timestamp. */
  readonly uploadedAt: string
  readonly cellCount: number
  readonly pageCount: number
}

export interface MasterRoutine extends MasterRoutineMeta {
  readonly parse: ParseResult
}

export const SEMESTER_TITLE_MAX = 40

/** Normalise a semester title: trim, squash spaces, capitalise words ("fall 2026" → "Fall 2026"). */
export function normaliseSemesterTitle(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, SEMESTER_TITLE_MAX)
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
}

export function validateSemesterTitle(input: string): string | null {
  const t = normaliseSemesterTitle(input)
  if (!t) return 'Give this routine a semester title, e.g. "Fall 2026".'
  if (t.length < 3) return 'The title is too short.'
  return null
}

/** Coerce persisted (untrusted) metadata. */
export function isMasterRoutineMeta(v: unknown): v is MasterRoutineMeta {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.title === 'string' &&
    typeof r.fileName === 'string' &&
    (r.format === 'pdf' || r.format === 'docx') &&
    typeof r.uploadedAt === 'string' &&
    typeof r.cellCount === 'number' &&
    typeof r.pageCount === 'number'
  )
}
