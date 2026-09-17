import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PageText, ParsedCell } from '../../src/domain'
import { collectPages } from '../../src/infrastructure'

export const fixturePath = (name: string) => resolve(__dirname, '..', 'fixtures', name)

export function fixtureBuffer(name: string): ArrayBuffer {
  const b = readFileSync(fixturePath(name))
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
}

/** Uses pdfjs' legacy build so the fixture can be read under Node. */
export async function pdfFixturePages(name: string): Promise<PageText[]> {
  const data = new Uint8Array(fixtureBuffer(name))
  return collectPages(await getDocument({ data, verbosity: 0 }).promise)
}

export const describeCell = (c: ParsedCell) =>
  `${c.day} ${c.slotLabel} ${c.courseCode}.${c.section} ${c.room} ${c.tableKind}`

/** The reference Summer 2026 schedule for the short form ASHRAF. */
export const ASHRAF_SCHEDULE = [
  'Sat 11.30-1.00 CSE 411.6 N204 theory',
  'Sat 1.30-3.00 CSE 443.3 N604 theory',
  'Sat 3.30-5.30 CSE 112.7 N607 lab',
  'Mon 11.30-1.00 CSE 443.1 311 theory',
  'Mon 3.00-4.30 CSE 411.5 N203 theory',
  'Tue 3.00-4.30 CSE 443.2 114 theory',
  'Tue 4.30-6.00 CSE 443.1 111 theory',
  'Wed 10.00-11.30 CSE 411.5 N604 theory',
  'Wed 11.30-1.00 CSE 411.6 N601 theory',
  'Thu 11.30-1.00 CSE 443.2 N601 theory',
  'Thu 1.30-3.00 CSE 443.3 N204 theory',
  'Thu 3.30-5.30 CSE 226.5 115 lab',
]

export function makeCell(
  day: ParsedCell['day'],
  startMin: number,
  endMin: number,
  courseCode: string,
  section: string,
  room: string,
  tableKind: ParsedCell['tableKind'] = 'theory',
): ParsedCell {
  return {
    day,
    tableKind,
    room,
    slotLabel: '',
    startMin,
    endMin,
    rawText: `${courseCode}.${section} / ASHRAF`,
    courseCode,
    section,
    facultyTag: 'ASHRAF',
    page: 1,
  }
}
