/**
 * DOCX → positioned text pages.
 *
 * A Word routine is a sequence of paragraphs and tables. We walk the OpenXML
 * body and lay the content out on synthetic "pages" — one per table — with
 * each table row on its own baseline and each column at a fixed x offset. The
 * result has the same shape as the PDF extraction, so `parseRoutinePages`
 * handles both formats without knowing which one it was fed.
 *
 * Only the tiny subset of WordprocessingML we need is handled (paragraphs,
 * tables, grid spans, line breaks), via regexes rather than a DOM parser so
 * the code runs identically in the browser and under Node tests.
 */

import { unzipSync } from 'fflate'
import type { PageText, TextItem } from './pdfText'

const COL_W = 100 // synthetic column pitch
const ROW_H = 60 // synthetic row pitch (must exceed the parser's 24pt row snap)
const LINE_H = 10 // pitch between paragraphs inside one cell

interface Cell {
  col: number
  lines: string[]
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#')
      return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1))
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** Text of one paragraph, split on explicit line breaks. */
function paragraphLines(p: string): string[] {
  const parts = p.split(/<w:br\b[^>]*\/>|<w:cr\b[^>]*\/>/)
  return parts
    .map((part) =>
      decode(
        part
          .replace(/<w:tab\b[^>]*\/>/g, ' ')
          .replace(/<w:t\b[^>]*>([^<]*)<\/w:t>|<[^>]+>/g, (_m, t: string | undefined) => t ?? ''),
      )
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
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

/** Decode the .docx zip and return its main document XML. */
export function readDocumentXml(data: ArrayBuffer): string {
  const files = unzipSync(new Uint8Array(data))
  const xml = files['word/document.xml']
  if (!xml) throw new Error('This .docx has no word/document.xml — is it a valid Word file?')
  return new TextDecoder('utf-8').decode(xml)
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

  // Top-level blocks only: a table's inner paragraphs are consumed with the table.
  const blocks = body.match(/<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g) ?? []
  for (const block of blocks) {
    if (!block.startsWith('<w:tbl')) {
      for (const line of paragraphLines(block)) {
        push(line, 40, line.length * 5, y)
        y += LINE_H * 1.5
      }
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
        for (const line of nonEmpty[0].lines) {
          push(line, 40, line.length * 5, y)
          y += LINE_H * 1.5
        }
        continue
      }
      for (const cell of cells) {
        cell.lines.forEach((line, i) => {
          const x = cell.col * COL_W + 30
          push(line, x, 40, y + i * LINE_H)
        })
      }
      y += ROW_H
    }
    flush()
  }
  flush()
  return pages
}

/** Browser/Node entry point: .docx bytes → positioned text pages. */
export async function extractDocxText(data: ArrayBuffer): Promise<PageText[]> {
  return docxXmlToPages(readDocumentXml(data))
}
