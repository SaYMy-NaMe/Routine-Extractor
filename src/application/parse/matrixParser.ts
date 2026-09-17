/**
 * Routine matrix parser.
 *
 * A departmental routine is a sequence of tables, one per day:
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
 * column x-positions stay fixed within one table, so the last header stays
 * the active "column ruler" until a new one appears. Cells are located by
 * snapping each text item to the nearest column centre (x) and the nearest
 * room label (y). The parser is a small state machine over visual lines.
 */

import {
  type DayName,
  type FacultyDirectoryEntry,
  type PageText,
  type ParseResult,
  type ParsedCell,
  type ParsedColumn,
  type SessionType,
  type TextItem,
  type TimeRange,
  dayIndex,
  isTimeRange,
  parseCourseCode,
  parseDayName,
  parseTimeRange,
} from '../../domain'
import { parseCellText } from './cellParser'
import { itemCentre, lineText, mergeFragments, toLines, type Line } from './textLayout'

/* ------------------------------------------------------------------------- */
/* Tunables                                                                   */
/* ------------------------------------------------------------------------- */

/** Max vertical distance (document units) between a cell item and its room label. */
const ROW_SNAP = 24
/** Fraction of the column pitch an item may sit from a column centre. */
const COL_SNAP = 0.6
const FALLBACK_COL_GAP = 80
/** Tables whose average block is this long are labs (2 h) rather than theory (1.5 h). */
const LAB_BLOCK_MINUTES = 110

const ROOM_RE = /^[A-Z]{0,3}[-\s]?\d{1,4}[A-Z]?$|^(lab|room)\s*[-\s]?\w+$/i
const SEMESTER_RE = /(spring|summer|fall|autumn|winter)\s*[-–]?\s*(\d{4})/i
const DIRECTORY_HEADING_RE = /faculty\s+members?|short\s*form/i
const FOREIGN_HEADING_RE = /\bexam\b/i
const FOREIGN_HEADER_CELL_RE = /^(day|week)\s*\d+$/i

/* ------------------------------------------------------------------------- */
/* Internal structures                                                        */
/* ------------------------------------------------------------------------- */

interface Column extends ParsedColumn {
  readonly centre: number
}

interface RoomRow {
  readonly room: string
  readonly y: number
  readonly page: number
}

interface Table {
  readonly day: DayName
  readonly kind: SessionType
  readonly columns: readonly Column[]
  /** Left edge of the first time column; anything left of it is the room label. */
  readonly roomBoundary: number
  readonly rows: RoomRow[]
  readonly pending: { item: TextItem; page: number }[]
}

/* ------------------------------------------------------------------------- */
/* Line classifiers                                                           */
/* ------------------------------------------------------------------------- */

function detectKind(text: string): SessionType | null {
  const t = text.toLowerCase()
  if (/\blab(oratory)?\b/.test(t) && /class|session|routine/.test(t)) return 'lab'
  if (/\btheory\b/.test(t)) return 'theory'
  return null
}

/** A header row is a line where (almost) every item is a time range. */
function detectHeader(line: Line, kind: SessionType | null): Column[] | null {
  const ranges = line.items.filter((i) => isTimeRange(i.str))
  if (ranges.length < 2 || ranges.length < line.items.length - 1) return null
  const parsed = ranges.flatMap((it) => {
    const t = parseTimeRange(it.str)
    return t ? [{ label: it.str.trim(), centre: itemCentre(it), ...t }] : []
  })
  parsed.sort((a, b) => a.centre - b.centre)
  const resolvedKind = kind ?? inferKindFromColumns(parsed)
  return parsed.map((c) => ({
    kind: resolvedKind,
    label: c.label,
    centre: c.centre,
    startMin: c.startMin,
    endMin: c.endMin,
  }))
}

/** Lab tables use 2-hour blocks; theory tables use 90-minute blocks. */
function inferKindFromColumns(cols: readonly TimeRange[]): SessionType {
  const avg = cols.reduce((s, c) => s + (c.endMin - c.startMin), 0) / cols.length
  return avg >= LAB_BLOCK_MINUTES ? 'lab' : 'theory'
}

const DESIGNATION_RE = /\b(professor|lecturer|instructor|fellow|adjunct|dean|chair|head)\b/i

/**
 * "47 | Mr. Ashrafur Rahman Chowdhury | ASHRAF"
 * "47 | Mr. Ashrafur Rahman Chowdhury | Lecturer | ASHRAF"   (optional designation column)
 */
function directoryRow(line: Line): FacultyDirectoryEntry | null {
  if (line.items.length < 3) return null
  if (!/^\d{1,3}\.?$/.test(line.items[0].str.trim())) return null
  const shortForm = line.items[line.items.length - 1].str.trim()
  if (!shortForm || shortForm.length > 14) return null
  const middle = line.items.slice(1, -1).map((i) => i.str.trim())
  const designation =
    middle.length > 1 && DESIGNATION_RE.test(middle[middle.length - 1]) ? middle.pop() : undefined
  const name = middle.join(' ')
  if (!name) return null
  return { shortForm: shortForm.toUpperCase(), name, ...(designation ? { designation } : {}) }
}

function isForeignTableLine(text: string, line: Line): boolean {
  if (FOREIGN_HEADING_RE.test(text) && line.items.length <= 2) return true
  return line.items.filter((i) => FOREIGN_HEADER_CELL_RE.test(i.str.trim())).length >= 2
}

function nearest<T>(arr: readonly T[], dist: (t: T) => number): T {
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
/* Parser                                                                     */
/* ------------------------------------------------------------------------- */

class MatrixParser {
  private readonly tables: Table[] = []
  private readonly warnings: string[] = []
  private readonly directory = new Map<string, FacultyDirectoryEntry>()
  private semesterHint?: string
  private institutionHint?: string
  private schoolHint?: string

  private currentDay: DayName | null = null
  private pendingKind: SessionType | null = null
  private inDirectory = false
  private table: Table | null = null

  parse(pages: readonly PageText[]): ParseResult {
    for (const page of pages) {
      for (const line of toLines(mergeFragments(page.items))) this.consume(line, page.pageNumber)
    }
    if (!this.tables.length) {
      this.warnings.push(
        'No routine tables were detected. Is this the text-based (not scanned) departmental routine?',
      )
    }
    return {
      cells: this.collectCells().sort((a, b) => dayIndex(a.day) - dayIndex(b.day) || a.startMin - b.startMin),
      columns: this.collectColumns(),
      facultyDirectory: [...this.directory.values()],
      semesterHint: this.semesterHint,
      institutionHint: this.institutionHint,
      schoolHint: this.schoolHint,
      pageCount: pages.length,
      warnings: this.warnings,
    }
  }

  /** Classify one visual line and advance the state machine. */
  private consume(line: Line, page: number): void {
    const text = lineText(line)
    this.noteHints(text)

    if (DIRECTORY_HEADING_RE.test(text)) {
      this.inDirectory = true
      this.table = null
      return
    }
    if (this.inDirectory) {
      const row = directoryRow(line)
      if (row) {
        this.directory.set(row.shortForm, row)
        return
      }
    }

    const day = parseDayName(text)
    if (day) {
      this.currentDay = day
      this.pendingKind = null
      this.inDirectory = false
      this.table = null
      return
    }

    const kind = detectKind(text)
    if (kind && line.items.length <= 2) {
      this.pendingKind = kind
      this.table = null
      return
    }

    const header = detectHeader(line, this.pendingKind)
    if (header) {
      this.openTable(header, page)
      return
    }

    if (!this.table) return
    if (isForeignTableLine(text, line)) {
      this.table = null
      return
    }
    this.consumeDataLine(line, page)
  }

  private noteHints(text: string): void {
    if (!this.semesterHint) {
      const sem = SEMESTER_RE.exec(text)
      if (sem) this.semesterHint = `${capitalise(sem[1])} ${sem[2]}`
    }
    if (!this.institutionHint && /\buniversity\b/i.test(text) && text.length < 60) {
      this.institutionHint = text
    }
    if (!this.schoolHint && /^(school|faculty|department) of\b/i.test(text) && text.length < 80) {
      this.schoolHint = text.replace(/\s*&\s*/g, ' & ')
    }
  }

  private openTable(columns: Column[], page: number): void {
    if (!this.currentDay) {
      this.warnings.push(`Time header found on page ${page} before any day heading.`)
      return
    }
    this.inDirectory = false
    const gap = columns.length > 1 ? columns[1].centre - columns[0].centre : FALLBACK_COL_GAP
    this.table = {
      day: this.currentDay,
      kind: columns[0].kind,
      columns,
      roomBoundary: columns[0].centre - gap / 2,
      rows: [],
      pending: [],
    }
    this.tables.push(this.table)
  }

  /** Split a data line into room labels vs. cell items. */
  private consumeDataLine(line: Line, page: number): void {
    const table = this.table!
    for (const item of line.items) {
      if (itemCentre(item) < table.roomBoundary && ROOM_RE.test(item.str.trim())) {
        table.rows.push({ room: item.str.trim(), y: item.y, page })
      } else {
        table.pending.push({ item, page })
      }
    }
  }

  /** Snap every pending item to its (room row, column) cell and parse the cell text. */
  private collectCells(): ParsedCell[] {
    const cells: ParsedCell[] = []
    for (const t of this.tables) {
      const colGap =
        t.columns.length > 1 ? Math.abs(t.columns[1].centre - t.columns[0].centre) : FALLBACK_COL_GAP
      const cellMap = new Map<string, { row: RoomRow; col: Column; items: TextItem[] }>()

      for (const { item, page } of t.pending) {
        const rowsOnPage = t.rows.filter((r) => r.page === page)
        if (!rowsOnPage.length) continue
        const row = nearest(rowsOnPage, (r) => Math.abs(r.y - item.y))
        if (Math.abs(row.y - item.y) > ROW_SNAP) continue
        const centre = itemCentre(item)
        const col = nearest(t.columns, (c) => Math.abs(c.centre - centre))
        if (Math.abs(col.centre - centre) > colGap * COL_SNAP) continue
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
    return cells
  }

  private collectColumns(): ParsedColumn[] {
    const map = new Map<string, ParsedColumn>()
    for (const t of this.tables) {
      for (const c of t.columns) {
        const key = `${t.kind}:${c.startMin}-${c.endMin}`
        if (!map.has(key))
          map.set(key, { kind: t.kind, label: c.label, startMin: c.startMin, endMin: c.endMin })
      }
    }
    return [...map.values()].sort((a, b) => a.startMin - b.startMin)
  }
}

/** Parse positioned text pages (from any extractor) into routine cells. */
export function parseRoutinePages(pages: readonly PageText[]): ParseResult {
  return new MatrixParser().parse(pages)
}

/** Re-exported for tests and tooling. */
export { parseCourseCode }
