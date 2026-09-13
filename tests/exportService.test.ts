import { describe, expect, it } from 'vitest'
import { baseFileName, buildDocx, buildPdf, type ExportData } from '../src/services/exportService'
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
})
