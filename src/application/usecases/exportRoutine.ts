/**
 * Use case: export the personal routine in a chosen format.
 * The exporter strategies are resolved from a registry so adding a format
 * never touches the UI.
 */

import type { FacultyProfile } from '../../domain'
import type { ExportData, ExportFormat, FileSaver, RoutineExporter } from '../ports'

export class ExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExportError'
  }
}

/** "Ashrafur-Rahman-Chowdhury-Summer-2026-routine" */
export function baseFileName(p: FacultyProfile): string {
  const slug = (s: string) =>
    s
      .trim()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
  return [slug(p.fullName || 'faculty'), slug(p.semester || 'routine'), 'routine'].filter(Boolean).join('-')
}

export class ExportRoutineUseCase {
  private readonly exporters: readonly RoutineExporter[]
  private readonly save: FileSaver

  constructor(exporters: readonly RoutineExporter[], save: FileSaver) {
    this.exporters = exporters
    this.save = save
  }

  get formats(): readonly RoutineExporter[] {
    return this.exporters
  }

  async execute(format: ExportFormat, data: ExportData): Promise<string> {
    const exporter = this.exporters.find((e) => e.format === format)
    if (!exporter) throw new ExportError(`No exporter registered for "${format}".`)
    if (!data.grid.slots.length) throw new ExportError('Add at least one class before exporting.')
    let blob: Blob
    try {
      blob = await exporter.build(data)
    } catch (err) {
      throw new ExportError(err instanceof Error ? err.message : `Could not build the ${exporter.label}.`)
    }
    const fileName = `${baseFileName(data.profile)}.${exporter.extension}`
    this.save(blob, fileName)
    return fileName
  }
}
