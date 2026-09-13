import { describe, expect, it } from 'vitest'
import { computeWorkload, describeCourseLine } from '../src/services/workloadCalculator'
import type { ScheduleSlot } from '../src/types/routine'

const mk = (
  courseCode: string,
  section: string,
  type: ScheduleSlot['type'],
  day: ScheduleSlot['day'] = 'Sat',
): ScheduleSlot => ({
  id: `${courseCode}.${section}-${day}`,
  day,
  slotId: 'x',
  courseCode,
  section,
  room: '111',
  type,
  startMin: 600,
  endMin: 690,
  facultyTag: 'ASHRAF',
  source: 'parsed',
})

describe('computeWorkload', () => {
  it('matches the Summer 2026 benchmark: 21 credits', () => {
    const slots: ScheduleSlot[] = [
      mk('CSE 411', '6', 'theory', 'Sat'),
      mk('CSE 443', '3', 'theory', 'Sat'),
      mk('CSE 112', '7', 'lab', 'Sat'),
      mk('CSE 443', '1', 'theory', 'Mon'),
      mk('CSE 411', '5', 'theory', 'Mon'),
      mk('CSE 443', '2', 'theory', 'Tue'),
      mk('CSE 443', '1', 'theory', 'Tue'),
      mk('CSE 411', '', 'theory', 'Tue'), // evening section printed without a number
      mk('CSE 411', '5', 'theory', 'Wed'),
      mk('CSE 411', '6', 'theory', 'Wed'),
      mk('CSE 443', '2', 'theory', 'Thu'),
      mk('CSE 443', '3', 'theory', 'Thu'),
      mk('CSE 226', '5', 'lab', 'Thu'),
    ]
    const w = computeWorkload(slots, { titles: { 'CSE 443': 'Neural Network and Fuzzy Logics' } })
    expect(w.courses.map((c) => [c.courseCode, c.sections.length, c.totalCredits])).toEqual([
      ['CSE 443', 3, 9],
      ['CSE 411', 3, 9],
      ['CSE 226', 1, 1.5],
      ['CSE 112', 1, 1.5],
    ])
    expect(w.totalSections).toBe(8)
    expect(w.totalCredits).toBe(21)
    expect(describeCourseLine(w.courses[0])).toBe(
      'CSE 443: Neural Network and Fuzzy Logics: 3 Credits * 3 Sections = 9 Credits',
    )
    expect(describeCourseLine(w.courses[2])).toBe('CSE 226: 1.5 Credits * 1 Section = 1.5 Credits')
  })

  it('counts a section once even when it meets several times a week', () => {
    const w = computeWorkload([mk('CSE 443', '1', 'theory', 'Mon'), mk('CSE 443', '1', 'theory', 'Tue')])
    expect(w.totalCredits).toBe(3)
  })

  it('supports custom credit rules', () => {
    const w = computeWorkload([mk('CSE 443', '1', 'theory')], { creditsPerSection: { theory: 4 } })
    expect(w.totalCredits).toBe(4)
  })

  it('returns an empty summary for no slots', () => {
    expect(computeWorkload([])).toEqual({ courses: [], totalSections: 0, totalCredits: 0 })
  })
})
