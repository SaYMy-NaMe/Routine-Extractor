import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { collectPages } from '../src/services/pdfText'
import { filterCellsByFaculty, lookupFacultyName, parseRoutinePages } from '../src/services/pdfParser'
import { buildRoutineGrid, slotsAt } from '../src/services/routineBuilder'
import { fullCourseCode } from '../src/types/routine'

async function loadFixture() {
  const data = new Uint8Array(readFileSync(resolve(__dirname, 'fixtures/whole-routine-summer-2026.pdf')))
  const pdf = await getDocument({ data, verbosity: 0 }).promise
  return collectPages(pdf)
}

describe('parseRoutinePages (Summer 2026 whole routine)', async () => {
  const pages = await loadFixture()
  const result = parseRoutinePages(pages)

  it('reads header hints and the faculty directory', () => {
    expect(result.pageCount).toBe(12)
    expect(result.semesterHint).toBe('Summer 2026')
    expect(result.institutionHint).toMatch(/East Delta University/)
    expect(lookupFacultyName(result.facultyDirectory, 'ashraf')).toBe('Mr. Ashrafur Rahman Chowdhury')
    expect(result.warnings).toEqual([])
  })

  it('reports the header columns of theory and lab tables', () => {
    const theory = result.columns.filter((c) => c.kind === 'theory').map((c) => c.label)
    expect(theory).toEqual(['8.30-10.00', '10.00-11.30', '11.30-1.00', '1.30-3.00', '3.00-4.30', '4.30-6.00'])
    const lab = result.columns.filter((c) => c.kind === 'lab').map((c) => c.label)
    expect(lab).toContain('3.30-5.30')
    expect(lab).toContain('9.00-11.00')
  })

  it('lifts every day table', () => {
    const days = new Set(result.cells.map((c) => c.day))
    expect([...days].sort()).toEqual(['Mon', 'Sat', 'Sun', 'Thu', 'Tue', 'Wed'])
    expect(result.cells.length).toBeGreaterThan(400)
  })

  it('extracts the exact ASHRAF schedule', () => {
    const mine = filterCellsByFaculty(result.cells, 'ASHRAF')
    const rows = mine.map(
      (c) => `${c.day} ${c.slotLabel} ${c.courseCode}.${c.section} ${c.room} ${c.tableKind}`,
    )
    expect(rows).toEqual([
      'Sat 11.30-1.00 CSE 411.6 N204 theory',
      'Sat 1.30-3.00 CSE 443.3 N604 theory',
      'Sat 3.30-5.30 CSE 112.7 N607 lab',
      'Mon 11.30-1.00 CSE 443.1 311 theory',
      'Mon 3.00-4.30 CSE 411.5 N203 theory',
      'Tue 3.00-4.30 CSE 443.2 114 theory',
      'Tue 4.30-6.00 CSE 443.1 111 theory',
      'Wed 10.00-11.30 CSE 411.5 N604 theory',
      'Wed 11.30-1.00 CSE 411.6 N601 theory',
      'Thu 11.30-1.00 CSE 443.2 N601 theory',
      'Thu 1.30-3.00 CSE 443.3 N204 theory',
      'Thu 3.30-5.30 CSE 226.5 115 lab',
    ])
  })

  it('does not match partial tags exactly', () => {
    // "ANJ" must not pick up "ANJUM"-style tags; exact token match wins.
    const anj = filterCellsByFaculty(result.cells, 'ANJ')
    expect(anj.every((c) => c.facultyTag.split(/\s+/).includes('ANJ'))).toBe(true)
    expect(anj.length).toBeGreaterThan(0)
  })

  it('honours in-cell time overrides like "(11.30-1.30)"', () => {
    const ph = filterCellsByFaculty(result.cells, 'PH').find((c) => c.courseCode === 'CSE 215')
    expect(ph).toBeDefined()
    expect(ph!.startMin).toBe(11 * 60 + 30)
    expect(ph!.endMin).toBe(13 * 60 + 30)
  })

  it('builds the personal grid with folded lab columns and off-day badges', () => {
    const mine = filterCellsByFaculty(result.cells, 'ASHRAF')
    const grid = buildRoutineGrid(mine, { theoryColumns: result.columns.filter((c) => c.kind === 'theory') })
    expect(grid.offDays.Sun).toBe('no-class')
    expect(grid.offDays.Fri).toBe('weekend')
    expect(grid.offDays.Sat).toBe('none')

    const labCol = grid.timeSlots.find((t) => t.label === '3:00 PM - 4:30 PM')!
    expect(labCol.altLabel).toBe('3:30 PM - 5:30 PM')
    const thu = slotsAt(grid, 'Thu', labCol.id)
    expect(thu.map((s) => `${fullCourseCode(s)} ${s.type} ${s.room}`)).toEqual(['CSE 226.5 lab 115'])
    const wed = grid.slots.filter((s) => s.day === 'Wed').map((s) => grid.timeSlots.find((t) => t.id === s.slotId)!.label)
    expect(wed).toEqual(['10:00 AM - 11:30 AM', '11:30 AM - 1:00 PM'])
  })
})
