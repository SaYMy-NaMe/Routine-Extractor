/**
 * Source-document model: the positioned text that both the PDF and the DOCX
 * extractors produce, and the matrix cells the parser lifts out of it.
 */

import type { DayName, SessionType } from './schedule'
import type { TimeRange } from './time'

export interface TextItem {
  readonly str: string
  /** Left edge, in document units. */
  readonly x: number
  /** Top-down baseline y, in document units. */
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface PageText {
  readonly pageNumber: number
  readonly width: number
  readonly height: number
  readonly items: readonly TextItem[]
}

/** A non-empty cell lifted out of a departmental routine matrix. */
export interface ParsedCell extends TimeRange {
  readonly day: DayName
  /** Which table the cell came from ("Theory Classes" vs "Lab Classes"). */
  readonly tableKind: SessionType
  readonly room: string
  /** Time-slot header text of the column, as printed (e.g. "11.30-1.00"). */
  readonly slotLabel: string
  /** Raw cell text with line breaks collapsed to " / ". */
  readonly rawText: string
  readonly courseCode: string
  readonly section: string
  /** Faculty short form(s) written in the cell. */
  readonly facultyTag: string
  readonly page: number
}

/** A time-slot column found in a table header. */
export interface ParsedColumn extends TimeRange {
  readonly kind: SessionType
  readonly label: string
}

/** One row of the "Faculty Members" table. */
export interface FacultyDirectoryEntry {
  /** Short form as printed in the matrix, upper-cased (e.g. "ASHRAF"). */
  readonly shortForm: string
  /** Full name as printed, honorific included (e.g. "Mr. Ashrafur Rahman Chowdhury"). */
  readonly name: string
  /** Designation column when the table has one (e.g. "Assistant Professor"). */
  readonly designation?: string
}

export interface ParseResult {
  readonly cells: readonly ParsedCell[]
  /** Distinct header columns across all tables (theory and lab). */
  readonly columns: readonly ParsedColumn[]
  /** The "Faculty Members" table, when present. */
  readonly facultyDirectory: readonly FacultyDirectoryEntry[]
  /** Best-effort header hints ("Summer 2026", "East Delta University", "School of …"). */
  readonly semesterHint?: string
  readonly institutionHint?: string
  readonly schoolHint?: string
  readonly pageCount: number
  readonly warnings: readonly string[]
}

/** Supported master-routine file formats. */
export type DocumentFormat = 'pdf' | 'docx'

/** Formats offered in the file picker; legacy `.doc` is accepted and sniffed (see DocTextExtractor). */
export const UPLOAD_EXTENSIONS = ['.pdf', '.doc', '.docx'] as const
