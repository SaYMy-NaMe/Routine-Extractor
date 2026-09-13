/**
 * Routine matrix parser.
 *
 * A departmental routine PDF is a sequence of tables, one per day:
 *
 *   Saturday
 *   Theory Classes
 *   [room] | 8.30-10.00 | 10.00-11.30 | ...     ← header row gives column x-centres
 *   103    | EEE 111.5  | MATH 207.5  | ...     ← each cell: course line + faculty line
 *          | TK         | SWAPNIL     |
 *   Lab Classes
 *   [room] | 9.30-11.30 | 11.30-1.30  | ...
 *
 * Tables may continue across pages without repeating their header, but the
 * column x-positions stay fixed within one table, so we keep the last header
 * as the active "column ruler" until a new one appears. Cells are located by
 * snapping each text item to the nearest column centre (x) and the nearest
 * room label (y).
 */

import type { DayName, ParseResult, ParsedCell, ParsedColumn, SessionType } from '../types/routine'
import { DAYS } from '../types/routine'
import type { PageText, TextItem } from './pdfText'
import { isTimeRange, parseTimeRange } from './timeUtils'

/* ------------------------------------------------------------------------- */
/* Text-line assembly                                                         */
/* ------------------------------------------------------------------------- */

interface Line {
  y: number
  items: TextItem[]
}

/** Join fragments that pdfjs split mid-word ("Mus" + "K" + "ra"). */
function mergeFragments(items: TextItem[]): TextItem[] {
  const out: TextItem[] = []
  for (const line of toLines(items)) {
    for (const it of line.items) {
      const prev = out[out.length - 1]
      if (prev && Math.abs(prev.y - it.y) < 1.5) {
        const gap = it.x - (prev.x + prev.width)
        const charW = prev.width / Math.max(prev.str.length, 1)
        // Only glue a fragment that starts right where the previous one ends.
        if (gap > -0.75 && gap < Math.max(1.5, charW * 0.45)) {
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

/** Group items into visual lines by baseline y. */
function toLines(items: TextItem[]): Line[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const lines: Line[] = []
  for (const it of sorted) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - it.y) < 2.5) {
      last.items.push(it)
    } else {
      lines.push({ y: it.y, items: [it] })
    }
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x)
  return lines
}

const lineText = (l: Line) => l.items.map((i) => i.str.trim()).join(' ').trim()

/* ------------------------------------------------------------------------- */
/* Structural detectors                                                       */
/* ------------------------------------------------------------------------- */

const DAY_RE =
  /^(sat(urday)?|sun(day)?|mon(day)?|tue(s|sday)?|wed(nesday)?|thu(rs|rsday)?|fri(day)?)$/i

function detectDay(text: string): DayName | null {
  const t = text.trim().replace(/[:.]$/, '')
  if (!DAY_RE.test(t)) return null
  const key = t.slice(0, 3).toLowerCase()
  return DAYS.find((d) => d.toLowerCase() === key) ?? null
}

function detectKind(text: string): SessionType | null {
  const t = text.toLowerCase()
  if (/\blab(oratory)?\b/.test(t) && /class|session|routine/.test(t)) return 'lab'
  if (/\btheory\b/.test(t)) return 'theory'
  return null
}

interface Column {
  label: string
  centre: number
  startMin: number
  endMin: number
}

/** A header row is a line where most items are time ranges. */
function detectHeader(line: Line): Column[] | null {
  const ranges = line.items.filter((i) => isTimeRange(i.str))
  if (ranges.length < 2 || ranges.length < line.items.length - 1) return null
  const cols: Column[] = []
  for (const it of ranges) {
    const t = parseTimeRange(it.str)
    if (!t) continue
    cols.push({ label: it.str.trim(), centre: it.x + it.width / 2, ...t })
  }
  return cols.sort((a, b) => a.centre - b.centre)
}

const ROOM_RE = /^[A-Z]{0,3}[-\s]?\d{1,4}[A-Z]?$|^(lab|room)\s*[-\s]?\w+$/i

const COURSE_RE = /^([A-Z]{2,5})\s*-?\s*(\d{3}[A-Z]?)(?:\.(\d{1,2}))?\b\s*(.*)$/

const NOISE_RE = /^(no class|weekend|holiday|off|break|-+)$/i

/* ------------------------------------------------------------------------- */
/* Faculty directory (the "Faculty Members" table)                           */
/* ------------------------------------------------------------------------- */

function directoryRow(line: Line): [string, string] | null {
  if (line.items.length < 3) return null
  const first = line.items[0].str.trim()
  if (!/^\d{1,3}\.?$/.test(first)) return null
  const short = line.items[line.items.length - 1].str.trim()
  const name = line.items
    .slice(1, -1)
    .map((i) => i.str.trim())
    .join(' ')
  if (!name || short.length > 14) return null
  return [short.toUpperCase(), name]
}

/* ------------------------------------------------------------------------- */
/* Cell text → course fields                                                  */
/* ------------------------------------------------------------------------- */

interface CellFields {
  courseCode: string
  section: string
  facultyTag: string
  override?: { startMin: number; endMin: number }
}

export function parseCellText(lines: string[]): CellFields | null {
  const clean = lines.map((l) => l.trim()).filter(Boolean)
  if (!clean.length || clean.every((l) => NOISE_RE.test(l))) return null

  const courseIdx = clean.findIndex((l) => COURSE_RE.test(l))
  if (courseIdx === -1) return null
  const m = COURSE_RE.exec(clean[courseIdx])!
  const [, dept, num, section = '', rest] = m

  let override: CellFields['override']
  const paren = /\(([^)]*)\)/.exec(rest)
  if (paren && isTimeRange(paren[1])) override = parseTimeRange(paren[1]) ?? undefined

  // Faculty tag: everything after the course line, with honorifics stripped.
  const tail = clean.slice(courseIdx + 1).join(' ')
  const facultyTag = tail.replace(/\s+/g, ' ').trim()

  return { courseCode: `${dept} ${num}`, section, facultyTag, override }
}

/* ------------------------------------------------------------------------- */
/* Main parse                                                                 */
/* ------------------------------------------------------------------------- */

interface Table {
  day: DayName
  kind: SessionType
  columns: Column[]
  /** Left edge of the first time column; anything left of it is the room label. */
  roomBoundary: number
  /** Items collected for this table, tagged with their page. */
  rows: { room: string; y: number; page: number; items: TextItem[] }[]
  pending: { item: TextItem; page: number }[]
}

export function parseRoutinePages(pages: PageText[]): ParseResult {
  const warnings: string[] = []
  const facultyDirectory: Record<string, string> = {}
  let semesterHint: string | undefined
  let institutionHint: string | undefined

  const tables: Table[] = []
  let currentDay: DayName | null = null
  let pendingKind: SessionType | null = null
  let inDirectory = false
  let table: Table | null = null

  for (const page of pages) {
    const lines = toLines(mergeFragments(page.items))
    for (const line of lines) {
      const text = lineText(line)

      // Header hints (first page usually carries the title block).
      if (!semesterHint) {
        const sem = /(spring|summer|fall|autumn|winter)\s*[-–]?\s*(\d{4})/i.exec(text)
        if (sem) semesterHint = `${capitalise(sem[1])} ${sem[2]}`
      }
      if (!institutionHint && /\buniversity\b/i.test(text) && text.length < 60) {
        institutionHint = text
      }

      if (/faculty\s+members?|short\s*form/i.test(text)) {
        inDirectory = true
        table = null
        continue
      }
      if (inDirectory) {
        const row = directoryRow(line)
        if (row) {
          facultyDirectory[row[0]] = row[1]
          continue
        }
      }

      const day = detectDay(text)
      if (day) {
        currentDay = day
        pendingKind = null
        inDirectory = false
        table = null
        continue
      }

      const kind = detectKind(text)
      if (kind && line.items.length <= 2) {
        pendingKind = kind
        table = null
        continue
      }

      const header = detectHeader(line)
      if (header) {
        if (!currentDay) {
          warnings.push(`Time header found on page ${page.pageNumber} before any day heading.`)
          continue
        }
        inDirectory = false
        const gap = header.length > 1 ? header[1].centre - header[0].centre : 80
        table = {
          day: currentDay,
          kind: pendingKind ?? inferKindFromColumns(header),
          columns: header,
          roomBoundary: header[0].centre - gap / 2,
          rows: [],
          pending: [],
        }
        tables.push(table)
        continue
      }

      if (!table) continue

      // Data line: split into room labels vs cell items.
      for (const it of line.items) {
        const centre = it.x + it.width / 2
        if (centre < table.roomBoundary && ROOM_RE.test(it.str.trim())) {
          table.rows.push({ room: it.str.trim(), y: it.y, page: page.pageNumber, items: [] })
        } else {
          table.pending.push({ item: it, page: page.pageNumber })
        }
      }
    }
  }

  const cells: ParsedCell[] = []
  for (const t of tables) {
    // Snap each pending item to nearest room row (same page) and nearest column.
    const cellMap = new Map<string, { row: Table['rows'][number]; col: Column; items: TextItem[] }>()
    for (const { item, page } of t.pending) {
      const rowsOnPage = t.rows.filter((r) => r.page === page)
      if (!rowsOnPage.length) continue
      const row = nearest(rowsOnPage, (r) => Math.abs(r.y - item.y))
      if (Math.abs(row.y - item.y) > 24) continue
      const centre = item.x + item.width / 2
      const col = nearest(t.columns, (c) => Math.abs(c.centre - centre))
      const colGap = t.columns.length > 1 ? Math.abs(t.columns[1].centre - t.columns[0].centre) : 80
      if (Math.abs(col.centre - centre) > colGap * 0.6) continue
      const key = `${row.page}:${row.y.toFixed(1)}:${col.label}`
      const cell = cellMap.get(key) ?? { row, col, items: [] }
      cell.items.push(item)
      cellMap.set(key, cell)
    }

    for (const cell of cellMap.values()) {
      const lines = toLines(cell.items).map(lineText)
      const fields = parseCellText(lines)
      if (!fields) continue
      cells.push({
        day: t.day,
        tableKind: t.kind,
        room: cell.row.room,
        slotLabel: cell.col.label,
        startMin: fields.override?.startMin ?? cell.col.startMin,
        endMin: fields.override?.endMin ?? cell.col.endMin,
        rawText: lines.join(' / '),
        courseCode: fields.courseCode,
        section: fields.section,
        facultyTag: fields.facultyTag,
        page: cell.row.page,
      })
    }
  }

  const columnMap = new Map<string, ParsedColumn>()
  for (const t of tables) {
    for (const c of t.columns) {
      const key = `${t.kind}:${c.startMin}-${c.endMin}`
      if (!columnMap.has(key)) columnMap.set(key, { kind: t.kind, label: c.label, startMin: c.startMin, endMin: c.endMin })
    }
  }

  if (!tables.length) {
    warnings.push('No routine tables were detected. Is this a text-based (not scanned) routine PDF?')
  }

  return {
    cells: cells.sort(
      (a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.startMin - b.startMin,
    ),
    columns: [...columnMap.values()].sort((a, b) => a.startMin - b.startMin),
    facultyDirectory,
    semesterHint,
    institutionHint,
    pageCount: pages.length,
    warnings,
  }
}

/** Lab tables use 2-hour blocks; theory tables use 90-minute blocks. */
function inferKindFromColumns(cols: Column[]): SessionType {
  const avg = cols.reduce((s, c) => s + (c.endMin - c.startMin), 0) / cols.length
  return avg >= 110 ? 'lab' : 'theory'
}

function nearest<T>(arr: T[], dist: (t: T) => number): T {
  let best = arr[0]
  let bestD = dist(best)
  for (const t of arr) {
    const d = dist(t)
    if (d < bestD) {
      best = t
      bestD = d
    }
  }
  return best
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

/* ------------------------------------------------------------------------- */
/* Faculty search                                                             */
/* ------------------------------------------------------------------------- */

const HONORIFIC_RE = /^(dr|mr|mrs|ms|md|prof|engr)\.?$/i

function tagTokens(tag: string): string[] {
  return tag
    .toUpperCase()
    .split(/[\s,/&+()]+/)
    .filter((t) => t && !HONORIFIC_RE.test(t))
}

/**
 * Keep only the cells taught by the searched faculty.
 * Exact short-form token match first (so "ANJ" doesn't hit "ANJUM"); when
 * nothing matches exactly we fall back to a substring search so partial or
 * full-name queries still work.
 */
export function filterCellsByFaculty(cells: ParsedCell[], query: string): ParsedCell[] {
  const q = query.trim().toUpperCase()
  if (!q) return []
  const qTokens = q.split(/\s+/)
  const exact = cells.filter((c) => {
    const tokens = tagTokens(c.facultyTag)
    return qTokens.every((qt) => tokens.includes(qt))
  })
  if (exact.length) return exact
  return cells.filter((c) => c.facultyTag.toUpperCase().includes(q) || c.rawText.toUpperCase().includes(q))
}

/** Resolve a short form to a full name via the parsed directory (case-insensitive). */
export function lookupFacultyName(
  directory: Record<string, string>,
  query: string,
): string | undefined {
  const q = query.trim().toUpperCase()
  if (!q) return undefined
  if (directory[q]) return directory[q]
  const hit = Object.entries(directory).find(([, name]) => name.toUpperCase().includes(q))
  return hit?.[1]
}
