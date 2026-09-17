/**
 * Text-layout helpers: turn loose positioned text items into visual lines.
 */

import type { TextItem } from '../../domain'

export interface Line {
  readonly y: number
  readonly items: TextItem[]
}

const LINE_TOLERANCE = 2.5
const FRAGMENT_TOLERANCE = 1.5

/** Group items into visual lines by baseline y (items sorted by x within a line). */
export function toLines(items: readonly TextItem[]): Line[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const lines: Line[] = []
  for (const it of sorted) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - it.y) < LINE_TOLERANCE) {
      last.items.push(it)
    } else {
      lines.push({ y: it.y, items: [it] })
    }
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x)
  return lines
}

/** Join fragments that a PDF engine split mid-word ("Mus" + "K" + "ra"). */
export function mergeFragments(items: readonly TextItem[]): TextItem[] {
  const out: { -readonly [K in keyof TextItem]: TextItem[K] }[] = []
  for (const line of toLines(items)) {
    for (const it of line.items) {
      const prev = out[out.length - 1]
      if (prev && Math.abs(prev.y - it.y) < FRAGMENT_TOLERANCE) {
        const gap = it.x - (prev.x + prev.width)
        const charW = prev.width / Math.max(prev.str.length, 1)
        // Only glue a fragment that starts right where the previous one ends.
        if (gap > -0.75 && gap < Math.max(FRAGMENT_TOLERANCE, charW * 0.45)) {
          prev.str += it.str
          prev.width = it.x + it.width - prev.x
          continue
        }
      }
      out.push({ ...it })
    }
  }
  return out
}

export const lineText = (l: Line): string =>
  l.items
    .map((i) => i.str.trim())
    .join(' ')
    .trim()

export const itemCentre = (i: TextItem): number => i.x + i.width / 2
