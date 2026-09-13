import { describe, expect, it } from 'vitest'
import { baseFileName, buildDocx, buildPdf, type ExportData } from '../src/services/exportService'
import { buildRoutineGrid, sessionLabel, usedTimeSlots } from '../src/services/routineBuilder'
import { computeWorkload } from '../src/services/workloadCalculator'
import type { ParsedCell } from '../src/types/routine'
import { EVENING_SLOT } from '../src/types/routine'

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
  cell('Tue', EVENING_SLOT.startMin, EVENING_SLOT.endMin, 'CSE 411', '', 'N202'),
  cell('Wed', EVENING_SLOT.startMin, EVENING_SLOT.endMin, 'CSE 226', '', 'N607', 'lab'),
])
grid.eveningOff = ['Sun']

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

  it('labels evening classes with their frequency', () => {
    const evening = grid.timeSlots.find((t) => t.evening)!
    const tue = grid.slots.find((s) => s.day === 'Tue')!
    const wed = grid.slots.find((s) => s.day === 'Wed')!
    expect(sessionLabel(tue, evening)).toBe('CSE 411 [Weekly]')
    expect(sessionLabel(wed, evening)).toBe('CSE 226 LAB [Alt. Week]')
    expect(sessionLabel(grid.slots.find((s) => s.day === 'Sat' && s.type === 'lab')!)).toBe('CSE 112.7 LAB')
  })

  it('always includes the evening column in the exported matrix', () => {
    expect(data.columns.some((c) => c.evening)).toBe(true)
    expect(data.columns[data.columns.length - 1].label).toBe('6:30 PM - 9:30 PM')
  })

  it('renders the workload table and evening details into the DOCX', async () => {
    const blob = await buildDocx(data)
    const { unzipSync } = await import('fflate')
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    const xml = new TextDecoder().decode(files['word/document.xml'])
    const text = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(' | ')
    expect(text).toContain('6:30 PM - 9:30 PM')
    expect(text).toContain('CSE 411 [Weekly]')
    expect(text).toContain('CSE 226 LAB [Alt. Week]')
    expect(text).toContain('OFF')
    expect(text).toContain('Workload Summary')
    expect(text).toContain('Total Workload')
    expect(text).toContain('12 Credits')
  })
})
