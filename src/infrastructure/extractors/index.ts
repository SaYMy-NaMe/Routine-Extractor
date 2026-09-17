import type { TextExtractor } from '../../application'
import { DocTextExtractor } from './docTextExtractor'
import { DocxTextExtractor } from './docxTextExtractor'
import { PdfTextExtractor } from './pdfTextExtractor'

/** Factory: the default extractor strategies, in lookup order. */
export function createExtractors(): TextExtractor[] {
  return [new PdfTextExtractor(), new DocxTextExtractor(), new DocTextExtractor()]
}

export { DocTextExtractor } from './docTextExtractor'
export { DocxTextExtractor, docxXmlToPages } from './docxTextExtractor'
export { PdfTextExtractor, collectPages } from './pdfTextExtractor'
export * from './signatures'
