import { describe, expect, it } from 'vitest'
import { parseRoutinePages, resolveFaculty, searchFaculty } from '../../src/application'
import { DocxTextExtractor } from '../../src/infrastructure'
import { fixtureBuffer } from '../helpers/fixtures'

describe('faculty lookup', async () => {
  const parse = parseRoutinePages(
    await new DocxTextExtractor().extract(fixtureBuffer('whole-routine-summer-2026.docx')),
  )

  it('parses the directory into entries and captures the school hint', () => {
    expect(parse.facultyDirectory.length).toBeGreaterThan(50)
    expect(parse.facultyDirectory.find((e) => e.shortForm === 'ASHRAF')?.name).toBe(
      'Mr. Ashrafur Rahman Chowdhury',
    )
    expect(parse.schoolHint).toBe('School of Science, Engineering & Technology')
    expect(parse.institutionHint).toBe('East Delta University')
  })

  it('ranks short-form matches above name matches', () => {
    const byTag = searchFaculty(parse.facultyDirectory, 'ashraf')
    expect(byTag[0].entry.shortForm).toBe('ASHRAF')
    const byName = searchFaculty(parse.facultyDirectory, 'chowdhury')
    expect(byName.some((c) => c.entry.shortForm === 'ASHRAF')).toBe(true)
    expect(searchFaculty(parse.facultyDirectory, '')).toEqual([])
  })

  it('resolves an unambiguous query into auto-fill fields and leaves unknown ones alone', () => {
    const match = resolveFaculty(parse, 'ASHRAF')!
    expect(match.entry.shortForm).toBe('ASHRAF')
    expect(match.fields).toEqual({
      fullName: 'Ashrafur Rahman Chowdhury',
      school: 'School of Science, Engineering & Technology',
      institution: 'East Delta University',
    })
    expect(match.fields.title).toBeUndefined() // no designation column in this routine
    expect(resolveFaculty(parse, 'a')).toBeNull() // ambiguous prefix
  })

  it('reads an optional designation column', () => {
    const entries = parseRoutinePages([
      {
        pageNumber: 1,
        width: 500,
        height: 100,
        items: [{ str: 'Faculty Members', x: 40, y: 10, width: 60, height: 8 }],
      },
      {
        pageNumber: 2,
        width: 500,
        height: 100,
        items: [
          { str: '1', x: 10, y: 10, width: 8, height: 8 },
          { str: 'Dr. Jane Doe', x: 40, y: 10, width: 60, height: 8 },
          { str: 'Assistant Professor', x: 140, y: 10, width: 80, height: 8 },
          { str: 'JD', x: 260, y: 10, width: 12, height: 8 },
        ],
      },
    ]).facultyDirectory
    expect(entries).toEqual([{ shortForm: 'JD', name: 'Dr. Jane Doe', designation: 'Assistant Professor' }])
    expect(resolveFaculty({ facultyDirectory: entries }, 'jd')?.fields).toEqual({
      fullName: 'Jane Doe',
      title: 'Assistant Professor',
    })
  })
})
