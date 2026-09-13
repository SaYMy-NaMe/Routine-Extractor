/**
 * Core domain types for the Faculty Routine Extractor.
 *
 * The departmental routine is a set of Day → (Room × TimeSlot) matrices. We
 * flatten every non-empty matrix cell into a `ParsedCell`, filter the ones that
 * belong to the searched faculty, and project them onto a personal
 * `RoutineGrid` (Day × TimeSlot) that drives the preview and the exporters.
 */

/** Academic week in the order the routine is printed (Saturday first). */
export const DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const
export type DayName = (typeof DAYS)[number]

export const DAY_LABELS: Record<DayName, string> = {
  Sat: 'Saturday',
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
}

export type SessionType = 'theory' | 'lab'

/** Credit rules: credits earned per section taught. */
export const CREDITS_PER_SECTION: Record<SessionType, number> = {
  theory: 3,
  lab: 1.5,
}

/** How often an evening class meets. Day classes are implicitly weekly. */
export type ClassFrequency = 'weekly' | 'alternate'

export const FREQUENCY_LABELS: Record<ClassFrequency, string> = {
  weekly: 'Weekly',
  alternate: 'Alt. Week',
}

/** Evening rule: theory meets every week, labs alternate weeks. */
export function defaultFrequency(type: SessionType): ClassFrequency {
  return type === 'lab' ? 'alternate' : 'weekly'
}

/** The dedicated evening block (6:30 PM – 9:30 PM), always present in the grid. */
export const EVENING_SLOT = { startMin: 18 * 60 + 30, endMin: 21 * 60 + 30 } as const

/** A column of the personal routine grid. Times are minutes since midnight. */
export interface TimeSlot {
  id: string
  /** Human label, e.g. "10:00 AM - 11:30 AM". */
  label: string
  startMin: number
  endMin: number
  /**
   * Optional secondary label shown under the main one when a lab slot is
   * folded into this column (e.g. "3:30 PM - 5:30 PM").
   */
  altLabel?: string
  /** The pinned evening column: always rendered, editable via its own popover. */
  evening?: boolean
}

/** One class occurrence: a course section taught in a room on a day/slot. */
export interface ScheduleSlot {
  id: string
  day: DayName
  /** Id of the `TimeSlot` column this session is rendered in. */
  slotId: string
  /** Base course code, e.g. "CSE 443". */
  courseCode: string
  /** Section number as printed, e.g. "2" (may be empty for single-section courses). */
  section: string
  /** Room label as printed in the routine, e.g. "N204" or "111". */
  room: string
  type: SessionType
  /** Actual start/end for this session (labs can differ from the column times). */
  startMin: number
  endMin: number
  /** Faculty short form found in the cell (e.g. "ASHRAF"). */
  facultyTag: string
  /** Where this slot came from. Manual edits are never overwritten by re-parsing. */
  source: 'parsed' | 'manual'
  /** Meeting frequency — only meaningful for evening classes. */
  frequency?: ClassFrequency
}

/** Full course code with section, e.g. "CSE 443.2". */
export function fullCourseCode(slot: Pick<ScheduleSlot, 'courseCode' | 'section'>): string {
  return slot.section ? `${slot.courseCode}.${slot.section}` : slot.courseCode
}

export type OffDayStatus = 'none' | 'no-class' | 'weekend'

/** The personal routine matrix rendered in the preview and the exports. */
export interface RoutineGrid {
  days: DayName[]
  timeSlots: TimeSlot[]
  slots: ScheduleSlot[]
  /** Days with no sessions are annotated as either a "no class" day or the weekend. */
  offDays: Record<DayName, OffDayStatus>
  /** Days whose evening cell is explicitly marked as an off slot. */
  eveningOff: DayName[]
}

/** Metadata printed in the header/footer of the generated routine. */
export interface FacultyProfile {
  /** Term used to find the faculty in the routine matrix, e.g. "ASHRAF". */
  searchQuery: string
  fullName: string
  title: string
  department: string
  school: string
  institution: string
  email: string
  phone: string
  semester: string
}

export const EMPTY_PROFILE: FacultyProfile = {
  searchQuery: '',
  fullName: '',
  title: 'Lecturer',
  department: 'Computer Science and Engineering',
  school: 'School of Science, Engineering and Technology',
  institution: 'East Delta University',
  email: '',
  phone: '',
  semester: '',
}

/** Workload for one course (all of its sections). */
export interface CourseWorkload {
  courseCode: string
  /** Optional human title, e.g. "Neural Network and Fuzzy Logics" (user-editable). */
  title: string
  type: SessionType
  /** Distinct section numbers taught. */
  sections: string[]
  creditsPerSection: number
  totalCredits: number
}

export interface WorkloadSummary {
  courses: CourseWorkload[]
  totalSections: number
  totalCredits: number
}

/* ------------------------------------------------------------------------- */
/* Parser output                                                              */
/* ------------------------------------------------------------------------- */

/** A non-empty cell lifted out of a departmental routine matrix. */
export interface ParsedCell {
  day: DayName
  /** Which table the cell came from ("Theory Classes" vs "Lab Classes"). */
  tableKind: SessionType
  room: string
  /** Time-slot header text of the column, as printed (e.g. "11.30-1.00"). */
  slotLabel: string
  startMin: number
  endMin: number
  /** Raw cell text with line breaks collapsed to " / ". */
  rawText: string
  courseCode: string
  section: string
  /** Faculty short form(s) written in the cell. */
  facultyTag: string
  page: number
}

/** A time-slot column found in a table header. */
export interface ParsedColumn {
  kind: SessionType
  label: string
  startMin: number
  endMin: number
}

export interface ParseResult {
  cells: ParsedCell[]
  /** Distinct header columns across all tables (theory and lab). */
  columns: ParsedColumn[]
  /** Short form → full name, from the "Faculty Members" table when present. */
  facultyDirectory: Record<string, string>
  /** Best-effort header hints ("Summer 2026", "East Delta University"). */
  semesterHint?: string
  institutionHint?: string
  pageCount: number
  warnings: string[]
}
