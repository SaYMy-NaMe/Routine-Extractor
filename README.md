# Faculty Routine Extractor & Generator

Upload the departmental master routine (PDF or Word), index it by semester, search a faculty
member, and get a clean personal weekly routine with a credit-workload summary — editable in the
grid and exportable as a single-page **PDF** or an editable **DOCX**. Parsing and rendering run
entirely in the browser.

![Vite](https://img.shields.io/badge/Vite-React%2019-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8) ![Tests](https://img.shields.io/badge/vitest-60%20passing-brightgreen)

## Scripts

```bash
npm run dev       # start the dev server
npm run build     # type-check (tsc -b) + production build
npm run test      # vitest — parser validated against the real Summer 2026 routine fixtures
npm run lint      # oxlint (correctness = error, zero warnings)
npx prettier --write .
```

## How it works

1. **Master routine library** — drop a `.pdf` / `.docx` / `.doc`. The file is validated in three
   layers (declared type → byte signature → layout pattern: day tables with time-slot headers and
   course cells), then you are prompted for a semester title (pre-filled from the document, e.g.
   "Summer 2026"). The parsed routine is stored permanently and listed in the library; an existing
   title is replaced. Selecting a routine loads it and **locks the Semester field** to its title.
2. **Faculty initial** — the search term is strictly the faculty initial (`ASHRAF`, `MHN`); the
   combobox ranks directory matches by exact initial, then prefix. An unambiguous match
   **auto-fills Full name, School and Institution** only; designation and every other field stay
   your own input. Clearing the initial immediately **erases** those three auto-filled fields.
3. **Grid** — sessions are projected onto Day × Time. **Each cell holds exactly one class**: the
   builder keeps the first parsed class per cell (and tells you how many were skipped), editors
   only offer free cells, and the reducer refuses to stack. Lab blocks fold into the theory column
   they overlap and **labs always print their explicit start–end timing**; a fixed
   **1:00 – 1:30 PM Break** column is laid out every day and automatically **waived on days where a
   lab runs through it** (e.g. 11:30 AM – 1:30 PM); the `6:30 PM – 9:30 PM` evening column is
   always present (theory = weekly, lab = alternating weeks); empty days show a full-width
   "No Class On this day" / "Weekend" badge.
   Toolbar: layout **Scale**, **+ Time slot**, **Reset**. Layout is automatic — cards on phones,
   a table on larger screens.
4. **Workload** — 3 credits per theory section, 1.5 per lab section; a section counts once.
5. **Export** — vector PDF (jsPDF) or editable DOCX, both sharing one template with the on-screen
   print sheet.

### Where routines are stored

By default the library lives in the browser's **IndexedDB** (persistent on that device). To share
one library with every user of a deployment, point the app at a routine API:

```bash
VITE_ROUTINE_API_URL=https://example.org/api npm run build
```

The HTTP adapter expects a small JSON contract — `GET /routines` (metadata list),
`GET|PUT|DELETE /routines/:id` (full routine, including the parsed content). Any backend that
speaks it (Supabase edge function, Express, Cloud Function) works; the app never touches storage
outside the `RoutineRepository` port.

> Legacy binary `.doc` (Word 97–2003) is accepted by the picker and sniffed, but there is no
> reliable browser-side table reader for that format: such files are rejected with a clear
> instruction to Save As `.docx` or PDF. Files named `.doc` that are really OOXML packages are read.

## Architecture

Clean Architecture; dependencies point inwards only.

```
src/
├─ domain/          Pure models & rules — no framework, no I/O
│  ├─ time.ts       minutes-since-midnight helpers, range parsing/formatting
│  ├─ schedule.ts   DayName, TimeSlot, ScheduleSlot, RoutineGrid, evening rules, cell occupancy
│  ├─ profile.ts    FacultyProfile + validation/coercion
│  ├─ workload.ts   CreditPolicy (Strategy), CourseWorkload, formatting
│  ├─ emptyDay.ts   empty-day badge rules & styling
│  ├─ document.ts   positioned text, parsed cells, faculty directory entries
│  └─ masterRoutine.ts  stored routine model, semester-title rules
├─ application/     Use cases, ports and pure logic
│  ├─ ports.ts      TextExtractor, RoutineExporter, RoutineRepository, KeyValueStorage, FileSaver
│  ├─ parse/        matrix state-machine parser, cell parser, faculty filter
│  ├─ faculty/      lookup engine (ranking + auto-fill resolution)
│  ├─ grid/         gridBuilder (cells → grid, one per cell), gridReducer (edits), selectors
│  ├─ workload/     credit calculator
│  └─ usecases/     ImportRoutine (3-layer validation), RoutineLibrary, ExportRoutine
├─ infrastructure/  Adapters implementing the ports
│  ├─ extractors/   PDF (pdfjs, lazy), DOCX (OpenXML), DOC (sniff + delegate), byte signatures, factory
│  ├─ exporters/    PdfExporter (jsPDF, lazy), DocxExporter (docx, lazy), shared template
│  ├─ repositories/ IndexedDB, HTTP, memory — chosen by factory
│  └─ storage/      BrowserStorage (defensive localStorage), MemoryStorage
└─ presentation/    React
   ├─ providers/    ServicesProvider (DI root), RoutineProvider (reducer + context store)
   ├─ toast/        ToastStore (observable) + Toaster
   ├─ hooks/        useRoutine, useServices, useToast, useTheme, useViewport
   ├─ components/   ui kit, ErrorBoundary
   ├─ features/     library · profile · grid · workload · preview · export
   └─ layout/       AppHeader
```

| Pattern                  | Where                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| **Strategy**             | `TextExtractor` (PDF / DOCX / DOC), `RoutineExporter`, `RoutineRepository`, `CreditPolicy`             |
| **Factory**              | `createExtractors`, `createExporters`, `createRoutineRepository` (env-driven), `createDefaultServices` |
| **Dependency Injection** | `ServicesProvider` → `useServices()`; tests inject memory adapters                                     |
| **Observer**             | `ToastStore` (`useSyncExternalStore`), React context store, `matchMedia` subscriptions                 |
| **Command / Reducer**    | `gridReducer`, `routineReducer` — every edit a pure, tested transition                                 |
| **State machine**        | `MatrixParser` over document lines; `ImportStatus` over the upload → name → store flow                 |

## Quality gates (FURPS+)

- **Functionality** — the ASHRAF Summer 2026 schedule is asserted cell-for-cell from both the PDF
  and the DOCX fixture; the 21-credit benchmark, occupancy rule, lookup ranking, sniffing and
  library behaviour, break waiving and lookup auto-erase are unit-tested (60 tests).
- **Usability** — responsive from 360 px phones to desktops, keyboard-accessible combobox and
  dialogs, ARIA live regions, toast feedback, dark mode.
- **Reliability** — three-layer import validation with user-facing `ImportError`s, defensive
  coercion of persisted data, `ErrorBoundary`, superseded-upload guarding, one-class-per-cell
  enforced in builder, editors and reducer.
- **Performance** — pdfjs, jsPDF, `docx`, `fflate` and the print sheet are lazy-loaded; PDF pages
  are read concurrently; parsed routines are stored so files are never re-read.
- **Supportability** — strict TypeScript, layered directories, documented modules, Prettier + oxlint.
