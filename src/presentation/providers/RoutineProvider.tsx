/**
 * Routine store: a `useReducer` wrapped in context (React's subscription model
 * gives us the Observer pattern for free). Side effects — the library,
 * file import, faculty auto-fill, profile persistence, grid rebuilds —
 * live here so components stay declarative.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { EMPTY_WORKLOAD, coerceProfile, defaultFrequency } from '../../domain'
import {
  ExportError,
  type FileLike,
  ImportError,
  LibraryError,
  buildRoutine,
  computeWorkload,
  filterCellsByFaculty,
  newSlotId,
  resolveFaculty,
} from '../../application'
import { useServices } from '../hooks/useServices'
import { RoutineContext, type RoutineActions, type RoutineContextValue } from './routineContext'
import { initialState, routineReducer } from './routineState'

const PROFILE_KEY = 'profile'
const ACTIVE_KEY = 'activeRoutine'

/** User-facing message for an error raised by a use case. */
function describeError(err: unknown, fallback: string): string {
  if (err instanceof ImportError || err instanceof LibraryError || err instanceof ExportError)
    return err.message
  return fallback
}

export function RoutineProvider({ children }: { children: ReactNode }) {
  const { importRoutine, library, storage, toasts } = useServices()
  const [state, dispatch] = useReducer(routineReducer, undefined, () =>
    initialState(coerceProfile(storage.get(PROFILE_KEY))),
  )
  const importSeq = useRef(0)
  const parse = state.library.active?.parse ?? null
  const { profile } = state

  /* ---- derived data ---------------------------------------------------- */

  const matches = useMemo(
    () => (parse ? filterCellsByFaculty(parse.cells, profile.searchQuery) : []),
    [parse, profile.searchQuery],
  )
  const theoryColumns = useMemo(
    () => (parse ? parse.columns.filter((c) => c.kind === 'theory') : []),
    [parse],
  )
  const workload = useMemo(
    () =>
      state.grid.slots.length
        ? computeWorkload(state.grid.slots, { titles: state.courseTitles })
        : EMPTY_WORKLOAD,
    [state.grid.slots, state.courseTitles],
  )
  const directory = useMemo(() => parse?.facultyDirectory ?? [], [parse])

  /* ---- library ----------------------------------------------------------- */

  const refreshLibrary = useCallback(async () => {
    dispatch({ type: 'library/loading' })
    try {
      dispatch({ type: 'library/loaded', routines: await library.list() })
    } catch (err) {
      dispatch({ type: 'library/error', message: describeError(err, 'Could not load the stored routines.') })
    }
  }, [library])

  const selectRoutine = useCallback(
    async (id: string | null) => {
      if (!id) {
        storage.remove(ACTIVE_KEY)
        dispatch({ type: 'library/activate', routine: null })
        return
      }
      try {
        const routine = await library.get(id)
        if (!routine) {
          toasts.notify('error', 'That routine is no longer available.')
          await refreshLibrary()
          return
        }
        storage.set(ACTIVE_KEY, id)
        dispatch({ type: 'library/activate', routine })
      } catch (err) {
        toasts.notify('error', describeError(err, 'Could not open that routine.'))
      }
    },
    [library, storage, toasts, refreshLibrary],
  )

  // Load the library once and re-open the last selected routine.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await refreshLibrary()
      const last = storage.get<string>(ACTIVE_KEY)
      if (last && !cancelled) await selectRoutine(last)
    })()
    return () => {
      cancelled = true
    }
  }, [refreshLibrary, selectRoutine, storage])

  /* ---- import flow ----------------------------------------------------- */

  const loadFile = useCallback(
    async (file: FileLike) => {
      const seq = ++importSeq.current
      dispatch({ type: 'import/reading', fileName: file.name })
      try {
        const imported = await importRoutine.execute(file)
        if (seq !== importSeq.current) return
        dispatch({ type: 'import/naming', imported, suggestedTitle: imported.result.semesterHint ?? '' })
      } catch (err) {
        if (seq !== importSeq.current) return
        dispatch({ type: 'import/done' })
        toasts.notify('error', describeError(err, 'Something went wrong while reading the file.'))
      }
    },
    [importRoutine, toasts],
  )

  const confirmImport = useCallback(
    async (title: string) => {
      if (state.importStatus.kind !== 'naming') return
      const { imported } = state.importStatus
      dispatch({ type: 'import/saving', fileName: imported.fileName })
      try {
        const routine = await library.add(imported, title)
        dispatch({ type: 'import/done' })
        await refreshLibrary()
        storage.set(ACTIVE_KEY, routine.id)
        dispatch({ type: 'library/activate', routine })
        toasts.notify('success', `Saved "${routine.title}" to the routine library.`)
      } catch (err) {
        dispatch({ type: 'import/naming', imported, suggestedTitle: title })
        toasts.notify('error', describeError(err, 'Could not store the routine.'))
      }
    },
    [state.importStatus, library, refreshLibrary, storage, toasts],
  )

  const activeId = state.library.active?.id ?? null
  const deleteRoutine = useCallback(
    async (id: string) => {
      try {
        await library.remove(id)
        if (activeId === id) {
          storage.remove(ACTIVE_KEY)
          dispatch({ type: 'library/activate', routine: null })
        }
        await refreshLibrary()
        toasts.notify('info', 'Routine removed from the library.')
      } catch (err) {
        toasts.notify('error', describeError(err, 'Could not remove the routine.'))
      }
    },
    [library, activeId, refreshLibrary, storage, toasts],
  )

  /* ---- grid ---------------------------------------------------------------- */

  const resetGrid = useCallback(() => {
    if (!parse) return
    const { grid, skipped } = buildRoutine(matches, { weekendDays: state.weekendDays, theoryColumns })
    dispatch({ type: 'grid/replace', grid })
    if (skipped.length) {
      toasts.notify(
        'info',
        `${skipped.length} overlapping class${skipped.length === 1 ? ' was' : 'es were'} skipped — each cell holds one class.`,
      )
    }
  }, [parse, matches, state.weekendDays, theoryColumns, toasts])

  useEffect(() => {
    resetGrid()
  }, [resetGrid])

  /* ---- profile: persistence + auto-fill ------------------------------------ */

  useEffect(() => {
    storage.set(PROFILE_KEY, state.profile)
  }, [storage, state.profile])

  useEffect(() => {
    if (!parse || !profile.searchQuery.trim()) return
    const match = resolveFaculty(parse, profile.searchQuery)
    if (!match || match.entry.shortForm === state.autoFilledTag) return
    dispatch({ type: 'profile/autoFilled', tag: match.entry.shortForm, patch: match.fields })
  }, [parse, profile.searchQuery, state.autoFilledTag])

  /* ---- actions ------------------------------------------------------------- */

  const actions = useMemo<RoutineActions>(
    () => ({
      loadFile,
      confirmImport,
      cancelImport: () => {
        importSeq.current += 1
        dispatch({ type: 'import/done' })
      },
      selectRoutine,
      deleteRoutine,
      refreshLibrary,
      patchProfile: (patch) => dispatch({ type: 'profile/patch', patch }),
      setCourseTitle: (courseCode, title) => dispatch({ type: 'titles/set', courseCode, title }),
      setWeekendDays: (days) => dispatch({ type: 'weekend/set', days }),
      resetGrid,
      upsertSlot: (slot) => dispatch({ type: 'grid/upsertSlot', slot }),
      removeSlot: (id) => dispatch({ type: 'grid/removeSlot', id }),
      setOffDay: (day, status) => dispatch({ type: 'grid/setOffDay', day, status }),
      setEveningOff: (day, off) => dispatch({ type: 'grid/setEveningOff', day, off }),
      addTimeSlot: (range) => dispatch({ type: 'grid/addTimeSlot', range }),
      removeTimeSlot: (id) => dispatch({ type: 'grid/removeTimeSlot', id }),
      newManualSlot: (day, column) => ({
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
    }),
    [loadFile, confirmImport, selectRoutine, deleteRoutine, refreshLibrary, resetGrid, profile.searchQuery],
  )

  const value = useMemo<RoutineContextValue>(
    () => ({ state, matches, workload, directory, semesterLocked: state.library.active !== null, actions }),
    [state, matches, workload, directory, actions],
  )
  return <RoutineContext.Provider value={value}>{children}</RoutineContext.Provider>
}
