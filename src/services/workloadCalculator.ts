/**
 * Credit workload engine.
 *
 * Rules (per the university's faculty load policy):
 *   Theory course: 3.0 credits per section taught
 *   Lab course:    1.5 credits per section taught
 *
 * A section counts once regardless of how many weekly meetings it has, e.g.
 * CSE 443.1 meeting on Monday and Tuesday is still one section (3 credits).
 */

import type { CourseWorkload, ScheduleSlot, SessionType, WorkloadSummary } from '../types/routine'
import { CREDITS_PER_SECTION } from '../types/routine'

export interface WorkloadOptions {
  /** Optional course titles keyed by course code (user-entered). */
  titles?: Record<string, string>
  /** Override of the credit rules, e.g. for institutions with 4-credit theory. */
  creditsPerSection?: Partial<Record<SessionType, number>>
}

/** Group sessions by course and count distinct sections. */
export function computeWorkload(slots: ScheduleSlot[], options: WorkloadOptions = {}): WorkloadSummary {
  const rules = { ...CREDITS_PER_SECTION, ...options.creditsPerSection }
  const byCourse = new Map<
    string,
    { type: SessionType; sections: Set<string>; typeVotes: Record<SessionType, number> }
  >()

  for (const s of slots) {
    const key = s.courseCode.trim().toUpperCase()
    let entry = byCourse.get(key)
    if (!entry) {
      entry = { type: s.type, sections: new Set(), typeVotes: { theory: 0, lab: 0 } }
      byCourse.set(key, entry)
    }
    entry.sections.add(s.section || '1')
    entry.typeVotes[s.type] += 1
  }

  const courses: CourseWorkload[] = []
  for (const [courseCode, entry] of byCourse) {
    // A course is a lab if most of its sessions are labs (guards against a single mis-tagged slot).
    const type: SessionType = entry.typeVotes.lab > entry.typeVotes.theory ? 'lab' : 'theory'
    const sections = [...entry.sections].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
    const creditsPerSection = rules[type]
    courses.push({
      courseCode,
      title: options.titles?.[courseCode] ?? '',
      type,
      sections,
      creditsPerSection,
      totalCredits: round(creditsPerSection * sections.length),
    })
  }

  // Theory first, then labs; heavier load first; senior (higher-numbered) course first on ties.
  courses.sort(
    (a, b) =>
      Number(a.type === 'lab') - Number(b.type === 'lab') ||
      b.totalCredits - a.totalCredits ||
      b.courseCode.localeCompare(a.courseCode, undefined, { numeric: true }),
  )

  return {
    courses,
    totalSections: courses.reduce((n, c) => n + c.sections.length, 0),
    totalCredits: round(courses.reduce((n, c) => n + c.totalCredits, 0)),
  }
}

/** "3 Credits * 3 Sections = 9 Credits" — the line printed under the routine. */
export function describeCourseLoad(c: CourseWorkload): string {
  const n = c.sections.length
  return `${formatCredits(c.creditsPerSection)} Credits * ${n} Section${n === 1 ? '' : 's'} = ${formatCredits(c.totalCredits)} Credits`
}

/** Full summary line, e.g. "CSE 443: Neural Network and Fuzzy Logics: 3 Credits * 3 Sections = 9 Credits". */
export function describeCourseLine(c: CourseWorkload): string {
  const title = c.title.trim()
  return `${c.courseCode}${title ? `: ${title}` : ''}: ${describeCourseLoad(c)}`
}

export function formatCredits(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
