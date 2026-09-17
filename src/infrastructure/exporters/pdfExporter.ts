/**
 * PDF exporter: a single A4-landscape page drawn as vector text with jsPDF so
 * the output is searchable and small. jsPDF is imported lazily.
 */

import type { jsPDF } from 'jspdf'
import {
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
  OFF_CELL_TEXT,
  PALETTE as COLORS,
  type RGB,
  WORKLOAD_HEADERS,
  badgeTextFor,
  contactLine,
  headerLines,
  hexToRgb,
  routineTitle,
} from './template'

const text = (doc: jsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2])
const fillColor = (doc: jsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2])
const drawColor = (doc: jsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2])

/** Draw the routine onto a fresh jsPDF document. Exported for tests. */
export function drawRoutinePdf(doc: jsPDF, data: ExportData): jsPDF {
  const { profile, grid, columns, workload, emptyDay } = data
  const days = visibleDays(grid, emptyDay)
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 12
  const cx = W / 2

  text(doc, COLORS.ink)
  doc.setFont('helvetica', 'bold').setFontSize(15)
  doc.text(routineTitle(profile), cx, 18, { align: 'center' })

  let y = 28
  doc.setFontSize(12)
  doc.text(profile.fullName || 'Faculty Name', cx, y, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(9.5)
  text(doc, COLORS.muted)
  for (const line of headerLines(profile)) {
    y += 4.5
    doc.text(line, cx, y, { align: 'center' })
  }
  const contact = contactLine(profile)
  if (contact) {
    y += 5.5
    doc.setFontSize(9)
    doc.text(contact, cx, y, { align: 'center' })
  }

  /* Table geometry ------------------------------------------------------- */
  const tableTop = y + 8
  const dayW = 22
  const BREAK_WEIGHT = 0.45
  const totalWeight = columns.reduce((n, c) => n + (c.isBreak ? BREAK_WEIGHT : 1), 0) || 1
  const unit = (W - 2 * M - dayW) / totalWeight
  const widthOf = (c: TimeSlot) => unit * (c.isBreak ? BREAK_WEIGHT : 1)
  const colX: number[] = []
  columns.reduce((x, c) => {
    colX.push(x)
    return x + widthOf(c)
  }, M + dayW)
  const hasAlt = columns.some((c) => c.altLabel || c.evening || c.isBreak)
  const headH = hasAlt ? 12 : 9

  const rowChipCount = days.map((day) => Math.max(1, ...columns.map((c) => slotsAt(grid, day, c.id).length)))
  const wlRowH = 5.5
  const workloadH = workload.courses.length ? 6 + wlRowH * (workload.courses.length + 2) : 4
  const footerH = 10
  const available = H - M - tableTop - headH - workloadH - footerH
  const chipH = Math.min(
    11,
    Math.max(7, (available - days.length * 3) / rowChipCount.reduce((a, b) => a + b, 0)),
  )
  const rowH = (n: number) => 3 + n * chipH
  const COLLAPSED_H = 6

  drawColor(doc, COLORS.line).setLineWidth(0.25)

  // Header row
  fillColor(doc, COLORS.headBg)
  doc.rect(M, tableTop, W - 2 * M, headH, 'FD')
  doc.line(M, tableTop, M + dayW, tableTop + headH) // DAY/TIME diagonal
  doc.setFont('helvetica', 'bold').setFontSize(6.5)
  text(doc, COLORS.ink)
  doc.text('TIME', M + dayW - 1.5, tableTop + 3, { align: 'right' })
  doc.text('DAY', M + 1.5, tableTop + headH - 1.5)
  doc.setFontSize(7.5)
  columns.forEach((c, i) => {
    const x = colX[i]
    const colW = widthOf(c)
    doc.line(x, tableTop, x, tableTop + headH)
    const mid = x + colW / 2
    if (c.evening || c.isBreak) {
      fillColor(doc, c.evening ? COLORS.eveningBg : COLORS.weekendBg)
      doc.rect(x, tableTop, colW, headH, 'FD')
      text(doc, c.evening ? COLORS.eveningInk : COLORS.weekendInk)
    }
    const sub = c.altLabel ?? (c.evening ? 'Evening' : c.isBreak ? '1:00 - 1:30 PM' : undefined)
    if (sub) {
      doc.text(c.label, mid, tableTop + 5, { align: 'center' })
      doc.setFont('helvetica', 'normal').setFontSize(6.5)
      text(doc, COLORS.muted)
      doc.text(sub, mid, tableTop + 9, { align: 'center' })
      doc.setFont('helvetica', 'bold').setFontSize(7.5)
      text(doc, COLORS.ink)
    } else {
      doc.text(c.label, mid, tableTop + headH / 2 + 1.2, { align: 'center' })
    }
  })

  // Body rows
  let ry = tableTop + headH
  days.forEach((day, di) => {
    const badge = emptyDayView(grid, day, emptyDay)
    const h = badge?.collapsed ? COLLAPSED_H : rowH(rowChipCount[di])

    fillColor(doc, COLORS.headBg)
    doc.rect(M, ry, dayW, h, 'FD')
    doc.setFont('helvetica', 'bold').setFontSize(8.5)
    text(doc, COLORS.ink)
    doc.text(DAY_LABELS[day].slice(0, 3), M + dayW / 2, ry + h / 2 + 1.2, { align: 'center' })

    const dayCols = columns.filter((c) => !c.evening)
    const drawCell = (c: TimeSlot, x: number) => {
      const colW = widthOf(c)
      if (c.evening) {
        fillColor(doc, COLORS.eveningBg)
        doc.rect(x, ry, colW, h, 'FD')
      } else if (c.isBreak && !breakWaived(grid, day)) {
        fillColor(doc, COLORS.weekendBg)
        doc.rect(x, ry, colW, h, 'FD')
      } else {
        doc.rect(x, ry, colW, h)
      }
      const mid = x + colW / 2
      if (c.isBreak) {
        const waived = breakWaived(grid, day)
        doc.setFont('helvetica', waived ? 'normal' : 'bold').setFontSize(6.5)
        text(doc, waived ? COLORS.muted : COLORS.weekendInk)
        doc.text(waived ? '—' : 'BREAK', mid, ry + h / 2 + 1.1, {
          align: 'center',
          charSpace: waived ? 0 : 0.5,
        })
        return
      }
      if (isEveningOff(grid, day, c)) {
        doc.setFont('helvetica', 'bold').setFontSize(7.5)
        text(doc, COLORS.muted)
        doc.text(OFF_CELL_TEXT, mid, ry + h / 2 + 1.2, { align: 'center', charSpace: 0.6 })
        return
      }
      slotsAt(grid, day, c.id).forEach((s, k) => {
        const cy = ry + 1.5 + k * chipH
        const lab = s.type === 'lab'
        fillColor(doc, lab ? COLORS.labBg : COLORS.theoryBg)
        doc.roundedRect(x + 1.2, cy, colW - 2.4, chipH - 0.6, 1, 1, 'F')
        text(doc, lab ? COLORS.labInk : COLORS.theoryInk)
        doc.setFont('helvetica', 'bold').setFontSize(8)
        const label = sessionLabel(s, c)
        // Labs always print their explicit timing next to the room.
        const detail = [s.room, sessionTiming(s)].filter(Boolean).join(' · ')
        if (detail) {
          doc.text(label, mid, cy + chipH * 0.42, { align: 'center' })
          doc.setFont('helvetica', lab ? 'bold' : 'normal').setFontSize(lab ? 6.3 : 7)
          doc.text(detail, mid, cy + chipH * 0.78, { align: 'center' })
        } else {
          doc.text(label, mid, cy + chipH * 0.6, { align: 'center' })
        }
      })
    }

    if (badge) {
      const style = emptyDay.badges[badge.kind]
      const spanned = badge.spansEvening ? columns : dayCols
      const spanW = spanned.reduce((n, c) => n + widthOf(c), 0)
      const x0 = M + dayW
      // Cell background, then the pill-shaped badge with the user's styling.
      fillColor(doc, COLORS.headBg)
      doc.rect(x0, ry, spanW, h, 'FD')
      const label = badgeTextFor(style, 'pdf')
      doc.setFont(
        'helvetica',
        style.bold ? (style.italic ? 'bolditalic' : 'bold') : style.italic ? 'italic' : 'normal',
      )
      doc.setFontSize(badge.collapsed ? 6.5 : 8)
      const charSpace = style.wideTracking ? 0.6 : 0
      const textW = doc.getTextWidth(label) + charSpace * label.length + 12
      const pillW = Math.min(spanW - 4, Math.max(textW, spanW * 0.5))
      const pillH = badge.collapsed ? h - 2 : Math.min(h - 3, 9)
      const px = x0 + (spanW - pillW) / 2
      const py = ry + (h - pillH) / 2
      fillColor(doc, hexToRgb(style.background))
      drawColor(doc, hexToRgb(style.borderColor))
      doc.setLineWidth(style.border === 'none' ? 0 : 0.35)
      if (style.border === 'dashed') doc.setLineDashPattern([1, 1], 0)
      doc.roundedRect(
        px,
        py,
        pillW,
        pillH,
        pillH / 2,
        pillH / 2,
        style.border === 'solid' || style.border === 'dashed' ? 'FD' : 'F',
      )
      doc.setLineDashPattern([], 0)
      if (style.border === 'accent') {
        fillColor(doc, hexToRgb(style.borderColor))
        doc.rect(px, py, 1.6, pillH, 'F')
      }
      text(doc, hexToRgb(style.color))
      doc.text(label, x0 + spanW / 2, py + pillH / 2 + 1.1, { align: 'center', charSpace })
      drawColor(doc, COLORS.line).setLineWidth(0.25)
      if (!badge.spansEvening) {
        columns.forEach((c, i) => {
          if (c.evening) drawCell(c, colX[i])
        })
      }
    } else {
      columns.forEach((c, i) => drawCell(c, colX[i]))
    }
    ry += h
  })

  /* Workload summary table ---------------------------------------------- */
  if (workload.courses.length) {
    const tableW = Math.min(W - 2 * M, 200)
    const x0 = cx - tableW / 2
    const widths = [24, 66, 20, 46, 22, 22].map((w) => (w / 200) * tableW)
    const heads = [...WORKLOAD_HEADERS]
    let wy = ry + 6
    const row = (cells: string[], opts: { fill?: RGB; bold?: boolean; leftAlign?: number[] } = {}) => {
      if (opts.fill) {
        fillColor(doc, opts.fill)
        doc.rect(x0, wy, tableW, wlRowH, 'F')
      }
      drawColor(doc, COLORS.line)
      doc.rect(x0, wy, tableW, wlRowH)
      let cxx = x0
      cells.forEach((c, i) => {
        doc.setFont('helvetica', opts.bold ? 'bold' : 'normal').setFontSize(7.5)
        text(doc, COLORS.ink)
        if (i) doc.line(cxx, wy, cxx, wy + wlRowH)
        const left = opts.leftAlign?.includes(i)
        const maxW = widths[i] - 3
        const txt = doc.splitTextToSize(c, maxW)[0] as string
        doc.text(txt, left ? cxx + 1.5 : cxx + widths[i] / 2, wy + wlRowH / 2 + 1.1, {
          align: left ? 'left' : 'center',
        })
        cxx += widths[i]
      })
      wy += wlRowH
    }
    row(heads, { fill: COLORS.headBg, bold: true })
    for (const c of workload.courses) {
      row(
        [
          c.courseCode,
          c.title || '—',
          c.type === 'lab' ? 'Lab' : 'Theory',
          formatSections(c),
          formatCredits(c.creditsPerSection),
          formatCredits(c.totalCredits),
        ],
        { leftAlign: [1] },
      )
    }
    row(
      [
        'Total Workload',
        '',
        '',
        `${workload.totalSections} sections`,
        '',
        `${formatCredits(workload.totalCredits)} Credits`,
      ],
      {
        fill: COLORS.headBg,
        bold: true,
      },
    )
  }

  /* Footer ---------------------------------------------------------------- */
  doc.setFont('helvetica', 'normal').setFontSize(6.5)
  text(doc, COLORS.muted)
  doc.setDrawColor(229, 231, 235)
  doc.line(M, H - M - 4, W - M, H - M - 4)
  doc.text([profile.fullName, profile.institution].filter(Boolean).join(' · '), M, H - M)
  doc.text(EVENING_LEGEND, W - M, H - M, { align: 'right' })

  doc.setProperties({ title: `${routineTitle(profile)} – ${profile.fullName}`, author: profile.fullName })
  return doc
}

export class PdfExporter implements RoutineExporter {
  readonly format = 'pdf' as const
  readonly label = 'PDF'
  readonly extension = 'pdf'
  readonly mimeType = 'application/pdf'

  async build(data: ExportData): Promise<Blob> {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    return drawRoutinePdf(doc, data).output('blob')
  }
}
