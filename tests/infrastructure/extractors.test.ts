import { describe, expect, it } from 'vitest'
import { filterCellsByFaculty, parseRoutinePages } from '../../src/application'
import { DocxTextExtractor, PdfTextExtractor, docxXmlToPages } from '../../src/infrastructure'
import { ASHRAF_SCHEDULE, describeCell, fixtureBuffer, pdfFixturePages } from '../helpers/fixtures'

describe('DocxTextExtractor', () => {
  it('accepts by extension or MIME type', () => {
    const x = new DocxTextExtractor()
    expect(x.accepts({ name: 'a.DOCX', type: '' })).toBe(true)
    expect(
      x.accepts({
        name: 'blob',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    ).toBe(true)
    expect(x.accepts({ name: 'a.pdf', type: 'application/pdf' })).toBe(false)
    expect(new PdfTextExtractor().accepts({ name: 'a.pdf', type: '' })).toBe(true)
  })

  it('agrees cell-for-cell with the PDF export of the same routine', async () => {
    const docx = parseRoutinePages(
      await new DocxTextExtractor().extract(fixtureBuffer('whole-routine-summer-2026.docx')),
    )
    const pdf = parseRoutinePages(await pdfFixturePages('whole-routine-summer-2026.pdf'))
    expect(docx.warnings).toEqual([])
    expect(docx.cells.length).toBe(pdf.cells.length)
    expect(filterCellsByFaculty(docx.cells, 'ASHRAF').map(describeCell)).toEqual(ASHRAF_SCHEDULE)
    const key = (c: (typeof docx.cells)[number]) => `${describeCell(c)} ${c.facultyTag}`
    const a = new Set(docx.cells.map(key))
    const b = new Set(pdf.cells.map(key))
    // Word→PDF conversion mangles a handful of tags (ligatures, split runs); the matrices otherwise match.
    expect(
      [...a].filter((k) => !b.has(k)).length + [...b].filter((k) => !a.has(k)).length,
    ).toBeLessThanOrEqual(10)
  })

  it('handles entities, line breaks and grid spans in raw XML', () => {
    const xml = `<w:body><w:p><w:r><w:t>Summer 2026 &amp; Co</w:t></w:r></w:p>
      <w:tbl><w:tr><w:tc><w:tcPr><w:gridSpan w:val="3"/></w:tcPr><w:p><w:r><w:t>Saturday</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p/></w:tc><w:tc><w:p><w:r><w:t>8.30-10.00</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>10.00-11.30</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>103</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>CSE 111.1</w:t><w:br/><w:t>ABC</w:t></w:r></w:p></w:tc><w:tc><w:p/></w:tc></w:tr></w:tbl></w:body>`
    const pages = docxXmlToPages(xml)
    const result = parseRoutinePages(pages)
    expect(result.semesterHint).toBe('Summer 2026')
    expect(result.cells.map(describeCell)).toEqual(['Sat 8.30-10.00 CSE 111.1 103 theory'])
    expect(result.cells[0].facultyTag).toBe('ABC')
  })
})
