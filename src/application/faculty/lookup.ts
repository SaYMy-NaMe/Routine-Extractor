/**
 * Faculty lookup engine.
 *
 * Resolves a typed query ("ASHRAF", "ashrafur", "chowdhury") against the
 * master routine's faculty directory and ranks candidates: exact short form
 * first, then short-form prefix, then name-token prefix, then substring.
 * A resolved match yields the profile fields the document can vouch for
 * (name, designation, school, institution); anything the document does not
 * know is left for the user to fill in.
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

export type AutoFillFields = Partial<Pick<FacultyProfile, 'fullName' | 'title' | 'school' | 'institution'>>

export interface FacultyMatch {
  readonly entry: FacultyDirectoryEntry
  readonly fields: AutoFillFields
}

const norm = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function rankEntry(entry: FacultyDirectoryEntry, q: string): number | null {
  const short = entry.shortForm.toUpperCase()
  if (short === q) return 0
  if (short.startsWith(q)) return 1
  const name = norm(cleanPersonName(entry.name))
  const tokens = name.split(' ')
  if (tokens.some((t) => t.startsWith(q))) return 2
  if (name.includes(q)) return 3
  if (short.includes(q)) return 4
  return null
}

/** Ranked suggestions for a query (at most `limit`). */
export function searchFaculty(
  directory: readonly FacultyDirectoryEntry[],
  query: string,
  limit = 8,
): FacultyCandidate[] {
  const q = norm(query)
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
  if (best.entry.designation) fields.title = best.entry.designation
  if (parse.schoolHint) fields.school = parse.schoolHint
  if (parse.institutionHint) fields.institution = parse.institutionHint
  return { entry: best.entry, fields }
}
