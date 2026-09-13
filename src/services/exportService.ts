/**
 * Export engines: PDF (jsPDF, vector — text stays selectable) and DOCX (docx).
 * Both consume the same `ExportData` so the printed routine and the Word table
 * always agree.
 */

import { jsPDF } from 'jspdf'
import {
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
} from 'docx'
import { saveAs } from 'file-saver'
import type {
  DayName,
  FacultyProfile,
  RoutineGrid,
  ScheduleSlot,
  TimeSlot,
  WorkloadSummary,
} from '../types/routine'
import { DAY_LABELS, fullCourseCode } from '../types/routine'
import { slotsAt } from './routineBuilder'
import { describeCourseLine, formatCredits } from './workloadCalculator'

export interface ExportData {
  profile: FacultyProfile
  grid: RoutineGrid
  /** Columns to print (already filtered for empty ones). */
  columns: TimeSlot[]
  workload: WorkloadSummary
}

type RGB = readonly [number, number, number]

const COLORS = {
  ink: [17, 24, 39],
  muted: [75, 85, 99],
  line: [156, 163, 175],
  headBg: [249, 250, 251],
  theoryBg: [232, 240, 255],
  theoryInk: [30, 58, 138],
  labBg: [230, 249, 240],
  labInk: [6, 95, 70],
  offBg: [243, 244, 246],
  weekendBg: [255, 247, 230],
  weekendInk: [146, 64, 14],
} as const satisfies Record<string, RGB>

const HEX = {
  theoryBg: 'E8F0FF',
  theoryInk: '1E3A8A',
  labBg: 'E6F9F0',
  labInk: '065F46',
  offBg: 'F3F4F6',
  weekendBg: 'FFF7E6',
  headBg: 'F9FAFB',
}

const text = (doc: jsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2])
const fillColor = (doc: jsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2])
const drawColor = (doc: jsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2])

/* ------------------------------------------------------------------------- */
/* Shared text helpers                                                        */
/* ------------------------------------------------------------------------- */

export function routineTitle(p: FacultyProfile): string {
  return `${p.semester || 'Semester'} Routine`
}

function headerLines(p: FacultyProfile): string[] {
  return [[p.title, p.department].filter(Boolean).join(', '), p.school, p.institution].filter(Boolean)
}

function contactLine(p: FacultyProfile): string {
  return [p.email && `Email: ${p.email}`, p.phone && `Contact: ${p.phone}`].filter(Boolean).join(' | ')
}

function chipLabel(s: ScheduleSlot): string {
  return `${fullCourseCode(s)}${s.type === 'lab' ? ' LAB' : ''}`
}

function offDayText(status: RoutineGrid['offDays'][DayName]): string {
  return status === 'weekend' ? 'WEEKEND' : 'NO CLASS ON THIS DAY'
}

export function baseFileName(p: FacultyProfile): string {
  const slug = (s: string) =>
    s
      .trim()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
  return [slug(p.fullName || 'faculty'), slug(p.semester || 'routine'), 'routine'].filter(Boolean).join('-')
}

/* ------------------------------------------------------------------------- */
/* PDF                                                                        */
/* ------------------------------------------------------------------------- */

/** Single-page A4 landscape PDF, drawn as vector text so it is searchable. */
export function buildPdf(data: ExportData): jsPDF {
  const { profile, grid, columns, workload } = data
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
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
  const colW = (W - 2 * M - dayW) / Math.max(columns.length, 1)
  const hasAlt = columns.some((c) => c.altLabel)
  const headH = hasAlt ? 12 : 9

  const rowChipCount = grid.days.map((day) =>
    Math.max(1, ...columns.map((c) => slotsAt(grid, day, c.id).length)),
  )
  const workloadH = workload.courses.length ? 8 + workload.courses.length * 4.5 + 8 : 4
  const footerH = 10
  const available = H - M - tableTop - headH - workloadH - footerH
  const chipH = Math.min(
    11,
    Math.max(7, (available - grid.days.length * 3) / rowChipCount.reduce((a, b) => a + b, 0)),
  )
  const rowH = (n: number) => 3 + n * chipH

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
    const x = M + dayW + i * colW
    doc.line(x, tableTop, x, tableTop + headH)
    const mid = x + colW / 2
    if (c.altLabel) {
      doc.text(c.label, mid, tableTop + 5, { align: 'center' })
      doc.setFont('helvetica', 'normal').setFontSize(6.5)
      text(doc, COLORS.muted)
      doc.text(c.altLabel, mid, tableTop + 9, { align: 'center' })
      doc.setFont('helvetica', 'bold').setFontSize(7.5)
      text(doc, COLORS.ink)
    } else {
      doc.text(c.label, mid, tableTop + headH / 2 + 1.2, { align: 'center' })
    }
  })

  // Body rows
  let ry = tableTop + headH
  grid.days.forEach((day, di) => {
    const h = rowH(rowChipCount[di])
    const off = grid.offDays[day]
    const hasAny = grid.slots.some((s) => s.day === day)

    fillColor(doc, COLORS.headBg)
    doc.rect(M, ry, dayW, h, 'FD')
    doc.setFont('helvetica', 'bold').setFontSize(8.5)
    text(doc, COLORS.ink)
    doc.text(DAY_LABELS[day].slice(0, 3), M + dayW / 2, ry + h / 2 + 1.2, { align: 'center' })

    if (!hasAny && off !== 'none') {
      const weekend = off === 'weekend'
      fillColor(doc, weekend ? COLORS.weekendBg : COLORS.offBg)
      doc.rect(M + dayW, ry, W - 2 * M - dayW, h, 'FD')
      doc.setFontSize(8)
      text(doc, weekend ? COLORS.weekendInk : COLORS.muted)
      doc.text(offDayText(off), M + dayW + (W - 2 * M - dayW) / 2, ry + h / 2 + 1.2, {
        align: 'center',
        charSpace: 0.6,
      })
    } else {
      columns.forEach((c, i) => {
        const x = M + dayW + i * colW
        doc.rect(x, ry, colW, h)
        slotsAt(grid, day, c.id).forEach((s, k) => {
          const cy = ry + 1.5 + k * chipH
          const lab = s.type === 'lab'
          fillColor(doc, lab ? COLORS.labBg : COLORS.theoryBg)
          doc.roundedRect(x + 1.2, cy, colW - 2.4, chipH - 0.6, 1, 1, 'F')
          text(doc, lab ? COLORS.labInk : COLORS.theoryInk)
          doc.setFont('helvetica', 'bold').setFontSize(8.5)
          const mid = x + colW / 2
          if (s.room) {
            doc.text(chipLabel(s), mid, cy + chipH * 0.42, { align: 'center' })
            doc.setFont('helvetica', 'normal').setFontSize(7)
            doc.text(s.room, mid, cy + chipH * 0.78, { align: 'center' })
          } else {
            doc.text(chipLabel(s), mid, cy + chipH * 0.6, { align: 'center' })
          }
        })
      })
    }
    ry += h
  })

  /* Workload -------------------------------------------------------------- */
  if (workload.courses.length) {
    let wy = ry + 8
    doc.setFont('helvetica', 'normal').setFontSize(8.5)
    text(doc, COLORS.ink)
    for (const c of workload.courses) {
      doc.text(describeCourseLine(c), cx, wy, { align: 'center' })
      wy += 4.5
    }
    doc.setFont('helvetica', 'bold').setFontSize(10)
    doc.text(`Total Workload: ${formatCredits(workload.totalCredits)} Credits`, cx, wy + 2.5, {
      align: 'center',
    })
  }

  /* Footer ---------------------------------------------------------------- */
  doc.setFont('helvetica', 'normal').setFontSize(6.5)
  text(doc, COLORS.muted)
  doc.setDrawColor(229, 231, 235)
  doc.line(M, H - M - 4, W - M, H - M - 4)
  doc.text([profile.fullName, profile.institution].filter(Boolean).join(' · '), M, H - M)
  doc.text('Generated with Faculty Routine Extractor', W - M, H - M, { align: 'right' })

  doc.setProperties({ title: `${routineTitle(profile)} – ${profile.fullName}`, author: profile.fullName })
  return doc
}

export function exportPdf(data: ExportData): void {
  buildPdf(data).save(`${baseFileName(data.profile)}.pdf`)
}

/* ------------------------------------------------------------------------- */
/* DOCX                                                                       */
/* ------------------------------------------------------------------------- */

export async function buildDocx(data: ExportData): Promise<Blob> {
  const { profile, grid, columns, workload } = data
  const border = { style: BorderStyle.SINGLE, size: 4, color: '9CA3AF' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const pageW = 16838 // A4 landscape width in DXA
  const margin = 720
  const tableW = pageW - 2 * margin
  const dayW = 1300
  const colW = Math.floor((tableW - dayW) / Math.max(columns.length, 1))

  const centered = (text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({ text, bold: opts.bold, size: opts.size ?? 20, color: opts.color, font: 'Arial' }),
      ],
    })

  const cell = (children: Paragraph[], opts: { width: number; fill?: string; span?: number }) =>
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
            centered(c.label, { bold: true, size: 16 }),
            ...(c.altLabel ? [centered(c.altLabel, { size: 14, color: '4B5563' })] : []),
          ],
          { width: colW, fill: HEX.headBg },
        ),
      ),
    ],
  })

  const bodyRows = grid.days.map((day) => {
    const off = grid.offDays[day]
    const hasAny = grid.slots.some((s) => s.day === day)
    const dayCell = cell([centered(DAY_LABELS[day].slice(0, 3), { bold: true, size: 18 })], {
      width: dayW,
      fill: HEX.headBg,
    })
    if (!hasAny && off !== 'none') {
      const weekend = off === 'weekend'
      return new TableRow({
        children: [
          dayCell,
          cell([centered(offDayText(off), { bold: true, size: 16, color: weekend ? '92400E' : '4B5563' })], {
            width: tableW - dayW,
            fill: weekend ? HEX.weekendBg : HEX.offBg,
            span: columns.length,
          }),
        ],
      })
    }
    return new TableRow({
      children: [
        dayCell,
        ...columns.map((c) => {
          const sessions = slotsAt(grid, day, c.id)
          const paras = sessions.flatMap((s) => {
            const lab = s.type === 'lab'
            return [
              centered(chipLabel(s), { bold: true, size: 18, color: lab ? HEX.labInk : HEX.theoryInk }),
              ...(s.room ? [centered(s.room, { size: 15, color: lab ? HEX.labInk : HEX.theoryInk })] : []),
            ]
          })
          const only = sessions.length === 1 ? sessions[0] : null
          return cell(paras.length ? paras : [new Paragraph('')], {
            width: colW,
            fill: only ? (only.type === 'lab' ? HEX.labBg : HEX.theoryBg) : undefined,
          })
        }),
      ],
    })
  })

  const children: (Paragraph | Table)[] = [
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
      columnWidths: [dayW, ...columns.map(() => colW)],
      rows: [headerRow, ...bodyRows],
    }),
  )
  if (workload.courses.length) {
    children.push(new Paragraph({ spacing: { after: 200 } }))
    for (const c of workload.courses) children.push(centered(describeCourseLine(c), { size: 19 }))
    children.push(new Paragraph({ spacing: { after: 80 } }))
    children.push(
      centered(`Total Workload: ${formatCredits(workload.totalCredits)} Credits`, { bold: true, size: 22 }),
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

export async function exportDocx(data: ExportData): Promise<void> {
  saveAs(await buildDocx(data), `${baseFileName(data.profile)}.docx`)
}
