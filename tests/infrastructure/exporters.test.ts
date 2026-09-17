import { describe, expect, it } from 'vitest'
import { jsPDF } from 'jspdf'
import { buildRoutineGrid, computeWorkload, usedTimeSlots, type ExportData } from '../../src/application'
import { DEFAULT_EMPTY_DAY_SETTINGS, EMPTY_PROFILE, EVENING_RANGE } from '../../src/domain'
import { DocxExporter, HEX, PdfExporter, drawRoutinePdf } from '../../src/infrastructure'
import { makeCell } from '../helpers/fixtures'

const grid = {
  ...buildRoutineGrid([
    makeCell('Sat', 690, 780, 'CSE 411', '6', 'N204'),
    makeCell('Sat', 930, 1050, 'CSE 112', '7', 'N607', 'lab'),
    makeCell('Thu', 690, 780, 'CSE 443', '2', 'N601'),
    makeCell('Tue', EVENING_RANGE.startMin, EVENING_RANGE.endMin, 'CSE 411', '', 'N202'),
    makeCell('Wed', EVENING_RANGE.startMin, EVENING_RANGE.endMin, 'CSE 226', '', 'N607', 'lab'),
  ]),
  eveningOff: ['Sun' as const],
}

const data: ExportData = {
  profile: {
    ...EMPTY_PROFILE,
    fullName: 'Ashrafur Rahman Chowdhury',
    email: 'a@b.co',
    phone: '+880 1',
    semester: 'Summer 2026',
  },
  grid,
  columns: usedTimeSlots(grid),
  workload: computeWorkload(grid.slots),
  emptyDay: DEFAULT_EMPTY_DAY_SETTINGS,
}

describe('exporters', () => {
  it('derives DOCX hex shades from the shared palette', () => {
    expect(HEX.theoryBg).toBe('E8F0FF')
    expect(HEX.eveningInk).toBe('4C1D95')
  })

  it('draws a single-page landscape PDF', () => {
    const doc = drawRoutinePdf(new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }), data)
    expect(doc.getNumberOfPages()).toBe(1)
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight())
  })

  it('PdfExporter and DocxExporter produce blobs', async () => {
    expect((await new PdfExporter().build(data)).size).toBeGreaterThan(1000)
    expect((await new DocxExporter().build(data)).size).toBeGreaterThan(1000)
  })

  it('renders the evening column, frequency tags, OFF cell and workload table into the DOCX', async () => {
    // The OFF marker only shows when the evening cell is excluded from the empty-day span.
    const blob = await new DocxExporter().build({
      ...data,
      emptyDay: { ...DEFAULT_EMPTY_DAY_SETTINGS, spanEvening: false },
    })
    const { unzipSync } = await import('fflate')
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    const text = [
      ...new TextDecoder().decode(files['word/document.xml']).matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g),
    ]
      .map((m) => m[1])
      .join(' | ')
    for (const needle of [
      '6:30 PM - 9:30 PM',
      'CSE 411 [Weekly]',
      'CSE 226 LAB [Alt. Week]',
      'OFF',
      'Workload Summary',
      'Total Workload',
      '12 Credits',
    ]) {
      expect(text).toContain(needle)
    }
  })

  it('prints the customised empty-day badge text and honours hidden/collapsed modes', async () => {
    const custom = {
      ...data,
      emptyDay: {
        ...DEFAULT_EMPTY_DAY_SETTINGS,
        badges: {
          ...DEFAULT_EMPTY_DAY_SETTINGS.badges,
          'no-class': {
            ...DEFAULT_EMPTY_DAY_SETTINGS.badges['no-class'],
            text: 'Free day',
            uppercase: false,
            showIcon: true,
            icon: '☕',
          },
        },
      },
    }
    const read = async (d: ExportData) => {
      const blob = await new DocxExporter().build(d)
      const { unzipSync } = await import('fflate')
      const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
      return [...new TextDecoder().decode(files['word/document.xml']).matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map((m) => m[1])
        .join(' | ')
    }
    expect(await read(data)).toContain('NO CLASS ON THIS DAY')
    expect(await read(custom)).toContain('☕ Free day')
    const hidden = await read({ ...data, emptyDay: { ...DEFAULT_EMPTY_DAY_SETTINGS, mode: 'hidden' } })
    expect(hidden).not.toContain('NO CLASS ON THIS DAY')
    expect(hidden).not.toContain('| Mon |')
    const collapsed = drawRoutinePdf(new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }), {
      ...custom,
      emptyDay: { ...custom.emptyDay, mode: 'collapsed' },
    })
    expect(collapsed.getNumberOfPages()).toBe(1)
    const { badgeTextFor } = await import('../../src/infrastructure')
    expect(badgeTextFor(custom.emptyDay.badges['no-class'], 'pdf')).toBe('Free day')
    expect(badgeTextFor({ ...custom.emptyDay.badges['no-class'], text: '☺ ✨' }, 'pdf')).toBe('No Class')
  })

  it('merges a lab through the break in the DOCX and uses Section / N/A conventions', async () => {
    const merged = buildRoutineGrid([makeCell('Sat', 690, 810, 'CSE 224', '3', '', 'lab')])
    const d: ExportData = {
      ...data,
      grid: merged,
      columns: usedTimeSlots(merged),
      workload: computeWorkload(merged.slots),
    }
    const blob = await new DocxExporter().build(d)
    const { unzipSync } = await import('fflate')
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    const xml = new TextDecoder().decode(files['word/document.xml'])
    const text = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(' | ')
    expect(xml).toContain('<w:gridSpan w:val="2"/>')
    expect(text).toContain('11:30 AM - 1:30 PM · merged with break')
    expect(text).toContain('Room N/A')
    expect(text).toContain('1 (Section 3)')
    expect(text).toContain('1 Section')
    expect(text).not.toMatch(/\bsec\b|n\/a/)
    expect(files['word/footer1.xml']).toBeDefined()
  })

  it('keeps the PDF single-page for a full week and paginates the workload only when it must', () => {
    const week = buildRoutineGrid(
      (['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const).flatMap((day) => [
        makeCell(day, 600, 690, 'CSE 111', '1', '101'),
        makeCell(day, 930, 1050, 'CSE 112', '1', '102', 'lab'),
      ]),
    )
    const d: ExportData = {
      ...data,
      grid: week,
      columns: usedTimeSlots(week),
      workload: computeWorkload(week.slots),
    }
    expect(
      drawRoutinePdf(new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }), d).getNumberOfPages(),
    ).toBe(1)
    const many = {
      ...d,
      workload: {
        ...d.workload,
        courses: Array.from({ length: 14 }, (_, i) => ({
          ...d.workload.courses[0],
          courseCode: `CSE ${100 + i}`,
        })),
      },
    }
    const doc = drawRoutinePdf(new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }), many)
    expect(doc.getNumberOfPages()).toBe(2)
  })
})
