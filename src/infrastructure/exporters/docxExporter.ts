/**
 * DOCX exporter: an editable Word table built with the `docx` library,
 * imported lazily so it never weighs on the initial bundle.
 */

import type { Paragraph as ParagraphT, Table as TableT } from 'docx'
import {
  type DayName,
  DAY_LABELS,
  type TimeSlot,
  formatCredits,
  formatSections,
  sessionLabel,
  sessionTiming,
} from '../../domain'
import {
  type ExportData,
  type RoutineExporter,
  breakWaived,
  emptyDayView,
  isEveningOff,
  slotsAt,
  visibleDays,
} from '../../application'
import {
  EVENING_LEGEND,
  HEX,
  OFF_CELL_TEXT,
  WORKLOAD_HEADERS,
  badgeTextFor,
  contactLine,
  headerLines,
  hexDigits,
  routineTitle,
} from './template'

export async function buildDocxBlob(data: ExportData): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Packer,
    PageOrientation,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
  } = await import('docx')
  const { profile, grid, columns, workload, emptyDay } = data
  const border = { style: BorderStyle.SINGLE, size: 4, color: '9CA3AF' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const pageW = 16838 // A4 landscape width in DXA
  const margin = 720
  const tableW = pageW - 2 * margin
  const dayW = 1300
  const BREAK_WEIGHT = 0.45
  const totalWeight = columns.reduce((n, c) => n + (c.isBreak ? BREAK_WEIGHT : 1), 0) || 1
  const unit = (tableW - dayW) / totalWeight
  const widthOf = (c: TimeSlot) => Math.floor(unit * (c.isBreak ? BREAK_WEIGHT : 1))

  const centered = (text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({ text, bold: opts.bold, size: opts.size ?? 20, color: opts.color, font: 'Arial' }),
      ],
    })

  const cell = (children: ParagraphT[], opts: { width: number; fill?: string; span?: number }) =>
    new TableCell({
      children,
      borders,
      width: { size: opts.width, type: WidthType.DXA },
      columnSpan: opts.span,
      verticalAlign: VerticalAlign.CENTER,
      shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
    })

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell([centered('DAY / TIME', { bold: true, size: 15 })], { width: dayW, fill: HEX.headBg }),
      ...columns.map((c) =>
        cell(
          [
            centered(c.label, {
              bold: true,
              size: 16,
              color: c.evening ? HEX.eveningInk : c.isBreak ? HEX.weekendInk : undefined,
            }),
            ...(c.altLabel ? [centered(c.altLabel, { size: 14, color: '4B5563' })] : []),
            ...(c.evening ? [centered('Evening', { size: 14, color: '4B5563' })] : []),
            ...(c.isBreak ? [centered('1:00 - 1:30 PM', { size: 13, color: '4B5563' })] : []),
          ],
          { width: widthOf(c), fill: c.evening ? HEX.eveningBg : c.isBreak ? HEX.weekendBg : HEX.headBg },
        ),
      ),
    ],
  })

  const dayCols = columns.filter((c) => !c.evening)
  const eveningCols = columns.filter((c) => c.evening)

  const sessionCell = (day: DayName, c: TimeSlot) => {
    if (c.isBreak) {
      const waived = breakWaived(grid, day)
      return cell(
        [
          centered(waived ? '—' : 'BREAK', {
            bold: !waived,
            size: 13,
            color: waived ? '9CA3AF' : HEX.weekendInk,
          }),
        ],
        {
          width: widthOf(c),
          fill: waived ? undefined : HEX.weekendBg,
        },
      )
    }
    if (isEveningOff(grid, day, c)) {
      return cell([centered(OFF_CELL_TEXT, { bold: true, size: 14, color: '9CA3AF' })], {
        width: widthOf(c),
        fill: HEX.eveningBg,
      })
    }
    const sessions = slotsAt(grid, day, c.id)
    const paras = sessions.flatMap((s) => {
      const lab = s.type === 'lab'
      return [
        centered(sessionLabel(s, c), { bold: true, size: 18, color: lab ? HEX.labInk : HEX.theoryInk }),
        ...(s.room ? [centered(s.room, { size: 15, color: lab ? HEX.labInk : HEX.theoryInk })] : []),
        // Labs always print their explicit timing.
        ...(sessionTiming(s)
          ? [centered(sessionTiming(s)!, { bold: true, size: 14, color: HEX.labInk })]
          : []),
      ]
    })
    const only = sessions.length === 1 ? sessions[0] : null
    return cell(paras.length ? paras : [new Paragraph('')], {
      width: widthOf(c),
      fill: only ? (only.type === 'lab' ? HEX.labBg : HEX.theoryBg) : c.evening ? HEX.eveningBg : undefined,
    })
  }

  const bodyRows = visibleDays(grid, emptyDay).map((day) => {
    const badge = emptyDayView(grid, day, emptyDay)
    const dayCell = cell(
      [centered(DAY_LABELS[day].slice(0, 3), { bold: true, size: badge?.collapsed ? 14 : 18 })],
      {
        width: dayW,
        fill: HEX.headBg,
      },
    )
    if (badge) {
      const style = emptyDay.badges[badge.kind]
      const span = badge.spansEvening ? columns.length : dayCols.length
      const accent = { style: BorderStyle.SINGLE, size: 24, color: hexDigits(style.borderColor) }
      const edge =
        style.border === 'solid' || style.border === 'dashed'
          ? {
              style: style.border === 'dashed' ? BorderStyle.DASHED : BorderStyle.SINGLE,
              size: 8,
              color: hexDigits(style.borderColor),
            }
          : undefined
      const badgeCell = new TableCell({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: badge.collapsed ? 0 : 40, after: badge.collapsed ? 0 : 40 },
            children: [
              new TextRun({
                text: badgeTextFor(style, 'docx'),
                bold: style.bold,
                italics: style.italic,
                characterSpacing: style.wideTracking ? 40 : 0,
                size: badge.collapsed ? 13 : 16,
                color: hexDigits(style.color),
                font: 'Arial',
              }),
            ],
          }),
        ],
        borders: {
          ...borders,
          ...(edge ? { top: edge, bottom: edge, left: edge, right: edge } : {}),
          ...(style.border === 'accent' ? { left: accent } : {}),
        },
        width: {
          size: (badge.spansEvening ? columns : dayCols).reduce((n, col) => n + widthOf(col), 0),
          type: WidthType.DXA,
        },
        columnSpan: span,
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: hexDigits(style.background), type: ShadingType.CLEAR, color: 'auto' },
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
      })
      return new TableRow({
        children: [
          dayCell,
          badgeCell,
          ...(badge.spansEvening ? [] : eveningCols.map((c) => sessionCell(day, c))),
        ],
      })
    }
    return new TableRow({
      children: [
        dayCell,
        ...dayCols.map((c) => sessionCell(day, c)),
        ...eveningCols.map((c) => sessionCell(day, c)),
      ],
    })
  })

  const children: (ParagraphT | TableT)[] = [
    centered(routineTitle(profile), { bold: true, size: 30 }),
    new Paragraph({ spacing: { after: 120 } }),
    centered(profile.fullName || 'Faculty Name', { bold: true, size: 24 }),
    ...headerLines(profile).map((l) => centered(l, { size: 19, color: '4B5563' })),
  ]
  const contact = contactLine(profile)
  if (contact) children.push(centered(contact, { size: 18, color: '4B5563' }))
  children.push(new Paragraph({ spacing: { after: 200 } }))
  children.push(
    new Table({
      width: { size: tableW, type: WidthType.DXA },
      columnWidths: [dayW, ...columns.map(widthOf)],
      rows: [headerRow, ...bodyRows],
    }),
  )
  if (workload.courses.length) {
    children.push(new Paragraph({ spacing: { after: 200 } }))
    children.push(centered('Workload Summary', { bold: true, size: 22 }))
    children.push(new Paragraph({ spacing: { after: 60 } }))
    const wlWidths = [1600, 5200, 1200, 3800, 1600, 1600]
    const wlRow = (cells: string[], opts: { bold?: boolean; fill?: string } = {}) =>
      new TableRow({
        children: cells.map((t, i) =>
          cell([centered(t, { bold: opts.bold, size: 17 })], { width: wlWidths[i], fill: opts.fill }),
        ),
      })
    children.push(
      new Table({
        width: { size: wlWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
        columnWidths: wlWidths,
        alignment: AlignmentType.CENTER,
        rows: [
          wlRow([...WORKLOAD_HEADERS], {
            bold: true,
            fill: HEX.headBg,
          }),
          ...workload.courses.map((c) =>
            wlRow([
              c.courseCode,
              c.title || '—',
              c.type === 'lab' ? 'Lab' : 'Theory',
              formatSections(c),
              formatCredits(c.creditsPerSection),
              formatCredits(c.totalCredits),
            ]),
          ),
          wlRow(
            [
              'Total Workload',
              '',
              '',
              `${workload.totalSections} sections`,
              '',
              `${formatCredits(workload.totalCredits)} Credits`,
            ],
            {
              bold: true,
              fill: HEX.headBg,
            },
          ),
        ],
      }),
    )
    children.push(new Paragraph({ spacing: { after: 80 } }))
    children.push(
      centered(EVENING_LEGEND, {
        size: 15,
        color: '4B5563',
      }),
    )
  }

  const doc = new Document({
    creator: profile.fullName || 'Faculty Routine Extractor',
    title: `${routineTitle(profile)} – ${profile.fullName}`,
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE, width: pageW, height: 11906 },
            margin: { top: margin, bottom: margin, left: margin, right: margin },
          },
        },
        children,
      },
    ],
  })
  return Packer.toBlob(doc)
}

export class DocxExporter implements RoutineExporter {
  readonly format = 'docx' as const
  readonly label = 'Word (DOCX)'
  readonly extension = 'docx'
  readonly mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  build(data: ExportData): Promise<Blob> {
    return buildDocxBlob(data)
  }
}
