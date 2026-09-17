/**
 * PDF → positioned text via pdfjs-dist. The library (and its worker) is
 * loaded lazily so the initial bundle stays small.
 */

import type { PageText, TextItem } from '../../domain'
import type { TextExtractor } from '../../application'
import { hasExtension, isPdf } from './signatures'

/** Minimal structural type for a pdfjs document so both browser and legacy builds fit. */
export interface PdfDocLike {
  numPages: number
  getPage(n: number): Promise<{
    getViewport(opts: { scale: number }): { width: number; height: number }
    getTextContent(): Promise<{ items: unknown[] }>
  }>
}

interface RawItem {
  str?: string
  transform?: number[]
  width?: number
  height?: number
}

/** Convert one pdfjs page into a plain page/item record. */
async function collectPage(pdf: PdfDocLike, pageNumber: number): Promise<PageText> {
  const page = await pdf.getPage(pageNumber)
  const vp = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()
  const items: TextItem[] = []
  for (const raw of content.items as RawItem[]) {
    if (!raw.str?.trim() || !raw.transform) continue
    const [a, b, , , e, f] = raw.transform
    const fontSize = Math.hypot(a, b) || raw.height || 10
    items.push({
      str: raw.str,
      x: e,
      y: vp.height - f,
      width: raw.width ?? 0,
      height: raw.height || fontSize,
    })
  }
  return { pageNumber, width: vp.width, height: vp.height, items }
}

/** Convert a pdfjs document into plain page/item records (pages are read concurrently). */
export function collectPages(pdf: PdfDocLike): Promise<PageText[]> {
  return Promise.all(Array.from({ length: pdf.numPages }, (_, i) => collectPage(pdf, i + 1)))
}

export class PdfTextExtractor implements TextExtractor {
  readonly format = 'pdf' as const
  readonly extensions = ['.pdf'] as const

  accepts(file: { name: string; type: string }): boolean {
    return hasExtension(file.name, '.pdf') || file.type === 'application/pdf'
  }

  sniff(data: ArrayBuffer): string | null {
    return isPdf(data) ? null : 'This file is not a valid PDF (missing the PDF signature).'
  }

  async extract(data: ArrayBuffer): Promise<PageText[]> {
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const task = pdfjs.getDocument({ data: new Uint8Array(data) })
    try {
      return await collectPages(await task.promise)
    } finally {
      await task.destroy()
    }
  }
}
