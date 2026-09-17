/** Faculty search over parsed cells and the faculty directory. */

import type { FacultyDirectoryEntry, ParsedCell } from '../../domain'

const HONORIFIC_RE = /^(dr|mr|mrs|ms|md|prof|engr)\.?$/i

function tagTokens(tag: string): string[] {
  return tag
    .toUpperCase()
    .split(/[\s,/&+()]+/)
    .filter((t) => t && !HONORIFIC_RE.test(t))
}

/**
 * Keep only the cells taught by the searched faculty.
 * Exact short-form token match first (so "ANJ" doesn't hit "ANJUM"); when
 * nothing matches exactly we fall back to a substring search so partial or
 * full-name queries still work.
 */
export function filterCellsByFaculty(cells: readonly ParsedCell[], query: string): ParsedCell[] {
  const q = query.trim().toUpperCase()
  if (!q) return []
  const qTokens = q.split(/\s+/)
  const exact = cells.filter((c) => {
    const tokens = tagTokens(c.facultyTag)
    return qTokens.every((qt) => tokens.includes(qt))
  })
  if (exact.length) return exact
  return cells.filter((c) => c.facultyTag.toUpperCase().includes(q) || c.rawText.toUpperCase().includes(q))
}

/** Resolve a short form to a full name via the parsed directory (case-insensitive). */
export function lookupFacultyName(
  directory: readonly FacultyDirectoryEntry[],
  query: string,
): string | undefined {
  const q = query.trim().toUpperCase()
  if (!q) return undefined
  const exact = directory.find((e) => e.shortForm === q)
  if (exact) return exact.name
  return directory.find((e) => e.name.toUpperCase().includes(q))?.name
}
