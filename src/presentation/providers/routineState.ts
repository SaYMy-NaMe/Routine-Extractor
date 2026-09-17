/**
 * Application state and its reducer. Grid edits are delegated to the pure
 * `gridReducer`; the library, import flow, profile and titles are handled
 * here. Kept free of React so it can be unit-tested directly.
 */

import {
  type DayName,
  EMPTY_PROFILE,
  type FacultyProfile,
  type MasterRoutine,
  type MasterRoutineMeta,
  type RoutineGrid,
} from '../../domain'
import {
  DEFAULT_WEEKEND,
  EMPTY_GRID,
  type GridAction,
  type ImportedRoutine,
  gridReducer,
} from '../../application'

/** Lifecycle of the upload → title → store flow. */
export type ImportStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'reading'; readonly fileName: string }
  /** Parsed successfully; waiting for the user to give it a semester title. */
  | { readonly kind: 'naming'; readonly imported: ImportedRoutine; readonly suggestedTitle: string }
  | { readonly kind: 'saving'; readonly fileName: string }

export interface LibraryState {
  readonly loading: boolean
  readonly routines: readonly MasterRoutineMeta[]
  /** The selected master routine, with its parsed content. */
  readonly active: MasterRoutine | null
  readonly error: string | null
}

export interface RoutineState {
  readonly library: LibraryState
  readonly importStatus: ImportStatus
  readonly profile: FacultyProfile
  /** Short form whose directory match last populated the profile (prevents re-filling on every keystroke). */
  readonly autoFilledTag: string | null
  /** Which profile fields that match supplied; everything else stays the user's own input. */
  readonly autoFilledFields: readonly (keyof FacultyProfile)[]
  readonly grid: RoutineGrid
  readonly courseTitles: Readonly<Record<string, string>>
  readonly weekendDays: readonly DayName[]
}

export type RoutineAction =
  | GridAction
  | { type: 'library/loading' }
  | { type: 'library/loaded'; routines: readonly MasterRoutineMeta[] }
  | { type: 'library/error'; message: string }
  | { type: 'library/activate'; routine: MasterRoutine | null }
  | { type: 'import/reading'; fileName: string }
  | { type: 'import/naming'; imported: ImportedRoutine; suggestedTitle: string }
  | { type: 'import/saving'; fileName: string }
  | { type: 'import/done' }
  | { type: 'profile/patch'; patch: Partial<FacultyProfile> }
  | { type: 'profile/autoFilled'; tag: string; patch: Partial<FacultyProfile> }
  | { type: 'titles/set'; courseCode: string; title: string }
  | { type: 'weekend/set'; days: readonly DayName[] }

export function initialState(profile: FacultyProfile = EMPTY_PROFILE): RoutineState {
  return {
    library: { loading: true, routines: [], active: null, error: null },
    importStatus: { kind: 'idle' },
    profile,
    autoFilledTag: null,
    autoFilledFields: [],
    grid: EMPTY_GRID,
    courseTitles: {},
    weekendDays: DEFAULT_WEEKEND,
  }
}

export function routineReducer(state: RoutineState, action: RoutineAction): RoutineState {
  switch (action.type) {
    case 'library/loading':
      return { ...state, library: { ...state.library, loading: true, error: null } }
    case 'library/loaded':
      return {
        ...state,
        library: { ...state.library, loading: false, routines: action.routines, error: null },
      }
    case 'library/error':
      return { ...state, library: { ...state.library, loading: false, error: action.message } }
    case 'library/activate': {
      const active = action.routine
      // The semester is owned by the selected master routine.
      const profile = active ? { ...state.profile, semester: active.title } : state.profile
      return {
        ...state,
        library: { ...state.library, active },
        profile,
        autoFilledTag: null,
        autoFilledFields: [],
        grid: active ? state.grid : EMPTY_GRID,
      }
    }
    case 'import/reading':
      return { ...state, importStatus: { kind: 'reading', fileName: action.fileName } }
    case 'import/naming':
      return {
        ...state,
        importStatus: { kind: 'naming', imported: action.imported, suggestedTitle: action.suggestedTitle },
      }
    case 'import/saving':
      return { ...state, importStatus: { kind: 'saving', fileName: action.fileName } }
    case 'import/done':
      return { ...state, importStatus: { kind: 'idle' } }
    case 'profile/patch':
      return { ...state, profile: { ...state.profile, ...action.patch } }
    case 'profile/autoFilled':
      return {
        ...state,
        profile: { ...state.profile, ...action.patch },
        autoFilledTag: action.tag,
        autoFilledFields: Object.keys(action.patch) as (keyof FacultyProfile)[],
      }
    case 'titles/set':
      return { ...state, courseTitles: { ...state.courseTitles, [action.courseCode]: action.title } }
    case 'weekend/set':
      return { ...state, weekendDays: action.days }
    default:
      if (action.type.startsWith('grid/')) {
        const grid = gridReducer(state.grid, action as GridAction, { weekendDays: state.weekendDays })
        return grid === state.grid ? state : { ...state, grid }
      }
      return state
  }
}
