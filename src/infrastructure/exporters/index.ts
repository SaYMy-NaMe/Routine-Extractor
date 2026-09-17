import type { RoutineExporter } from '../../application'
import { DocxExporter } from './docxExporter'
import { PdfExporter } from './pdfExporter'

/** Factory: the default exporter strategies, in menu order. */
export function createExporters(): RoutineExporter[] {
  return [new PdfExporter(), new DocxExporter()]
}

export { DocxExporter, buildDocxBlob } from './docxExporter'
export { PdfExporter, drawRoutinePdf } from './pdfExporter'
export * from './template'
