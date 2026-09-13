import { describe, expect, it } from 'vitest'
import { baseFileName, buildDocx, buildIcs, buildPdf, type ExportData } from '../src/services/exportService'
import { buildRoutineGrid, usedTimeSlots } from '../src/services/routineBuilder'
import { computeWorkload } from '../src/services/workloadCalculator'
import type { ParsedCell } from '../src/types/routine'

const cell = (
  day: ParsedCell['day'],
  start: number,
  end: number,
  code: string,
  sec: string,
  room: string,
  kind: ParsedCell['tableKind'] = 'theory',
): ParsedCell => ({
  day,
  tableKind: kind,
  room,
  slotLabel: '',
  startMin: start,
  endMin: end,
  rawText: `${code}.${sec} / ASHRAF`,
  courseCode: code,
  section: sec,
  facultyTag: 'ASHRAF',
  page: 1,
})

const grid = buildRoutineGrid([
  cell('Sat', 690, 780, 'CSE 411', '6', 'N204'),
  cell('Sat', 930, 1050, 'CSE 112', '7', 'N607', 'lab'),
  cell('Thu', 690, 780, 'CSE 443', '2', 'N601'),
])

const data: ExportData = {
  profile: {
    searchQuery: 'ASHRAF',
    fullName: 'Ashrafur Rahman Chowdhury',
    title: 'Lecturer',
    department: 'Computer Science and Engineering',
    school: 'School of Science, Engineering and Technology',
    institution: 'East Delta University',
    email: 'a@b.c',
    phone: '+880 1',
    semester: 'Summer 2026',
  },
  grid,
  columns: usedTimeSlots(grid),
  workload: computeWorkload(grid.slots),
}

describe('exportService', () => {
  it('names files from the profile', () => {
    expect(baseFileName(data.profile)).toBe('Ashrafur-Rahman-Chowdhury-Summer-2026-routine')
  })

  it('builds a single-page landscape PDF', () => {
    const doc = buildPdf(data)
    expect(doc.getNumberOfPages()).toBe(1)
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight())
  })

  it('builds a DOCX blob', async () => {
    const blob = await buildDocx(data)
    expect(blob.size).toBeGreaterThan(1000)
  })

  it('builds weekly recurring iCal events with local floating times', () => {
    const ics = buildIcs(data, {
      semesterStart: '2026-09-20',
      semesterEnd: '2027-01-10',
      reminderMinutes: 15,
    })
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(3)
    // 2026-09-20 is a Sunday → first Saturday class on 2026-09-26, first Thursday on 2026-09-24
    expect(ics).toContain('DTSTART:20260926T113000')
    expect(ics).toContain('DTSTART:20260924T113000')
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=SA;UNTIL=20270110T235959')
    expect(ics).toContain('SUMMARY:CSE 112.7 LAB (N607)')
    expect(ics).toContain('TRIGGER:-PT15M')
    expect(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75 + 3)).toBe(true)
  })

  it('omits alarms when the reminder is 0', () => {
    const ics = buildIcs(data, { semesterStart: '2026-09-20', semesterEnd: '2027-01-10', reminderMinutes: 0 })
    expect(ics).not.toContain('VALARM')
  })
})
