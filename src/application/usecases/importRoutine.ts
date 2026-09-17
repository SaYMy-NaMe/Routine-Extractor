/**
 * Use case: import a master routine file.
 *
 * Validation happens in three layers before anything is stored:
 *   1. size and declared type (extension / MIME);
 *   2. content sniffing — the bytes must carry the format's signature
 *      ("%PDF-", the ZIP header of an OOXML package, the OLE header of a
 *      legacy .doc), so a renamed file cannot slip through;
 *   3. layout pattern — the parsed document must look like a class routine
 *      (day tables with time-slot headers and course cells).
 * Failures surface as `ImportError` with a user-facing message.
 */

import type { DocumentFormat, ParseResult } from '../../domain'
import { parseRoutinePages } from '../parse'
import type { TextExtractor } from '../ports'

export const MAX_FILE_BYTES = 25 * 1024 * 1024
/** A genuine routine has at least this many class cells across at least this many days. */
const MIN_CELLS = 8
const MIN_DAYS = 2

export class ImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportError'
  }
}

export interface ImportedRoutine {
  readonly fileName: string
  readonly format: DocumentFormat
  readonly result: ParseResult
}

/** Minimal shape of a browser `File` so the use case stays testable without the DOM. */
export interface FileLike {
  readonly name: string
  readonly type: string
  readonly size: number
  arrayBuffer(): Promise<ArrayBuffer>
}

/** Layout-pattern check shared with tests: does this parse look like a routine? */
export function routineLayoutProblem(result: ParseResult): string | null {
  if (!result.cells.length) return result.warnings[0] ?? 'No routine matrix was found in this file.'
  const days = new Set(result.cells.map((c) => c.day)).size
  if (result.cells.length < MIN_CELLS || days < MIN_DAYS) {
    return 'This file does not look like a class routine — it needs day-by-day tables with time slots and course cells.'
  }
  return null
}

export class ImportRoutineUseCase {
  private readonly extractors: readonly TextExtractor[]

  constructor(extractors: readonly TextExtractor[]) {
    this.extractors = extractors
  }

  /** Extensions offered by the file picker. */
  get acceptedExtensions(): string[] {
    return [...new Set(this.extractors.flatMap((e) => e.extensions))]
  }

  findExtractor(file: Pick<FileLike, 'name' | 'type'>): TextExtractor | undefined {
    return this.extractors.find((e) => e.accepts(file))
  }

  async execute(file: FileLike): Promise<ImportedRoutine> {
    if (file.size === 0) throw new ImportError('The file is empty.')
    if (file.size > MAX_FILE_BYTES) {
      throw new ImportError(`The file is larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`)
    }
    const extractor = this.findExtractor(file)
    if (!extractor) {
      throw new ImportError(
        `Unsupported file type. Please upload the routine as ${this.acceptedExtensions.join(', ')}.`,
      )
    }

    const bytes = await file.arrayBuffer()
    const sniff = extractor.sniff(bytes)
    if (sniff) throw new ImportError(sniff)

    let pages
    try {
      pages = await extractor.extract(bytes)
    } catch (err) {
      const detail = err instanceof Error && err.message ? `: ${err.message}` : '.'
      throw new ImportError(`Could not read this ${extractor.format.toUpperCase()}${detail}`)
    }

    const result = parseRoutinePages(pages)
    const problem = routineLayoutProblem(result)
    if (problem) throw new ImportError(problem)
    return { fileName: file.name, format: extractor.format, result }
  }
}
