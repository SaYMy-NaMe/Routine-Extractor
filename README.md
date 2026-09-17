# Faculty Routine Extractor

Turn a departmental master routine into a personal weekly routine.

Upload the office's routine (PDF or Word), pick the semester, type a faculty initial, and get a
clean Day × Time grid with a credit-workload summary — editable on screen and exportable as a
**PDF** or an editable **Word document**. Everything runs in the browser; no file ever leaves the
device.

![Vite](https://img.shields.io/badge/Vite-React%2019-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8)
![Tests](https://img.shields.io/badge/vitest-64%20passing-brightgreen)

## Features

- **Master routine library** — upload `.pdf` / `.docx` / `.doc`, give it a semester title
  ("Fall 2026"), and it is stored in the browser's IndexedDB for good. Selecting a routine fills
  and locks the Semester field.
- **Strict file validation** — declared type, byte signature, and layout pattern are all checked;
  anything that is not a class routine is rejected with a clear message.
- **Faculty-initial lookup** — type an initial (`ASHRAF`, `MHN`) to pull that person's classes.
  Full name, school and institution are filled from the routine's faculty directory and cleared
  again the moment the initial is erased. Designation and contact details are always yours to type.
- **One class per cell** — the grid never stacks two classes in a slot; overlapping entries in the
  source are reported, not silently merged.
- **Labs and breaks** — labs always show their explicit start–end time. A fixed
  **1:00 – 1:30 PM break** column is laid out every day, and a lab that runs through it
  (e.g. 11:30 AM – 1:30 PM) becomes one merged block across both columns.
- **Evening column** — a pinned 6:30 – 9:30 PM slot with its own rules: theory meets weekly, labs
  on alternating weeks.
- **Empty days** — a full-width "No Class On this day" or "Weekend" badge.
- **Workload** — 3 credits per theory section, 1.5 per lab section; each section counts once.
- **Exports** — a vector PDF (searchable, one page whenever it fits, clean page breaks otherwise)
  and a structured DOCX, both in the same executive layout as the on-screen print preview.
- **Responsive** — cards on phones, a scalable table on tablets and desktops; dark mode.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command                  | What it does                                   |
| ------------------------ | ---------------------------------------------- |
| `npm run build`          | Type-check (`tsc -b`) and build for production |
| `npm run preview`        | Serve the production build locally             |
| `npm run test`           | Run the Vitest suite                           |
| `npm run lint`           | Run oxlint (correctness rules are errors)      |
| `npx prettier --write .` | Format the codebase                            |

## Using the app

1. **Upload a master routine.** Drop the file into the library card. After it is parsed you are
   asked for a semester title (pre-filled from the document when it can be detected). Uploading a
   file under an existing title replaces that routine.
2. **Select a routine.** Click a library entry — its title becomes the Semester on the routine.
3. **Enter the faculty initial.** The combobox suggests initials from the routine's faculty table.
   Matching classes appear in the grid; name, school and institution are filled in.
4. **Complete the header.** Designation, department, email and phone are free text.
5. **Adjust the grid.** Tap a class to edit it or an empty cell to add one, add a time column with
   **+ Time slot**, scale the layout, or **Reset** to the parsed routine.
6. **Export.** Download the PDF or Word file, or print the preview.

### Supported files

| Format  | Notes                                                                                                                                  |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `.pdf`  | Text-based (not scanned) exports of the routine                                                                                        |
| `.docx` | The Word master file itself                                                                                                            |
| `.doc`  | Accepted and sniffed; a file that is really OOXML is read, a binary Word 97–2003 file is refused with a "Save As .docx or PDF" message |

The parser expects one table per day with a time-slot header row and `COURSE / INITIAL` cells:

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

Tables that continue across pages and in-cell overrides such as `CSE 215.1 (11.30-1.30)` are
handled.

## Where routines are stored

By default the library lives in the browser's **IndexedDB**, so it persists on that device across
sessions. To share one library between all users of a deployment, point the app at a routine API
at build time:

```bash
VITE_ROUTINE_API_URL=https://example.org/api npm run build
```

The HTTP adapter expects a small JSON contract:

| Method   | Path            | Body / response                          |
| -------- | --------------- | ---------------------------------------- |
| `GET`    | `/routines`     | `MasterRoutineMeta[]`                    |
| `GET`    | `/routines/:id` | `MasterRoutine` (metadata + parsed data) |
| `PUT`    | `/routines/:id` | `MasterRoutine`                          |
| `DELETE` | `/routines/:id` | —                                        |

Any backend that speaks it works; the app never touches storage outside the `RoutineRepository`
port.

## Architecture

The code follows Clean Architecture — dependencies point inwards only
(`presentation → application → domain`, with `infrastructure` plugged in behind application ports).

```
src/
├─ domain/            Pure models and rules — no framework, no I/O
│  ├─ time.ts         minutes-since-midnight helpers, range parsing/formatting
│  ├─ schedule.ts     days, time slots, sessions, grid, evening/break rules, cell occupancy
│  ├─ profile.ts      FacultyProfile, validation, coercion
│  ├─ workload.ts     CreditPolicy (Strategy), workload model, text conventions
│  ├─ emptyDay.ts     empty-day badge rules and styling
│  ├─ document.ts     positioned text, parsed cells, faculty directory entries
│  └─ masterRoutine.ts  stored-routine model, semester-title rules
├─ application/       Use cases, ports and pure logic
│  ├─ ports.ts        TextExtractor, RoutineExporter, RoutineRepository, KeyValueStorage, FileSaver
│  ├─ parse/          matrix state-machine parser, cell parser, faculty filter
│  ├─ faculty/        initial lookup and auto-fill resolution
│  ├─ grid/           gridBuilder, gridReducer, selectors (row layout, merging, breaks)
│  ├─ workload/       credit calculator
│  └─ usecases/       ImportRoutine, RoutineLibrary, ExportRoutine
├─ infrastructure/    Adapters implementing the ports
│  ├─ extractors/     PDF (pdfjs), DOCX (OpenXML), DOC (sniff + delegate), byte signatures
│  ├─ exporters/      PdfExporter (jsPDF), DocxExporter (docx), shared template tokens
│  ├─ repositories/   IndexedDB, HTTP and in-memory routine stores
│  └─ storage/        localStorage and in-memory key-value stores
└─ presentation/      React
   ├─ providers/      ServicesProvider (DI root), RoutineProvider (reducer + context store)
   ├─ hooks/          useRoutine, useServices, useFacultyInitial, useToast, useTheme, useViewport
   ├─ toast/          observable ToastStore and Toaster
   ├─ components/     UI kit and ErrorBoundary
   ├─ features/       library · profile · grid · workload · preview · export
   └─ layout/         AppHeader
```

| Pattern              | Where                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Strategy             | `TextExtractor` (PDF / DOCX / DOC), `RoutineExporter`, `RoutineRepository`, `CreditPolicy` |
| Factory              | `createExtractors`, `createExporters`, `createRoutineRepository`, `createDefaultServices`  |
| Dependency injection | `ServicesProvider` → `useServices()`; tests inject in-memory adapters                      |
| Observer             | `ToastStore` via `useSyncExternalStore`, the context store, `matchMedia` subscriptions     |
| Command / reducer    | `gridReducer` and `routineReducer` — every edit is a pure, tested transition               |
| State machine        | `MatrixParser` over document lines; `ImportStatus` over upload → title → store             |

Heavy libraries (pdfjs, jsPDF, `docx`, `fflate`) and the print sheet are loaded lazily, so the
initial bundle stays small.

## Testing

`npm run test` runs 64 Vitest specs organised by layer. The parser is validated cell-for-cell
against a real Summer 2026 routine in both PDF and DOCX form (`tests/fixtures/`), and the suites
cover the workload benchmark, one-class-per-cell rules, break waiving and cell merging, file
sniffing, the routine library, the lookup engine, export conventions and the state reducers.
