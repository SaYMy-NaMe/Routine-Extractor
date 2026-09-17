/**
 * Use case: the library of stored master routines. Wraps the repository port
 * with the domain rules for titles and ids, so the UI never touches storage
 * directly.
 */

import { type ImportedRoutine } from './importRoutine'
import {
  type MasterRoutine,
  type MasterRoutineMeta,
  normaliseSemesterTitle,
  validateSemesterTitle,
} from '../../domain'
import type { RoutineRepository } from '../ports'

export class LibraryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LibraryError'
  }
}

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export class RoutineLibraryUseCase {
  private readonly repository: RoutineRepository

  constructor(repository: RoutineRepository) {
    this.repository = repository
  }

  get scope(): RoutineRepository['scope'] {
    return this.repository.scope
  }

  async list(): Promise<MasterRoutineMeta[]> {
    const all = await this.repository.list()
    return all.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
  }

  get(id: string): Promise<MasterRoutine | null> {
    return this.repository.get(id)
  }

  /** Store an imported routine under a semester title; an existing title is replaced. */
  async add(imported: ImportedRoutine, rawTitle: string): Promise<MasterRoutine> {
    const problem = validateSemesterTitle(rawTitle)
    if (problem) throw new LibraryError(problem)
    const title = normaliseSemesterTitle(rawTitle)
    const existing = (await this.repository.list()).find((m) => m.title.toLowerCase() === title.toLowerCase())
    const routine: MasterRoutine = {
      id: existing?.id ?? newId(),
      title,
      fileName: imported.fileName,
      format: imported.format,
      uploadedAt: new Date().toISOString(),
      cellCount: imported.result.cells.length,
      pageCount: imported.result.pageCount,
      parse: imported.result,
    }
    await this.repository.save(routine)
    return routine
  }

  remove(id: string): Promise<void> {
    return this.repository.remove(id)
  }
}
