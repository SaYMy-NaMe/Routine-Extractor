/**
 * Credit workload engine. A section counts once regardless of how many weekly
 * meetings it has, e.g. CSE 443.1 meeting on Monday and Tuesday is still one
 * section (3 credits). The credit rates come from a `CreditPolicy` strategy.
 */

import {
  type CourseWorkload,
  type CreditPolicy,
  DEFAULT_CREDIT_POLICY,
  EMPTY_WORKLOAD,
  type ScheduleSlot,
  type SessionType,
  type WorkloadSummary,
} from '../../domain'

export interface WorkloadOptions {
  /** Optional course titles keyed by course code (user-entered). */
  readonly titles?: Readonly<Record<string, string>>
  readonly policy?: CreditPolicy
}

interface CourseAccumulator {
  sections: Set<string>
  votes: Record<SessionType, number>
}

const round = (n: number): number => Math.round(n * 100) / 100

/** Group sessions by course and count distinct sections. */
export function computeWorkload(
  slots: readonly ScheduleSlot[],
  options: WorkloadOptions = {},
): WorkloadSummary {
  if (!slots.length) return EMPTY_WORKLOAD
  const policy = options.policy ?? DEFAULT_CREDIT_POLICY
  const byCourse = new Map<string, CourseAccumulator>()

  for (const s of slots) {
    const key = s.courseCode.trim().toUpperCase()
    if (!key) continue
    const acc = byCourse.get(key) ?? { sections: new Set<string>(), votes: { theory: 0, lab: 0 } }
    acc.sections.add(s.section) // '' = printed without a section number (e.g. an evening block)
    acc.votes[s.type] += 1
    byCourse.set(key, acc)
  }

  const courses: CourseWorkload[] = [...byCourse].map(([courseCode, acc]) => {
    // A course is a lab if most of its sessions are labs (guards against a single mis-tagged slot).
    const type: SessionType = acc.votes.lab > acc.votes.theory ? 'lab' : 'theory'
    const sections = [...acc.sections].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
    const creditsPerSection = policy.creditsPerSection(type)
    return {
      courseCode,
      title: options.titles?.[courseCode] ?? '',
      type,
      sections,
      creditsPerSection,
      totalCredits: round(creditsPerSection * sections.length),
    }
  })

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
