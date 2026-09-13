import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  DayName,
  FacultyProfile,
  OffDayStatus,
  ParseResult,
  RoutineGrid,
  ScheduleSlot,
  TimeSlot,
} from '../types/routine'
import { DAYS, EMPTY_PROFILE, defaultFrequency } from '../types/routine'
import { filterCellsByFaculty, lookupFacultyName, parseRoutinePages } from '../services/pdfParser'
import { extractDocxText } from '../services/docxText'
import { extractPdfText } from '../services/pdfText'
import { buildRoutineGrid, computeOffDays, makeTimeSlot, newSlotId } from '../services/routineBuilder'
import { computeWorkload } from '../services/workloadCalculator'

export type FileStatus =
  | { kind: 'idle' }
  | { kind: 'parsing'; fileName: string }
  | { kind: 'ready'; fileName: string; format: 'pdf' | 'docx'; pageCount: number; cellCount: number }
  | { kind: 'error'; fileName: string; message: string }

const PROFILE_KEY = 'fre-profile'

function loadProfile(): FacultyProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (raw) return { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Partial<FacultyProfile>) }
  } catch {
    /* ignore */
  }
  return EMPTY_PROFILE
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function detectFileKind(file: File): 'pdf' | 'docx' | null {
  if (/\.docx$/i.test(file.name) || file.type === DOCX_MIME) return 'docx'
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') return 'pdf'
  return null
}

/** Strip "Mr."/"Dr." style honorifics from directory names for the headline. */
function cleanName(name: string): string {
  return name.replace(/^(mr|mrs|ms|dr|prof|engr|md)\.?\s+/i, '').trim()
}

export function useRoutineState() {
  const [status, setStatus] = useState<FileStatus>({ kind: 'idle' })
  const [parse, setParse] = useState<ParseResult | null>(null)
  const [profile, setProfileState] = useState<FacultyProfile>(loadProfile)
  const [grid, setGrid] = useState<RoutineGrid | null>(null)
  const [courseTitles, setCourseTitles] = useState<Record<string, string>>({})
  const [weekendDays, setWeekendDays] = useState<DayName[]>(['Fri'])
  const [showEmptyColumns, setShowEmptyColumns] = useState(false)
  const parseSeq = useRef(0)

  const setProfile = useCallback((patch: Partial<FacultyProfile>) => {
    setProfileState((p) => {
      const next = { ...p, ...patch }
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  /* ---------------------------------------------------------------------- */
  /* File → parse                                                           */
  /* ---------------------------------------------------------------------- */

  const loadFile = useCallback(async (file: File) => {
    const seq = ++parseSeq.current
    setStatus({ kind: 'parsing', fileName: file.name })
    try {
      const kind = detectFileKind(file)
      if (!kind) throw new Error('Unsupported file. Please drop the routine as a .pdf or .docx file.')
      const bytes = await file.arrayBuffer()
      const pages = kind === 'docx' ? await extractDocxText(bytes) : await extractPdfText(bytes)
      const result = parseRoutinePages(pages)
      if (seq !== parseSeq.current) return
      setParse(result)
      setStatus({
        kind: 'ready',
        fileName: file.name,
        format: kind,
        pageCount: result.pageCount,
        cellCount: result.cells.length,
      })
      if (!result.cells.length) {
        setStatus({
          kind: 'error',
          fileName: file.name,
          message: result.warnings[0] ?? 'No routine matrix found in this file.',
        })
      }
    } catch (err) {
      if (seq !== parseSeq.current) return
      setStatus({
        kind: 'error',
        fileName: file.name,
        message: err instanceof Error ? err.message : 'Could not read this file.',
      })
    }
  }, [])

  const reset = useCallback(() => {
    parseSeq.current += 1
    setStatus({ kind: 'idle' })
    setParse(null)
    setGrid(null)
  }, [])

  /* ---------------------------------------------------------------------- */
  /* Search → grid (re-extracted whenever the query or the file changes)    */
  /* ---------------------------------------------------------------------- */

  const matches = useMemo(
    () => (parse ? filterCellsByFaculty(parse.cells, profile.searchQuery) : []),
    [parse, profile.searchQuery],
  )

  const theoryColumns = useMemo(
    () => (parse ? parse.columns.filter((c) => c.kind === 'theory') : []),
    [parse],
  )

  const rebuildGrid = useCallback(() => {
    if (!parse) {
      setGrid(null)
      return
    }
    setGrid(buildRoutineGrid(matches, { weekendDays, theoryColumns }))
  }, [parse, matches, weekendDays, theoryColumns])

  useEffect(() => {
    rebuildGrid()
  }, [rebuildGrid])

  // Auto-fill semester / name from the PDF when the user hasn't typed them.
  useEffect(() => {
    if (!parse) return
    const patch: Partial<FacultyProfile> = {}
    if (!profile.semester && parse.semesterHint) patch.semester = parse.semesterHint
    if (Object.keys(patch).length) setProfile(patch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parse])

  useEffect(() => {
    if (!parse || !profile.searchQuery) return
    const name = lookupFacultyName(parse.facultyDirectory, profile.searchQuery)
    if (name && !profile.fullName) setProfile({ fullName: cleanName(name) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parse, profile.searchQuery])

  /* ---------------------------------------------------------------------- */
  /* Grid editing                                                           */
  /* ---------------------------------------------------------------------- */

  const updateGrid = useCallback((fn: (g: RoutineGrid) => RoutineGrid) => {
    setGrid((g) => (g ? fn(g) : g))
  }, [])

  const upsertSlot = useCallback(
    (slot: ScheduleSlot) =>
      updateGrid((g) => {
        const column = g.timeSlots.find((t) => t.id === slot.slotId)
        const next: ScheduleSlot = column?.evening
          ? { ...slot, frequency: slot.frequency ?? defaultFrequency(slot.type) }
          : slot
        const exists = g.slots.some((s) => s.id === next.id)
        const slots = exists ? g.slots.map((s) => (s.id === next.id ? next : s)) : [...g.slots, next]
        // A class in the evening cell clears any "off" marker on it.
        const eveningOff = column?.evening ? g.eveningOff.filter((d) => d !== next.day) : g.eveningOff
        return {
          ...g,
          slots,
          eveningOff,
          offDays: mergeOffDays(g.offDays, computeOffDays(slots, weekendDays)),
        }
      }),
    [updateGrid, weekendDays],
  )

  /** Toggle the "off" marker on a day's evening cell (removes any class in it when set). */
  const setEveningOff = useCallback(
    (day: DayName, off: boolean) =>
      updateGrid((g) => {
        const evening = g.timeSlots.find((t) => t.evening)
        const slots =
          off && evening ? g.slots.filter((s) => !(s.day === day && s.slotId === evening.id)) : g.slots
        const eveningOff = off ? [...new Set([...g.eveningOff, day])] : g.eveningOff.filter((d) => d !== day)
        return {
          ...g,
          slots,
          eveningOff,
          offDays: mergeOffDays(g.offDays, computeOffDays(slots, weekendDays)),
        }
      }),
    [updateGrid, weekendDays],
  )

  const removeSlot = useCallback(
    (id: string) =>
      updateGrid((g) => {
        const slots = g.slots.filter((s) => s.id !== id)
        return { ...g, slots, offDays: mergeOffDays(g.offDays, computeOffDays(slots, weekendDays)) }
      }),
    [updateGrid, weekendDays],
  )

  const setOffDay = useCallback(
    (day: DayName, status: OffDayStatus) =>
      updateGrid((g) => ({ ...g, offDays: { ...g.offDays, [day]: status } })),
    [updateGrid],
  )

  const addTimeSlot = useCallback(
    (startMin: number, endMin: number) =>
      updateGrid((g) => {
        const slot = makeTimeSlot(startMin, endMin)
        if (g.timeSlots.some((t) => t.id === slot.id)) return g
        return { ...g, timeSlots: [...g.timeSlots, slot].sort((a, b) => a.startMin - b.startMin) }
      }),
    [updateGrid],
  )

  const removeTimeSlot = useCallback(
    (id: string) =>
      updateGrid((g) => {
        if (g.timeSlots.find((t) => t.id === id)?.evening) return g // the evening column is pinned
        return {
          ...g,
          timeSlots: g.timeSlots.filter((t) => t.id !== id),
          slots: g.slots.filter((s) => s.slotId !== id),
        }
      }),
    [updateGrid],
  )

  const newManualSlot = useCallback(
    (day: DayName, column: TimeSlot): ScheduleSlot => ({
      id: newSlotId(),
      day,
      slotId: column.id,
      courseCode: '',
      section: '',
      room: '',
      type: 'theory',
      startMin: column.startMin,
      endMin: column.endMin,
      facultyTag: profile.searchQuery.toUpperCase(),
      source: 'manual',
      ...(column.evening ? { frequency: defaultFrequency('theory') } : {}),
    }),
    [profile.searchQuery],
  )

  const setCourseTitle = useCallback((code: string, title: string) => {
    setCourseTitles((t) => ({ ...t, [code]: title }))
  }, [])

  const workload = useMemo(
    () => computeWorkload(grid?.slots ?? [], { titles: courseTitles }),
    [grid, courseTitles],
  )

  const directoryTags = useMemo(() => (parse ? Object.keys(parse.facultyDirectory).sort() : []), [parse])

  return {
    status,
    parse,
    profile,
    setProfile,
    grid,
    matches,
    workload,
    courseTitles,
    setCourseTitle,
    weekendDays,
    setWeekendDays,
    showEmptyColumns,
    setShowEmptyColumns,
    directoryTags,
    loadFile,
    reset,
    rebuildGrid,
    upsertSlot,
    removeSlot,
    setOffDay,
    setEveningOff,
    addTimeSlot,
    removeTimeSlot,
    newManualSlot,
  }
}

export type RoutineState = ReturnType<typeof useRoutineState>

/** Keep a user's explicit off-day choice on days that are still empty. */
function mergeOffDays(
  prev: Record<DayName, OffDayStatus>,
  next: Record<DayName, OffDayStatus>,
): Record<DayName, OffDayStatus> {
  const out = { ...next }
  for (const d of DAYS) {
    if (next[d] !== 'none' && prev[d] !== 'none') out[d] = prev[d]
  }
  return out
}
