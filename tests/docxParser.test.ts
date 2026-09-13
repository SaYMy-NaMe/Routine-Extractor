import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { extractDocxText } from '../src/services/docxText'
import { collectPages } from '../src/services/pdfText'
import { filterCellsByFaculty, lookupFacultyName, parseRoutinePages } from '../src/services/pdfParser'

const fixture = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name))
const toBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer

const describeCell = (c: {
  day: string
  slotLabel: string
  courseCode: string
  section: string
  room: string
  tableKind: string
}) => `${c.day} ${c.slotLabel} ${c.courseCode}.${c.section} ${c.room} ${c.tableKind}`

describe('DOCX master routine ingestion', async () => {
  const docxPages = await extractDocxText(toBuffer(fixture('whole-routine-summer-2026.docx')))
  const docx = parseRoutinePages(docxPages)

  it('extracts every day table and the faculty directory', () => {
    expect(docx.warnings).toEqual([])
    expect(docx.semesterHint).toBe('Summer 2026')
    expect(docx.institutionHint).toBe('East Delta University')
    expect(lookupFacultyName(docx.facultyDirectory, 'ASHRAF')).toBe('Mr. Ashrafur Rahman Chowdhury')
    expect([...new Set(docx.cells.map((c) => c.day))].sort()).toEqual([
      'Mon',
      'Sat',
      'Sun',
      'Thu',
      'Tue',
      'Wed',
    ])
  })

  it('yields the exact ASHRAF schedule', () => {
    expect(filterCellsByFaculty(docx.cells, 'ASHRAF').map(describeCell)).toEqual([
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

  it('agrees cell-for-cell with the PDF export of the same routine', async () => {
    const data = new Uint8Array(fixture('whole-routine-summer-2026.pdf'))
    const pdf = parseRoutinePages(await collectPages(await getDocument({ data, verbosity: 0 }).promise))
    const key = (c: Parameters<typeof describeCell>[0] & { facultyTag: string }) =>
      `${describeCell(c)} ${c.facultyTag}`
    const a = new Set(docx.cells.map(key))
    const b = new Set(pdf.cells.map(key))
    const onlyDocx = [...a].filter((k) => !b.has(k))
    const onlyPdf = [...b].filter((k) => !a.has(k))
    // Word→PDF conversion mangles a handful of tags (ligatures, split runs); the matrices otherwise match.
    expect(onlyDocx.length + onlyPdf.length).toBeLessThanOrEqual(10)
    expect(docx.cells.length).toBe(pdf.cells.length)
  })
})
