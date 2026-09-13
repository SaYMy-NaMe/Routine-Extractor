# Faculty Routine Extractor & Generator

Drop the departmental routine (PDF or Word .docx), type a faculty short form (e.g. `ASHRAF`), and get a
clean personal weekly routine with a credit-workload summary — exportable as **PDF** or
**DOCX**. Everything runs in the browser; the PDF never leaves your machine.

![flow](https://img.shields.io/badge/Vite-React%2019-blue) ![ts](https://img.shields.io/badge/TypeScript-strict-blue) ![tw](https://img.shields.io/badge/Tailwind-v4-38bdf8)

## How it works

1. **Parse** — `pdfjs-dist` extracts positioned text from a PDF; `src/services/docxText.ts` walks the
   OpenXML tables of a `.docx` and lays them out as the same positioned text. `src/services/pdfParser.ts`
   detects day headings, "Theory / Lab Classes" sections and time-slot header rows, then snaps
   every cell to its room (y) and time column (x). Tables that continue across pages are handled.
2. **Filter** — cells are matched on the faculty short form (exact token match, with a substring
   fallback). The "Faculty Members" table is used to auto-fill the full name.
3. **Project** — `src/services/routineBuilder.ts` folds the matches onto a Day × Time grid.
   Lab blocks (e.g. 3:30–5:30 PM) are folded into the theory column they overlap most, and empty
   days get a `NO CLASS ON THIS DAY` / `WEEKEND` badge.
4. **Compute** — `src/services/workloadCalculator.ts`: theory = 3 credits/section,
   lab = 1.5 credits/section; a section counts once regardless of weekly meetings.
5. **Edit** — click any chip to change course, section, room, type or time; hover an empty cell
   to add a class; add/remove time columns; cycle off-day badges.
6. **Export** — `src/services/exportService.ts` renders a single-page landscape PDF (vector text
   via jsPDF) and a Word document (`docx`).

## Scripts

```bash
npm run dev      # start dev server
npm run build    # type-check + production build
npm run test     # vitest (parser is validated against tests/fixtures/whole-routine-summer-2026.pdf)
npm run lint     # oxlint
npx prettier --write .
```

## Input format

The parser expects a text-based (not scanned) routine laid out as one table per day:

```
Saturday
Theory Classes
      | 8.30-10.00 | 10.00-11.30 | 11.30-1.00 | ...
103   | EEE 111.5  | MATH 207.5  | PHY 101.4  | ...
      | TK         | SWAPNIL     | RHN        |
Lab Classes
      | 9.30-11.30 | 11.30-1.30 | 1.30-3.30 | 3.30-5.30
N607  |            |            | CSE 112.9 | CSE 112.7
      |            |            | FARJANA   | ASHRAF
```

Both the Word master file and its PDF export are accepted. In-cell time overrides such as
`CSE 215.1 (11.30-1.30)` are honoured.

## Validation

`tests/pdfParser.test.ts` asserts the exact Summer 2026 schedule for `ASHRAF` (12 sessions,
rooms and slots) and the workload engine reproduces the reference 21-credit load
(CSE 443 ×3, CSE 411 ×3, CSE 226 lab, CSE 112 lab).
