/**
 * DOCX → positioned text.
 *
 * A Word routine is a sequence of paragraphs and tables. We walk the OpenXML
 * body and lay the content out on synthetic "pages" — one per table — with
 * each table row on its own baseline and each column at a fixed x offset. The
 * result has the same shape as the PDF extraction, so the matrix parser
 * handles both formats without knowing which one it was fed.
 *
 * Only the tiny subset of WordprocessingML we need is handled (paragraphs,
 * tables, grid spans, line breaks) via regexes rather than a DOM parser so the
 * code runs identically in the browser and under Node tests.
 */

import type { PageText, TextItem } from '../../domain'
import type { TextExtractor } from '../../application'
import { hasExtension, isOle, isZip } from './signatures'

const COL_W = 100 // synthetic column pitch
const ROW_H = 60 // synthetic row pitch (must exceed the parser's row snap distance)
const LINE_H = 10 // pitch between paragraphs inside one cell
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(/^#x/i.test(e) ? parseInt(e.slice(2), 16) : +e.slice(1))
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** Text of one paragraph, split on explicit line breaks. */
function paragraphLines(p: string): string[] {
  return p
    .split(/<w:br\b[^>]*\/>|<w:cr\b[^>]*\/>/)
    .map((part) =>
      decodeEntities(
        part
          .replace(/<w:tab\b[^>]*\/>/g, ' ')
          .replace(/<w:t\b[^>]*>([^<]*)<\/w:t>|<[^>]+>/g, (_m, t?: string) => t ?? ''),
      )
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
}

interface Cell {
  readonly col: number
  readonly lines: string[]
}

function cellsOfRow(tr: string): Cell[] {
  const cells: Cell[] = []
  let col = 0
  for (const tc of tr.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) ?? []) {
    const span = Number(/<w:gridSpan\b[^>]*w:val="(\d+)"/.exec(tc)?.[1] ?? 1)
    const lines = (tc.match(/<w:p\b[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g) ?? []).flatMap(paragraphLines)
    cells.push({ col, lines })
    col += span
  }
  return cells
}

/** Lay the document's paragraphs and tables out as synthetic text pages. */
export function docxXmlToPages(xml: string): PageText[] {
  const body = /<w:body\b[^>]*>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? xml
  const pages: PageText[] = []
  let items: TextItem[] = []
  let y = 20

  const flush = () => {
    if (items.length) pages.push({ pageNumber: pages.length + 1, width: 1000, height: y + ROW_H, items })
    items = []
    y = 20
  }
  const push = (str: string, x: number, width: number, yy: number) =>
    items.push({ str, x, y: yy, width, height: 8 })
  const pushHeading = (line: string) => {
    push(line, 40, line.length * 5, y)
    y += LINE_H * 1.5
  }

  // Top-level blocks only: a table's inner paragraphs are consumed with the table.
  const blocks = body.match(/<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g) ?? []
  for (const block of blocks) {
    if (!block.startsWith('<w:tbl')) {
      paragraphLines(block).forEach(pushHeading)
      continue
    }
    flush() // each table gets its own page so rows never snap across tables
    for (const tr of block.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []) {
      const cells = cellsOfRow(tr)
      const nonEmpty = cells.filter((c) => c.lines.length)
      if (!nonEmpty.length) {
        y += ROW_H
        continue
      }
      // A row with a single spanning cell is a heading ("Saturday", "Theory Classes").
      if (nonEmpty.length === 1 && cells.length === 1) {
        nonEmpty[0].lines.forEach(pushHeading)
        continue
      }
      for (const cell of cells)
        cell.lines.forEach((line, i) => push(line, cell.col * COL_W + 30, 40, y + i * LINE_H))
      y += ROW_H
    }
    flush()
  }
  flush()
  return pages
}

export class DocxTextExtractor implements TextExtractor {
  readonly format = 'docx' as const
  readonly extensions = ['.docx'] as const

  accepts(file: { name: string; type: string }): boolean {
    return hasExtension(file.name, '.docx') || file.type === DOCX_MIME
  }

  sniff(data: ArrayBuffer): string | null {
    if (isZip(data)) return null
    if (isOle(data))
      return 'This is a legacy Word 97–2003 file. Please save it as .docx or PDF and upload again.'
    return 'This file is not a valid Word document (missing the OOXML package signature).'
  }

  async extract(data: ArrayBuffer): Promise<PageText[]> {
    const { unzipSync } = await import('fflate')
    let files: Record<string, Uint8Array>
    try {
      files = unzipSync(new Uint8Array(data))
    } catch {
      throw new Error('the file is not a valid Word archive')
    }
    const xml = files['word/document.xml']
    if (!xml) throw new Error('word/document.xml is missing')
    return docxXmlToPages(new TextDecoder('utf-8').decode(xml))
  }
}
