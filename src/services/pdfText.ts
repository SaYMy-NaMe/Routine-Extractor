/**
 * Thin wrapper around pdfjs-dist that turns a PDF into positioned text items.
 * Kept separate from the parser so the matrix logic stays pure and testable.
 */

export interface TextItem {
  str: string
  /** Left edge, PDF points. */
  x: number
  /** Top-down y of the text baseline, PDF points. */
  y: number
  width: number
  height: number
}

export interface PageText {
  pageNumber: number
  width: number
  height: number
  items: TextItem[]
}

/** Minimal structural type for a pdfjs document so both browser and legacy builds fit. */
interface PdfDocLike {
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

/** Convert a pdfjs document into plain page/item records. */
export async function collectPages(pdf: PdfDocLike): Promise<PageText[]> {
  const pages: PageText[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const items: TextItem[] = []
    for (const raw of content.items as RawItem[]) {
      if (!raw.str || !raw.str.trim() || !raw.transform) continue
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
    pages.push({ pageNumber: p, width: vp.width, height: vp.height, items })
  }
  return pages
}

/** Browser entry point: load pdfjs lazily (with its worker) and extract all pages. */
export async function extractPdfText(data: ArrayBuffer): Promise<PageText[]> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const task = pdfjs.getDocument({ data: new Uint8Array(data) })
  try {
    return await collectPages(await task.promise)
  } finally {
    await task.destroy()
  }
}
