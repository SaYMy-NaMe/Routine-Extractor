/**
 * PDF exporter — an executive, single-page-first landscape document drawn as
 * vector text with jsPDF (searchable, small). Layout rules:
 *   - dark high-contrast header row with time badges;
 *   - subtle grid lines, zebra rows, generous cell padding;
 *   - a lab that runs through the break renders as one merged block;
 *   - explicit page-break management: rows never split, the workload table
 *     moves to a new page when it does not fit, and every page gets a footer.
 * jsPDF is imported lazily.
 */

import type { jsPDF } from 'jspdf'
import {
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
  type RowCell,
  breakWaived,
  emptyDayView,
  isEveningOff,
  rowLayout,
  slotsAt,
  visibleDays,
} from '../../application'
import {
  EVENING_LEGEND,
  OFF_CELL_TEXT,
  PALETTE as C,
  type RGB,
  WORKLOAD_HEADERS,
  badgeTextFor,
  contactLine,
  headerLines,
  hexToRgb,
  routineTitle,
} from './template'

/* ---- page & typography tokens ------------------------------------------ */
const MARGIN = 12
const FOOTER_H = 10
const DAY_W = 24
const BREAK_WEIGHT = 0.62
const HEAD_H = 11
/** Preferred / minimum chip heights; rows shrink towards the minimum to keep one page. */
const CHIP_H_MAX = 12.5
const CHIP_H_MIN = 6.5
const ROW_PAD = 2.5
const WL_ROW_H = 5.2

const DARK: RGB = [31, 41, 55] // slate-800
const DARK_TEXT: RGB = [243, 244, 246]
const ZEBRA: RGB = [250, 250, 252]
const GRID: RGB = [226, 232, 240] // slate-200
const ACCENT: RGB = [59, 110, 245] // theory-500

const text = (doc: jsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2])
const fill = (doc: jsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2])
const stroke = (doc: jsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2])
const font = (doc: jsPDF, style: 'normal' | 'bold' | 'italic' | 'bolditalic', size: number) =>
  doc.setFont('helvetica', style).setFontSize(size)

interface Geometry {
  readonly W: number
  readonly H: number
  readonly widthOf: (c: TimeSlot) => number
  readonly colX: readonly number[]
}

function geometry(doc: jsPDF, columns: readonly TimeSlot[]): Geometry {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const weight = (c: TimeSlot) => (c.isBreak ? BREAK_WEIGHT : 1)
  const unit = (W - 2 * MARGIN - DAY_W) / (columns.reduce((n, c) => n + weight(c), 0) || 1)
  const widthOf = (c: TimeSlot) => unit * weight(c)
  const colX: number[] = []
  columns.reduce((x, c) => {
    colX.push(x)
    return x + widthOf(c)
  }, MARGIN + DAY_W)
  return { W, H, widthOf, colX }
}

/** Title block; returns the y where the table may start. */
function drawTitle(doc: jsPDF, data: ExportData, g: Geometry): number {
  const { profile } = data
  const cx = g.W / 2
  font(doc, 'bold', 17)
  text(doc, C.ink)
  doc.text(routineTitle(profile), cx, 17, { align: 'center' })
  fill(doc, ACCENT)
  doc.roundedRect(cx - 9, 20, 18, 1, 0.5, 0.5, 'F')

  let y = 27
  font(doc, 'bold', 12)
  doc.text(profile.fullName || NOT_AVAILABLE, cx, y, { align: 'center' })
  font(doc, 'normal', 9.5)
  text(doc, C.muted)
  for (const line of headerLines(profile)) {
    y += 4.2
    doc.text(line, cx, y, { align: 'center' })
  }
  const contact = contactLine(profile)
  if (contact) {
    y += 4.8
    font(doc, 'normal', 8.5)
    doc.text(contact, cx, y, { align: 'center' })
  }
  return y + 6
}

/** Dark header row with time badges; returns the y below it. */
function drawHeader(doc: jsPDF, columns: readonly TimeSlot[], g: Geometry, top: number): number {
  fill(doc, DARK)
  doc.roundedRect(MARGIN, top, g.W - 2 * MARGIN, HEAD_H, 1.5, 1.5, 'F')
  doc.rect(MARGIN, top + HEAD_H - 2, g.W - 2 * MARGIN, 2, 'F') // square off the bottom edge
  font(doc, 'bold', 7)
  text(doc, DARK_TEXT)
  doc.text('DAY / TIME', MARGIN + DAY_W / 2, top + HEAD_H / 2 + 1.1, { align: 'center' })

  columns.forEach((c, i) => {
    const x = g.colX[i]
    const w = g.widthOf(c)
    const mid = x + w / 2
    const sub = c.altLabel ?? (c.evening ? 'Evening' : c.isBreak ? '1:00 - 1:30 PM' : undefined)
    // Time badge: a light pill on the dark band.
    const badgeBg: RGB = c.evening ? C.eveningBg : c.isBreak ? C.weekendBg : [55, 65, 81]
    const badgeInk: RGB = c.evening ? C.eveningInk : c.isBreak ? C.weekendInk : DARK_TEXT
    const pillW = w - 3
    const pillH = sub ? 8.6 : 6
    const py = top + (HEAD_H - pillH) / 2
    fill(doc, badgeBg)
    doc.roundedRect(x + 1.5, py, pillW, pillH, pillH / 2, pillH / 2, 'F')
    text(doc, badgeInk)
    font(doc, 'bold', 6.8)
    if (sub) {
      doc.text(c.label, mid, py + 3.4, { align: 'center' })
      font(doc, 'normal', 5.6)
      doc.text(sub, mid, py + 7, { align: 'center' })
    } else {
      doc.text(c.label, mid, py + pillH / 2 + 0.9, { align: 'center' })
    }
  })
  return top + HEAD_H
}

function drawChip(
  doc: jsPDF,
  slot: ScheduleSlot,
  column: TimeSlot,
  x: number,
  y: number,
  w: number,
  h: number,
  merged: boolean,
): void {
  const lab = slot.type === 'lab'
  fill(doc, lab ? C.labBg : C.theoryBg)
  stroke(doc, lab ? [167, 243, 208] : [191, 219, 254])
  doc.setLineWidth(0.25)
  doc.roundedRect(x + 1.6, y, w - 3.2, h, 1.6, 1.6, 'FD')
  const mid = x + w / 2
  text(doc, lab ? C.labInk : C.theoryInk)
  const timing = sessionTiming(slot)
  const timingText = timing ? (merged ? `${timing} · merged with break` : timing) : null
  const room = `Room ${orNA(slot.room)}`
  if (h >= 11 && timingText) {
    // Roomy: three lines — code, room, explicit lab timing.
    font(doc, 'bold', 8.2)
    doc.text(sessionLabel(slot, column), mid, y + h * 0.33, { align: 'center' })
    font(doc, 'normal', 6.6)
    doc.text(room, mid, y + h * 0.6, { align: 'center' })
    font(doc, 'bold', 6.4)
    doc.text(timingText, mid, y + h * 0.86, { align: 'center' })
  } else {
    // Compact: code, then room · timing on one line.
    font(doc, 'bold', 8)
    doc.text(sessionLabel(slot, column), mid, y + h * 0.42, { align: 'center' })
    font(doc, timingText ? 'bold' : 'normal', 6.3)
    doc.text(timingText ? `${orNA(slot.room)} · ${timingText}` : room, mid, y + h * 0.78, { align: 'center' })
  }
}

interface RowDrawContext {
  readonly doc: jsPDF
  readonly data: ExportData
  readonly columns: readonly TimeSlot[]
  readonly g: Geometry
}

function drawCell(
  ctx: RowDrawContext,
  day: ExportData['grid']['days'][number],
  cell: RowCell,
  ry: number,
  h: number,
  zebra: boolean,
): void {
  const { doc, data, g } = ctx
  const { grid } = data
  const x = g.colX[ctx.columns.indexOf(cell.column)]
  const w = cell.columns.reduce((n, c) => n + g.widthOf(c), 0)
  const mid = x + w / 2
  const col = cell.column

  const bg: RGB | null = col.evening
    ? C.eveningBg
    : col.isBreak && !breakWaived(grid, day)
      ? C.weekendBg
      : zebra
        ? ZEBRA
        : null
  stroke(doc, GRID)
  doc.setLineWidth(0.2)
  if (bg) {
    fill(doc, bg)
    doc.rect(x, ry, w, h, 'FD')
  } else {
    doc.rect(x, ry, w, h)
  }

  if (col.isBreak) {
    const waived = breakWaived(grid, day)
    font(doc, waived ? 'normal' : 'bold', 6.6)
    text(doc, waived ? C.muted : C.weekendInk)
    doc.text(waived ? NOT_AVAILABLE : 'BREAK', mid, ry + h / 2 + 1.1, {
      align: 'center',
      charSpace: waived ? 0 : 0.6,
    })
    return
  }
  if (isEveningOff(grid, day, col)) {
    font(doc, 'bold', 7)
    text(doc, C.muted)
    doc.text(OFF_CELL_TEXT, mid, ry + h / 2 + 1.1, { align: 'center', charSpace: 0.6 })
    return
  }
  if (cell.slot) drawChip(doc, cell.slot, col, x, ry + ROW_PAD / 2, w, h - ROW_PAD, cell.span > 1)
}

function drawEmptyDayBadge(
  ctx: RowDrawContext,
  day: ExportData['grid']['days'][number],
  ry: number,
  h: number,
): void {
  const { doc, data, g, columns } = ctx
  const badge = emptyDayView(data.grid, day, data.emptyDay)!
  const style = data.emptyDay.badges[badge.kind]
  const spanned = badge.spansEvening ? columns : columns.filter((c) => !c.evening)
  const spanW = spanned.reduce((n, c) => n + g.widthOf(c), 0)
  const x0 = MARGIN + DAY_W
  stroke(doc, GRID)
  fill(doc, ZEBRA)
  doc.rect(x0, ry, spanW, h, 'FD')
  const label = badgeTextFor(style, 'pdf')
  font(doc, style.bold ? (style.italic ? 'bolditalic' : 'bold') : style.italic ? 'italic' : 'normal', 7.6)
  const charSpace = style.wideTracking ? 0.6 : 0
  const pillW = Math.min(
    spanW - 6,
    Math.max(doc.getTextWidth(label) + charSpace * label.length + 14, spanW * 0.45),
  )
  const pillH = 7.5
  const px = x0 + (spanW - pillW) / 2
  const py = ry + (h - pillH) / 2
  fill(doc, hexToRgb(style.background))
  stroke(doc, hexToRgb(style.borderColor))
  doc.setLineWidth(style.border === 'none' ? 0 : 0.35)
  if (style.border === 'dashed') doc.setLineDashPattern([1, 1], 0)
  const r = style.border === 'accent' ? 1.2 : pillH / 2
  doc.roundedRect(
    px,
    py,
    pillW,
    pillH,
    r,
    r,
    style.border === 'solid' || style.border === 'dashed' ? 'FD' : 'F',
  )
  doc.setLineDashPattern([], 0)
  if (style.border === 'accent') {
    fill(doc, hexToRgb(style.borderColor))
    doc.rect(px, py, 1.6, pillH, 'F')
  }
  text(doc, hexToRgb(style.color))
  doc.text(label, x0 + spanW / 2, py + pillH / 2 + 1, { align: 'center', charSpace })
  if (!badge.spansEvening) {
    columns.forEach((c) => {
      if (c.evening)
        drawCell(
          ctx,
          day,
          { column: c, slot: slotsAt(data.grid, day, c.id)[0], span: 1, columns: [c] },
          ry,
          h,
          false,
        )
    })
  }
}

function drawWorkload(doc: jsPDF, data: ExportData, g: Geometry, top: number): number {
  const { workload } = data
  const tableW = Math.min(g.W - 2 * MARGIN, 210)
  const x0 = (g.W - tableW) / 2
  const widths = [24, 66, 20, 50, 24, 26].map((w) => (w / 210) * tableW)
  let y = top

  font(doc, 'bold', 9.5)
  text(doc, C.ink)
  doc.text('Workload Summary', x0, y)
  fill(doc, ACCENT)
  doc.roundedRect(x0, y + 1.6, 12, 0.8, 0.4, 0.4, 'F')
  y += 4

  const row = (cells: string[], opts: { head?: boolean; total?: boolean; zebra?: boolean } = {}) => {
    if (opts.head) {
      fill(doc, DARK)
      doc.rect(x0, y, tableW, WL_ROW_H, 'F')
    } else if (opts.total) {
      fill(doc, C.theoryBg)
      doc.rect(x0, y, tableW, WL_ROW_H, 'F')
    } else if (opts.zebra) {
      fill(doc, ZEBRA)
      doc.rect(x0, y, tableW, WL_ROW_H, 'F')
    }
    stroke(doc, GRID)
    doc.setLineWidth(0.2)
    doc.rect(x0, y, tableW, WL_ROW_H)
    let cx = x0
    cells.forEach((cellText, i) => {
      if (i) doc.line(cx, y, cx, y + WL_ROW_H)
      font(doc, opts.head || opts.total ? 'bold' : 'normal', 7.4)
      text(doc, opts.head ? DARK_TEXT : C.ink)
      const left = i === 1
      const t = doc.splitTextToSize(cellText, widths[i] - 4)[0] as string
      doc.text(t, left ? cx + 2 : cx + widths[i] / 2, y + WL_ROW_H / 2 + 1.1, {
        align: left ? 'left' : 'center',
      })
      cx += widths[i]
    })
    y += WL_ROW_H
  }

  row([...WORKLOAD_HEADERS], { head: true })
  workload.courses.forEach((c, i) =>
    row(
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
  )
  row(
    [
      'Total Workload',
      '',
      '',
      formatSectionCount(workload.totalSections),
      '',
      `${formatCredits(workload.totalCredits)} Credits`,
    ],
    { total: true },
  )
  return y
}

function drawFooters(doc: jsPDF, data: ExportData, g: Geometry): void {
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    stroke(doc, GRID)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, g.H - MARGIN - 4, g.W - MARGIN, g.H - MARGIN - 4)
    font(doc, 'normal', 6.5)
    text(doc, C.muted)
    doc.text(
      [data.profile.fullName, data.profile.institution].filter(Boolean).join(' · ') || NOT_AVAILABLE,
      MARGIN,
      g.H - MARGIN,
    )
    doc.text(EVENING_LEGEND, g.W / 2, g.H - MARGIN, { align: 'center' })
    doc.text(`Page ${p} of ${pages}`, g.W - MARGIN, g.H - MARGIN, { align: 'right' })
  }
}

/** Draw the routine onto a fresh jsPDF document. Exported for tests. */
export function drawRoutinePdf(doc: jsPDF, data: ExportData): jsPDF {
  const { grid, columns, emptyDay, workload, profile } = data
  const g = geometry(doc, columns)
  const ctx: RowDrawContext = { doc, data, columns, g }
  const days = visibleDays(grid, emptyDay)
  const limit = g.H - MARGIN - FOOTER_H

  let y = drawTitle(doc, data, g)

  // Fit-to-page budget: shrink rows towards the minimum; if even that overflows,
  // the workload moves to its own page (rows themselves never split).
  const workloadH = workload.courses.length ? 11 + WL_ROW_H * (workload.courses.length + 2) : 0
  const rowsAvailable = limit - y - HEAD_H - (workloadH ? workloadH + 6 : 0)
  const rowHMax = CHIP_H_MAX + ROW_PAD
  const rowHMin = CHIP_H_MIN + ROW_PAD
  let rowH = Math.min(rowHMax, rowsAvailable / Math.max(days.length, 1))
  const workloadOnNewPage = rowH < rowHMin
  if (workloadOnNewPage)
    rowH = Math.min(rowHMax, Math.max(rowHMin, (limit - y - HEAD_H) / Math.max(days.length, 1)))
  const badgeRowH = Math.min(rowH, 11)

  y = drawHeader(doc, columns, g, y)
  days.forEach((day, i) => {
    const badge = emptyDayView(grid, day, emptyDay)
    const h = badge ? badgeRowH : rowH
    // Page-break management: a row never splits; repeat the header on a new page.
    if (y + h > limit) {
      doc.addPage()
      y = drawHeader(doc, columns, g, MARGIN + 4)
    }
    const zebra = i % 2 === 1
    stroke(doc, GRID)
    doc.setLineWidth(0.2)
    fill(doc, [241, 245, 249])
    doc.rect(MARGIN, y, DAY_W, h, 'FD')
    font(doc, 'bold', 8.5)
    text(doc, C.ink)
    doc.text(DAY_LABELS[day].slice(0, 3), MARGIN + DAY_W / 2, y + h / 2 + 1.2, { align: 'center' })

    if (badge) drawEmptyDayBadge(ctx, day, y, h)
    else for (const cell of rowLayout(grid, day, columns)) drawCell(ctx, day, cell, y, h, zebra)
    y += h
  })

  if (workload.courses.length) {
    if (workloadOnNewPage || y + workloadH > limit) {
      doc.addPage()
      y = MARGIN + 6
    } else {
      y += 6
    }
    drawWorkload(doc, data, g, y)
  }

  drawFooters(doc, data, g)
  doc.setProperties({
    title: `${routineTitle(profile)} – ${profile.fullName}`,
    author: profile.fullName,
    subject: 'Faculty routine',
  })
  return doc
}

export class PdfExporter implements RoutineExporter {
  readonly format = 'pdf' as const
  readonly label = 'PDF'
  readonly extension = 'pdf'
  readonly mimeType = 'application/pdf'

  async build(data: ExportData): Promise<Blob> {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
    return drawRoutinePdf(doc, data).output('blob')
  }
}
