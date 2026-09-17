/**
 * Legacy `.doc` strategy.
 *
 * Word 97–2003 files are OLE2 compound documents whose text lives in a piece
 * table — there is no dependable browser-side reader for their table layout.
 * Many files named `.doc` are in fact OOXML packages, so those are handed to
 * the DOCX strategy; genuine binary `.doc` files are rejected with a clear
 * instruction rather than parsed unreliably.
 */

import type { PageText } from '../../domain'
import type { TextExtractor } from '../../application'
import { DocxTextExtractor } from './docxTextExtractor'
import { hasExtension, isOle, isZip } from './signatures'

const DOC_MIME = 'application/msword'

export class DocTextExtractor implements TextExtractor {
  readonly format = 'docx' as const
  readonly extensions = ['.doc'] as const
  private readonly docx = new DocxTextExtractor()

  accepts(file: { name: string; type: string }): boolean {
    return hasExtension(file.name, '.doc') || file.type === DOC_MIME
  }

  sniff(data: ArrayBuffer): string | null {
    if (isZip(data)) return null
    if (isOle(data)) {
      return 'Legacy binary .doc files cannot be read in the browser. In Word choose File → Save As → .docx (or PDF) and upload that.'
    }
    return 'This file is not a Word document.'
  }

  extract(data: ArrayBuffer): Promise<PageText[]> {
    return this.docx.extract(data)
  }
}
