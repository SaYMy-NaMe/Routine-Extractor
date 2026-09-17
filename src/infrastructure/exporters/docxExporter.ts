/**
 * DOCX exporter — an editable Word document with a structured, executive
 * layout: dark header row with white labels, fixed column widths (a wider
 * break column), padded cells, zebra rows, merged lab-through-break blocks,
 * a styled workload table and a page-numbered footer. The `docx` library is
 * imported lazily so it never weighs on the initial bundle.
 */

import type {
  ITableCellOptions,
  Paragraph as ParagraphT,
  Table as TableT,
  TableCell as TableCellT,
} from 'docx'
import {
  type DayName,
  DAY_LABELS,
  NOT_AVAILABLE,
  type ScheduleSlot,
  type TimeSlot,
  formatCredits,
  formatSectionCount,
  formatSections,
  orNA,
  sessionLabel,
  sessionTiming,
} from '../../domain'
import {
  type ExportData,
  type RoutineExporter,
  breakWaived,
  emptyDayView,
  isEveningOff,
  rowLayout,
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

const FONT = 'Calibri'
const DARK = '1F2937'
const GRID = 'E2E8F0'
const ZEBRA = 'FAFAFC'
const ACCENT = '3B6EF5'
const BREAK_WEIGHT = 0.62

const PAGE_W = 16838 // A4 landscape, DXA
const PAGE_H = 11906
const MARGIN = 680
const DAY_W = 1400

export async function buildDocxBlob(data: ExportData): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    Packer,
    PageNumber,
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
  const tableW = PAGE_W - 2 * MARGIN
  const weight = (c: TimeSlot) => (c.isBreak ? BREAK_WEIGHT : 1)
  const unit = (tableW - DAY_W) / (columns.reduce((n, c) => n + weight(c), 0) || 1)
  const widthOf = (c: TimeSlot) => Math.floor(unit * weight(c))
  const spanWidth = (cols: readonly TimeSlot[]) => cols.reduce((n, c) => n + widthOf(c), 0)

  const border = { style: BorderStyle.SINGLE, size: 4, color: GRID }
  const borders = { top: border, bottom: border, left: border, right: border }

  const run = (
    text: string,
    o: { bold?: boolean; italics?: boolean; size?: number; color?: string; spacing?: number } = {},
  ) =>
    new TextRun({
      text,
      bold: o.bold,
      italics: o.italics,
      size: o.size ?? 18,
      color: o.color,
      characterSpacing: o.spacing,
      font: FONT,
    })
  const para = (
    text: string,
    o: {
      bold?: boolean
      italics?: boolean
      size?: number
      color?: string
      spacing?: number
      after?: number
      align?: 'center' | 'left'
    } = {},
  ) =>
    new Paragraph({
      alignment: o.align === 'left' ? AlignmentType.LEFT : AlignmentType.CENTER,
      spacing: { after: o.after ?? 30 },
      children: [run(text, o)],
    })
  const cell = (
    children: ParagraphT[],
    o: { width: number; fill?: string; span?: number; pad?: number; borders?: ITableCellOptions['borders'] },
  ): TableCellT =>
    new TableCell({
      children,
      borders: o.borders ?? borders,
      width: { size: o.width, type: WidthType.DXA },
      columnSpan: o.span,
      verticalAlign: VerticalAlign.CENTER,
      shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
      margins: { top: o.pad ?? 80, bottom: o.pad ?? 80, left: 90, right: 90 },
    })

  /* ---- header row ------------------------------------------------------- */
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell([para('DAY / TIME', { bold: true, size: 15, color: 'F3F4F6', spacing: 20 })], {
        width: DAY_W,
        fill: DARK,
      }),
      ...columns.map((c) => {
        const tint = c.evening ? HEX.eveningInk : c.isBreak ? HEX.weekendInk : 'F3F4F6'
        const sub = c.altLabel ?? (c.evening ? 'Evening' : c.isBreak ? '1:00 - 1:30 PM' : undefined)
        return cell(
          [
            para(c.label, { bold: true, size: 16, color: tint }),
            ...(sub ? [para(sub, { size: 13, color: c.evening || c.isBreak ? tint : 'CBD5E1' })] : []),
          ],
          { width: widthOf(c), fill: c.evening ? HEX.eveningBg : c.isBreak ? HEX.weekendBg : DARK },
        )
      }),
    ],
  })

  /* ---- body cells --------------------------------------------------------- */
  const sessionParas = (s: ScheduleSlot, c: TimeSlot, merged: boolean): ParagraphT[] => {
    const lab = s.type === 'lab'
    const ink = lab ? HEX.labInk : HEX.theoryInk
    const timing = sessionTiming(s)
    return [
      para(sessionLabel(s, c), { bold: true, size: 18, color: ink }),
      para(`Room ${orNA(s.room)}`, { size: 14, color: ink }),
      ...(timing
        ? [para(merged ? `${timing} · merged with break` : timing, { bold: true, size: 13, color: ink })]
        : []),
    ]
  }

  const bodyCell = (
    day: DayName,
    c: TimeSlot,
    slot: ScheduleSlot | undefined,
    span: number,
    cols: readonly TimeSlot[],
    zebra: boolean,
  ): TableCellT => {
    if (c.isBreak) {
      const waived = breakWaived(grid, day)
      return cell(
        [
          para(waived ? NOT_AVAILABLE : 'BREAK', {
            bold: !waived,
            size: 13,
            color: waived ? '9CA3AF' : HEX.weekendInk,
            spacing: waived ? 0 : 30,
          }),
        ],
        {
          width: widthOf(c),
          fill: waived ? undefined : HEX.weekendBg,
        },
      )
    }
    if (isEveningOff(grid, day, c)) {
      return cell([para(OFF_CELL_TEXT, { bold: true, size: 14, color: '9CA3AF', spacing: 30 })], {
        width: widthOf(c),
        fill: HEX.eveningBg,
      })
    }
    const fillColor = slot
      ? slot.type === 'lab'
        ? HEX.labBg
        : HEX.theoryBg
      : c.evening
        ? HEX.eveningBg
        : zebra
          ? ZEBRA
          : undefined
    return cell(slot ? sessionParas(slot, c, span > 1) : [new Paragraph('')], {
      width: spanWidth(cols),
      fill: fillColor,
      span: span > 1 ? span : undefined,
    })
  }

  const dayCols = columns.filter((c) => !c.evening)
  const eveningCols = columns.filter((c) => c.evening)

  const bodyRows = visibleDays(grid, emptyDay).map((day, i) => {
    const zebra = i % 2 === 1
    const badge = emptyDayView(grid, day, emptyDay)
    const dayCell = cell([para(DAY_LABELS[day].slice(0, 3), { bold: true, size: 18 })], {
      width: DAY_W,
      fill: 'F1F5F9',
    })
    if (badge) {
      const style = emptyDay.badges[badge.kind]
      const spanned = badge.spansEvening ? columns : dayCols
      const edge =
        style.border === 'solid' || style.border === 'dashed'
          ? {
              style: style.border === 'dashed' ? BorderStyle.DASHED : BorderStyle.SINGLE,
              size: 8,
              color: hexDigits(style.borderColor),
            }
          : undefined
      const accent = { style: BorderStyle.SINGLE, size: 24, color: hexDigits(style.borderColor) }
      const badgeCell = cell(
        [
          para(badgeTextFor(style, 'docx'), {
            bold: style.bold,
            italics: style.italic,
            size: 16,
            color: hexDigits(style.color),
            spacing: style.wideTracking ? 40 : 0,
          }),
        ],
        {
          width: spanWidth(spanned),
          span: spanned.length,
          fill: hexDigits(style.background),
          borders: {
            ...borders,
            ...(edge ? { top: edge, bottom: edge, left: edge, right: edge } : {}),
            ...(style.border === 'accent' ? { left: accent } : {}),
          },
        },
      )
      return new TableRow({
        children: [
          dayCell,
          badgeCell,
          ...(badge.spansEvening
            ? []
            : eveningCols.map((c) => bodyCell(day, c, slotsAt(grid, day, c.id)[0], 1, [c], zebra))),
        ],
      })
    }
    return new TableRow({
      children: [
        dayCell,
        ...rowLayout(grid, day, columns).map((rc) =>
          bodyCell(day, rc.column, rc.slot, rc.span, rc.columns, zebra),
        ),
      ],
    })
  })

  /* ---- document ----------------------------------------------------------- */
  const children: (ParagraphT | TableT)[] = [
    para(routineTitle(profile), { bold: true, size: 34, after: 40 }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 1 } },
      children: [run(' ', { size: 4 })],
    }),
    para(profile.fullName || NOT_AVAILABLE, { bold: true, size: 26, after: 40 }),
    ...headerLines(profile).map((l) => para(l, { size: 19, color: '4B5563' })),
  ]
  const contact = contactLine(profile)
  if (contact) children.push(para(contact, { size: 18, color: '4B5563' }))
  children.push(new Paragraph({ spacing: { after: 220 } }))
  children.push(
    new Table({
      width: { size: tableW, type: WidthType.DXA },
      columnWidths: [DAY_W, ...columns.map(widthOf)],
      rows: [headerRow, ...bodyRows],
    }),
  )

  if (workload.courses.length) {
    children.push(new Paragraph({ spacing: { after: 240 } }))
    children.push(para('Workload Summary', { bold: true, size: 22, after: 40, align: 'left' }))
    const wlWidths = [1700, 5200, 1300, 3900, 1600, 1740]
    const wlRow = (cells: string[], o: { head?: boolean; total?: boolean; zebra?: boolean } = {}) =>
      new TableRow({
        tableHeader: o.head,
        children: cells.map((t, i) =>
          cell(
            [
              para(t, {
                bold: o.head || o.total,
                size: 17,
                color: o.head ? 'F3F4F6' : undefined,
                align: i === 1 ? 'left' : 'center',
              }),
            ],
            {
              width: wlWidths[i],
              fill: o.head ? DARK : o.total ? HEX.theoryBg : o.zebra ? ZEBRA : undefined,
              pad: 60,
            },
          ),
        ),
      })
    children.push(
      new Table({
        width: { size: wlWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
        columnWidths: wlWidths,
        rows: [
          wlRow([...WORKLOAD_HEADERS], { head: true }),
          ...workload.courses.map((c, i) =>
            wlRow(
              [
                c.courseCode,
                orNA(c.title),
                c.type === 'lab' ? 'Lab' : 'Theory',
                formatSections(c),
                formatCredits(c.creditsPerSection),
                formatCredits(c.totalCredits),
              ],
              { zebra: i % 2 === 1 },
            ),
          ),
          wlRow(
            [
              'Total Workload',
              '',
              '',
              formatSectionCount(workload.totalSections),
              '',
              `${formatCredits(workload.totalCredits)} Credits`,
            ],
            { total: true },
          ),
        ],
      }),
    )
  }

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: GRID, space: 4 } },
        children: [
          run(
            `${[profile.fullName, profile.institution].filter(Boolean).join(' · ') || NOT_AVAILABLE}   ·   ${EVENING_LEGEND}   ·   Page `,
            { size: 14, color: '6B7280' },
          ),
          new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '6B7280', font: FONT }),
          run(' of ', { size: 14, color: '6B7280' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: '6B7280', font: FONT }),
        ],
      }),
    ],
  })

  const doc = new Document({
    creator: profile.fullName || 'Faculty Routine Extractor',
    title: `${routineTitle(profile)} – ${profile.fullName}`,
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE, width: PAGE_W, height: PAGE_H },
            margin: { top: MARGIN, bottom: MARGIN + 200, left: MARGIN, right: MARGIN },
          },
        },
        footers: { default: footer },
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
