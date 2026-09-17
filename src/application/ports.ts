/**
 * Ports — the interfaces the application layer depends on. Infrastructure
 * supplies the adapters; presentation wires them together (dependency
 * injection via `ServicesProvider`). Nothing in `application/` imports from
 * `infrastructure/` or `presentation/`.
 */

import type {
  DocumentFormat,
  EmptyDaySettings,
  MasterRoutine,
  MasterRoutineMeta,
  FacultyProfile,
  PageText,
  RoutineGrid,
  TimeSlot,
  WorkloadSummary,
} from '../domain'

/** Strategy: turns the bytes of one document format into positioned text. */
export interface TextExtractor {
  readonly format: DocumentFormat
  /** File extensions offered in the picker for this strategy (e.g. ".pdf"). */
  readonly extensions: readonly string[]
  /** Does the declared name / MIME type belong to this strategy? */
  accepts(file: { name: string; type: string }): boolean
  /** Content sniffing: null when the bytes carry the right signature, else a user-facing problem. */
  sniff(data: ArrayBuffer): string | null
  extract(data: ArrayBuffer): Promise<PageText[]>
}

/** Everything an export template needs; shared so every format agrees. */
export interface ExportData {
  readonly profile: FacultyProfile
  readonly grid: RoutineGrid
  /** Columns to print (already filtered for empty ones). */
  readonly columns: readonly TimeSlot[]
  readonly workload: WorkloadSummary
  readonly emptyDay: EmptyDaySettings
}

export type ExportFormat = 'pdf' | 'docx'

/** Strategy: renders the routine into one downloadable file format. */
export interface RoutineExporter {
  readonly format: ExportFormat
  readonly label: string
  readonly extension: string
  readonly mimeType: string
  build(data: ExportData): Promise<Blob>
}

/** Minimal persistence port (backed by localStorage in the browser, memory in tests). */
export interface KeyValueStorage {
  get<T>(key: string): T | null
  set<T>(key: string, value: T): void
  remove(key: string): void
}

/** Saves a blob to the user's device. */
export type FileSaver = (blob: Blob, fileName: string) => void

/**
 * Persistent store of uploaded master routines. Implementations: IndexedDB
 * (per device) and HTTP (shared by everyone through a routine API).
 */
export interface RoutineRepository {
  /** Where the data lives — surfaced in the UI so users know the scope of sharing. */
  readonly scope: 'device' | 'shared'
  list(): Promise<MasterRoutineMeta[]>
  get(id: string): Promise<MasterRoutine | null>
  save(routine: MasterRoutine): Promise<void>
  remove(id: string): Promise<void>
}
