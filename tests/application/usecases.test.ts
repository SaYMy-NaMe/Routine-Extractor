import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ExportRoutineUseCase,
  ImportError,
  ImportRoutineUseCase,
  LibraryError,
  RoutineLibraryUseCase,
  baseFileName,
  buildRoutineGrid,
  computeWorkload,
  type ExportData,
  type RoutineExporter,
  usedTimeSlots,
} from '../../src/application'
import { DEFAULT_EMPTY_DAY_SETTINGS, EMPTY_PROFILE } from '../../src/domain'
import { MemoryRoutineRepository, createExtractors } from '../../src/infrastructure'
import { ASHRAF_SCHEDULE, describeCell, fixtureBuffer, makeCell } from '../helpers/fixtures'
import { filterCellsByFaculty } from '../../src/application'

const fileOf = (name: string, bytes: ArrayBuffer, type = '') => ({
  name,
  type,
  size: bytes.byteLength,
  arrayBuffer: async () => bytes,
})

describe('ImportRoutineUseCase', () => {
  const useCase = new ImportRoutineUseCase(createExtractors())

  it('imports a .docx master routine', async () => {
    const imported = await useCase.execute(
      fileOf('routine.docx', fixtureBuffer('whole-routine-summer-2026.docx')),
    )
    expect(imported.format).toBe('docx')
    expect(filterCellsByFaculty(imported.result.cells, 'ASHRAF').map(describeCell)).toEqual(ASHRAF_SCHEDULE)
  })

  it('rejects empty, oversized, and unsupported files with friendly errors', async () => {
    await expect(useCase.execute(fileOf('x.pdf', new ArrayBuffer(0)))).rejects.toBeInstanceOf(ImportError)
    await expect(
      useCase.execute({ name: 'x.pdf', type: '', size: 99e6, arrayBuffer: async () => new ArrayBuffer(1) }),
    ).rejects.toThrow(/larger/)
    await expect(useCase.execute(fileOf('notes.txt', new ArrayBuffer(4)))).rejects.toThrow(/Unsupported/)
  })
})

describe('ExportRoutineUseCase', () => {
  const grid = buildRoutineGrid([makeCell('Sat', 690, 780, 'CSE 411', '6', 'N204')])
  const data: ExportData = {
    profile: { ...EMPTY_PROFILE, fullName: 'Ashrafur Rahman Chowdhury', semester: 'Summer 2026' },
    grid,
    columns: usedTimeSlots(grid),
    workload: computeWorkload(grid.slots),
    emptyDay: DEFAULT_EMPTY_DAY_SETTINGS,
  }
  const fake: RoutineExporter = {
    format: 'pdf',
    label: 'PDF',
    extension: 'pdf',
    mimeType: 'application/pdf',
    build: vi.fn(async () => new Blob(['x'])),
  }

  it('builds and saves with a profile-derived file name', async () => {
    const save = vi.fn()
    const name = await new ExportRoutineUseCase([fake], save).execute('pdf', data)
    expect(name).toBe('Ashrafur-Rahman-Chowdhury-Summer-2026-routine.pdf')
    expect(save).toHaveBeenCalledWith(expect.any(Blob), name)
    expect(baseFileName(EMPTY_PROFILE)).toBe('faculty-routine-routine')
  })

  it('refuses unknown formats and empty grids', async () => {
    const uc = new ExportRoutineUseCase([fake], vi.fn())
    await expect(uc.execute('docx', data)).rejects.toThrow(/No exporter/)
    await expect(uc.execute('pdf', { ...data, grid: { ...grid, slots: [] } })).rejects.toThrow(
      /at least one class/,
    )
  })
})

describe('RoutineLibraryUseCase', () => {
  afterEach(() => vi.useRealTimers())

  it('stores imports under normalised titles, replaces duplicates, and lists newest first', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'))
    const lib = new RoutineLibraryUseCase(new MemoryRoutineRepository())
    const imported = await new ImportRoutineUseCase(createExtractors()).execute(
      fileOf('routine.docx', fixtureBuffer('whole-routine-summer-2026.docx')),
    )
    const a = await lib.add(imported, '  summer 2026 ')
    expect(a.title).toBe('Summer 2026')
    expect(a.cellCount).toBe(664)
    const b = await lib.add(imported, 'SUMMER 2026')
    expect(b.id).toBe(a.id)
    vi.setSystemTime(new Date('2026-09-02T00:00:00Z'))
    await lib.add(imported, 'Fall 2026')
    expect((await lib.list()).map((m) => m.title)).toEqual(['Fall 2026', 'SUMMER 2026'])
    expect((await lib.get(a.id))?.parse.cells.length).toBe(664)
    await lib.remove(a.id)
    expect(await lib.get(a.id)).toBeNull()
    await expect(lib.add(imported, ' ')).rejects.toBeInstanceOf(LibraryError)
  })
})
