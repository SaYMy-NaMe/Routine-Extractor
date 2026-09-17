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

  it('matches on the initial only: exact first, then prefix, never by name', () => {
    const exact = searchFaculty(parse.facultyDirectory, 'ashraf')
    expect(exact[0].entry.shortForm).toBe('ASHRAF')
    expect(exact[0].rank).toBe(0)
    const prefix = searchFaculty(parse.facultyDirectory, 'AS')
    expect(prefix.every((c) => c.entry.shortForm.startsWith('AS'))).toBe(true)
    expect(searchFaculty(parse.facultyDirectory, 'chowdhury')).toEqual([])
    expect(searchFaculty(parse.facultyDirectory, '')).toEqual([])
  })

  it('resolves an exact initial into name, school and institution only', () => {
    const match = resolveFaculty(parse, 'ASHRAF')!
    expect(match.entry.shortForm).toBe('ASHRAF')
    expect(match.fields).toEqual({
      fullName: 'Ashrafur Rahman Chowdhury',
      school: 'School of Science, Engineering & Technology',
      institution: 'East Delta University',
    })
    expect(Object.keys(match.fields)).not.toContain('title')
    expect(resolveFaculty(parse, 'A')).toBeNull() // ambiguous prefix
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
    expect(resolveFaculty({ facultyDirectory: entries }, 'jd')?.fields).toEqual({ fullName: 'Jane Doe' })
  })
})
