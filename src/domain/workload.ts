/**
 * Credit workload rules.
 *
 * `CreditPolicy` is a Strategy: the default policy encodes the university's
 * load rule (theory 3.0 / lab 1.5 credits per section), and institutions with
 * different rules can supply their own without touching the calculator.
 */

import type { SessionType } from './schedule'

export interface CreditPolicy {
  /** Credits earned for teaching one section of the given type. */
  creditsPerSection(type: SessionType): number
}

export const DEFAULT_CREDIT_POLICY: CreditPolicy = {
  creditsPerSection: (type) => (type === 'lab' ? 1.5 : 3),
}

/** Build a policy from a partial override of the default rates. */
export function creditPolicy(rates: Partial<Record<SessionType, number>>): CreditPolicy {
  return {
    creditsPerSection: (type) => rates[type] ?? DEFAULT_CREDIT_POLICY.creditsPerSection(type),
  }
}

/** Workload for one course (all of its sections). */
export interface CourseWorkload {
  readonly courseCode: string
  /** Optional human title, e.g. "Neural Network and Fuzzy Logics" (user-editable). */
  readonly title: string
  readonly type: SessionType
  /** Distinct section numbers taught ('' = printed without a number). */
  readonly sections: readonly string[]
  readonly creditsPerSection: number
  readonly totalCredits: number
}

export interface WorkloadSummary {
  readonly courses: readonly CourseWorkload[]
  readonly totalSections: number
  readonly totalCredits: number
}

export const EMPTY_WORKLOAD: WorkloadSummary = Object.freeze({
  courses: [],
  totalSections: 0,
  totalCredits: 0,
})

export function formatCredits(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** Placeholder for any missing or empty value, in the UI and in every export. */
export const NOT_AVAILABLE = 'N/A'

/** `value` or the N/A placeholder when it is empty. */
export const orNA = (value: string | null | undefined): string =>
  value && value.trim() ? value : NOT_AVAILABLE

/** "3 (Section 1, 2, 3)" — section count with the section numbers, for summary tables. */
export function formatSections(c: CourseWorkload): string {
  return `${c.sections.length} (Section ${c.sections.map((s) => s || NOT_AVAILABLE).join(', ')})`
}

/** "7 Sections" */
export function formatSectionCount(n: number): string {
  return `${n} Section${n === 1 ? '' : 's'}`
}

/** "3 Credits * 3 Sections = 9 Credits" */
export function describeCourseLoad(c: CourseWorkload): string {
  const n = c.sections.length
  return `${formatCredits(c.creditsPerSection)} Credits * ${n} Section${n === 1 ? '' : 's'} = ${formatCredits(c.totalCredits)} Credits`
}

/** "CSE 443: Neural Network and Fuzzy Logics: 3 Credits * 3 Sections = 9 Credits" */
export function describeCourseLine(c: CourseWorkload): string {
  const title = c.title.trim()
  return `${c.courseCode}${title ? `: ${title}` : ''}: ${describeCourseLoad(c)}`
}
