import { describe, expect, it } from 'vitest'
import {
  buildRoutineGrid,
  filterCellsByFaculty,
  lookupFacultyName,
  parseCellText,
  parseRoutinePages,
  slotsAt,
} from '../../src/application'
import { fullCourseCode } from '../../src/domain'
import { ASHRAF_SCHEDULE, describeCell, pdfFixturePages } from '../helpers/fixtures'

describe('parseRoutinePages (Summer 2026 whole routine, PDF)', async () => {
  const result = parseRoutinePages(await pdfFixturePages('whole-routine-summer-2026.pdf'))

  it('reads header hints and the faculty directory', () => {
    expect(result.pageCount).toBe(12)
    expect(result.semesterHint).toBe('Summer 2026')
    expect(result.institutionHint).toMatch(/East Delta University/)
    expect(lookupFacultyName(result.facultyDirectory, 'ashraf')).toBe('Mr. Ashrafur Rahman Chowdhury')
    expect(result.schoolHint).toBe('School of Science, Engineering & Technology')
    expect(result.warnings).toEqual([])
  })

  it('reports the header columns of theory and lab tables', () => {
    const theory = result.columns.filter((c) => c.kind === 'theory').map((c) => c.label)
    expect(theory).toEqual(['8.30-10.00', '10.00-11.30', '11.30-1.00', '1.30-3.00', '3.00-4.30', '4.30-6.00'])
    const lab = result.columns.filter((c) => c.kind === 'lab').map((c) => c.label)
    expect(lab).toEqual(expect.arrayContaining(['3.30-5.30', '9.00-11.00']))
  })

  it('lifts every day table without exam-routine contamination', () => {
    expect([...new Set(result.cells.map((c) => c.day))].sort()).toEqual([
      'Mon',
      'Sat',
      'Sun',
      'Thu',
      'Tue',
      'Wed',
    ])
    expect(result.cells.length).toBe(664)
  })

  it('extracts the exact ASHRAF schedule', () => {
    expect(filterCellsByFaculty(result.cells, 'ASHRAF').map(describeCell)).toEqual(ASHRAF_SCHEDULE)
  })

  it('does not match partial tags exactly', () => {
    const anj = filterCellsByFaculty(result.cells, 'ANJ')
    expect(anj.length).toBeGreaterThan(0)
    expect(anj.every((c) => c.facultyTag.split(/\s+/).includes('ANJ'))).toBe(true)
  })

  it('honours in-cell time overrides like "(11.30-1.30)"', () => {
    const ph = filterCellsByFaculty(result.cells, 'PH').find((c) => c.courseCode === 'CSE 215')
    expect(ph).toMatchObject({ startMin: 690, endMin: 810 })
  })

  it('builds the personal grid with folded lab columns and off-day badges', () => {
    const grid = buildRoutineGrid(filterCellsByFaculty(result.cells, 'ASHRAF'), {
      theoryColumns: result.columns.filter((c) => c.kind === 'theory'),
    })
    expect(grid.offDays).toMatchObject({ Sun: 'no-class', Fri: 'weekend', Sat: 'none' })
    const labCol = grid.timeSlots.find((t) => t.label === '3:00 PM - 4:30 PM')!
    expect(labCol.altLabel).toBe('3:30 PM - 5:30 PM')
    expect(slotsAt(grid, 'Thu', labCol.id).map((s) => `${fullCourseCode(s)} ${s.type} ${s.room}`)).toEqual([
      'CSE 226.5 lab 115',
    ])
    const wed = grid.slots
      .filter((s) => s.day === 'Wed')
      .map((s) => grid.timeSlots.find((t) => t.id === s.slotId)!.label)
    expect(wed).toEqual(['10:00 AM - 11:30 AM', '11:30 AM - 1:00 PM'])
  })
})

describe('parseCellText', () => {
  it('parses course / faculty lines and ignores noise', () => {
    expect(parseCellText(['CSE 443.2', 'ASHRAF'])).toMatchObject({
      courseCode: 'CSE 443',
      section: '2',
      facultyTag: 'ASHRAF',
    })
    expect(parseCellText(['NO CLASS'])).toBeNull()
    expect(parseCellText([])).toBeNull()
    expect(parseCellText(['AA 099.1 (EEE)', 'LTN'])).toMatchObject({
      courseCode: 'AA 099',
      section: '1',
      facultyTag: 'LTN',
    })
  })
})
