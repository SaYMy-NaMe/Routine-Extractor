import { createContext } from 'react'
import type {
  DayName,
  FacultyDirectoryEntry,
  FacultyProfile,
  ParsedCell,
  RoutineGrid,
  ScheduleSlot,
  TimeRange,
  TimeSlot,
  WorkloadSummary,
} from '../../domain'
import type { AutoFillFields, FileLike } from '../../application'
import type { RoutineState } from './routineState'

export interface RoutineActions {
  /** Read and validate a file; on success the UI asks for a semester title. */
  loadFile(file: FileLike): Promise<void>
  /** Store the pending import under this title and make it the active routine. */
  confirmImport(title: string): Promise<void>
  cancelImport(): void
  selectRoutine(id: string | null): Promise<void>
  deleteRoutine(id: string): Promise<void>
  refreshLibrary(): Promise<void>
  patchProfile(patch: Partial<FacultyProfile>): void
  /** Fill the lookup-owned fields from a resolved initial. */
  applyAutoFill(tag: string, fields: AutoFillFields): void
  /** Reset the lookup-owned fields to empty strings. */
  eraseAutoFill(keys: readonly (keyof FacultyProfile)[]): void
  setCourseTitle(courseCode: string, title: string): void
  setWeekendDays(days: readonly DayName[]): void
  /** Discard manual edits and rebuild the grid from the active routine. */
  resetGrid(): void
  upsertSlot(slot: ScheduleSlot): void
  removeSlot(id: string): void
  setOffDay(day: DayName, status: RoutineGrid['offDays'][DayName]): void
  setEveningOff(day: DayName, off: boolean): void
  addTimeSlot(range: TimeRange): void
  removeTimeSlot(id: string): void
  /** A blank manual session for a (day, column), ready for the editor. */
  newManualSlot(day: DayName, column: TimeSlot): ScheduleSlot
}

export interface RoutineContextValue {
  readonly state: RoutineState
  readonly matches: readonly ParsedCell[]
  readonly workload: WorkloadSummary
  readonly directory: readonly FacultyDirectoryEntry[]
  /** True while a stored master routine owns the semester field. */
  readonly semesterLocked: boolean
  readonly actions: RoutineActions
}

export const RoutineContext = createContext<RoutineContextValue | null>(null)
