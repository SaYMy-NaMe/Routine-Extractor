/**
 * Faculty lookup engine.
 *
 * The search term is strictly a faculty initial ("ASHRAF", "MHN"): candidates
 * are ranked by exact initial, then initial prefix. A resolved match yields
 * only the fields the document can vouch for — full name, school and
 * institution; designation and everything else stay manual input.
 */

import {
  type FacultyDirectoryEntry,
  type FacultyProfile,
  type ParseResult,
  cleanPersonName,
} from '../../domain'

export interface FacultyCandidate {
  readonly entry: FacultyDirectoryEntry
  /** Lower is better. */
  readonly rank: number
}

export type AutoFillFields = Partial<Pick<FacultyProfile, 'fullName' | 'school' | 'institution'>>

/** The profile fields the lookup owns (filled on match, erased when the initial is cleared). */
export const AUTO_FILL_KEYS = ['fullName', 'school', 'institution'] as const

export interface FacultyMatch {
  readonly entry: FacultyDirectoryEntry
  readonly fields: AutoFillFields
}

const normInitial = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9.]+/g, '')
    .trim()

function rankEntry(entry: FacultyDirectoryEntry, q: string): number | null {
  const initial = normInitial(entry.shortForm)
  if (initial === q) return 0
  if (initial.startsWith(q)) return 1
  return null
}

/** Ranked suggestions for a query (at most `limit`). */
export function searchFaculty(
  directory: readonly FacultyDirectoryEntry[],
  query: string,
  limit = 8,
): FacultyCandidate[] {
  const q = normInitial(query)
  if (!q) return []
  const out: FacultyCandidate[] = []
  for (const entry of directory) {
    const rank = rankEntry(entry, q)
    if (rank !== null) out.push({ entry, rank })
  }
  return out.sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name)).slice(0, limit)
}

/**
 * The single entry a query resolves to: an exact short form, or the only
 * candidate when the query is unambiguous. Returns null when ambiguous.
 */
export function resolveFaculty(
  parse: Pick<ParseResult, 'facultyDirectory' | 'schoolHint' | 'institutionHint'>,
  query: string,
): FacultyMatch | null {
  const candidates = searchFaculty(parse.facultyDirectory, query, 2)
  const best = candidates[0]
  if (!best) return null
  if (best.rank !== 0 && candidates.length > 1) return null
  const fields: AutoFillFields = { fullName: cleanPersonName(best.entry.name) }
  if (parse.schoolHint) fields.school = parse.schoolHint
  if (parse.institutionHint) fields.institution = parse.institutionHint
  return { entry: best.entry, fields }
}
