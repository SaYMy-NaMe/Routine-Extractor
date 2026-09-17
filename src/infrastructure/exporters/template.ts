/**
 * Text and colour tokens shared by every export template so the PDF, the
 * DOCX and the on-screen sheet always agree on wording and palette.
 */

import {
  type EmptyDayBadgeStyle,
  type FacultyProfile,
  OFF_DAY_LABELS,
  type OffDayStatus,
  badgeDisplayText,
} from '../../domain'

export type RGB = readonly [number, number, number]

export const PALETTE = {
  ink: [17, 24, 39],
  muted: [75, 85, 99],
  line: [156, 163, 175],
  headBg: [249, 250, 251],
  theoryBg: [232, 240, 255],
  theoryInk: [30, 58, 138],
  labBg: [230, 249, 240],
  labInk: [6, 95, 70],
  offBg: [243, 244, 246],
  eveningBg: [245, 243, 255],
  eveningInk: [76, 29, 149],
  weekendBg: [255, 247, 230],
  weekendInk: [146, 64, 14],
} as const satisfies Record<string, RGB>

export type PaletteKey = keyof typeof PALETTE

/** Same palette as 6-digit hex (for DOCX shading). */
export const HEX: Record<PaletteKey, string> = Object.fromEntries(
  Object.entries(PALETTE).map(([k, rgb]) => [
    k,
    (rgb as RGB)
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase(),
  ]),
) as Record<PaletteKey, string>

export function routineTitle(p: FacultyProfile): string {
  return `${p.semester || 'Semester'} Routine`
}

export function headerLines(p: FacultyProfile): string[] {
  return [[p.title, p.department].filter(Boolean).join(', '), p.school, p.institution].filter(Boolean)
}

export function contactLine(p: FacultyProfile): string {
  return [p.email && `Email: ${p.email}`, p.phone && `Contact: ${p.phone}`].filter(Boolean).join(' | ')
}

export function offDayText(status: OffDayStatus): string {
  return status === 'none' ? '' : OFF_DAY_LABELS[status]
}

export const WORKLOAD_HEADERS = ['Course', 'Title', 'Type', 'Sections', 'Cr / Section', 'Total'] as const
export const EVENING_LEGEND = 'Evening: [Weekly] every week · [Alt. Week] alternating weeks'
export const OFF_CELL_TEXT = 'OFF'

/** "#RRGGBB" → [r, g, b] */
export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const hexDigits = (hex: string): string => hex.replace('#', '').toUpperCase()

/**
 * Badge text for documents. Standard PDF fonts have no emoji glyphs, so the
 * icon is dropped for the PDF and kept for DOCX (Word renders it fine).
 */
export function badgeTextFor(style: EmptyDayBadgeStyle, target: 'pdf' | 'docx'): string {
  const text = badgeDisplayText(style, { icon: target === 'docx' })
  // Helvetica covers WinAnsi only; drop anything else (emoji, symbols) rather than print garbage.
  return target === 'pdf'
    ? text
        .replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, '')
        .replace(/\s+/g, ' ')
        .trim() || 'No Class'
    : text
}
