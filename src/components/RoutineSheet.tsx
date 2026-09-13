import type { FacultyProfile, RoutineGrid, TimeSlot, WorkloadSummary } from '../types/routine'
import { DAY_LABELS, fullCourseCode } from '../types/routine'
import { slotsAt } from '../services/routineBuilder'
import { describeCourseLine, formatCredits } from '../services/workloadCalculator'
import './sheet.css'

interface Props {
  profile: FacultyProfile
  grid: RoutineGrid
  columns: TimeSlot[]
  workload: WorkloadSummary
}

/** Print-ready, WYSIWYG rendition of the personal routine (mirrors the PDF export). */
export function RoutineSheet({ profile, grid, columns, workload }: Props) {
  const title = `${profile.semester || 'Semester'} Routine`
  return (
    <article className="sheet print-sheet" aria-label="Routine sheet preview">
      <h1 className="sheet__title">{title}</h1>

      <div className="sheet__head">
        <p className="sheet__name">{profile.fullName || 'Faculty Name'}</p>
        {(profile.title || profile.department) && (
          <p className="sheet__line">{[profile.title, profile.department].filter(Boolean).join(', ')}</p>
        )}
        {profile.school && <p className="sheet__line">{profile.school}</p>}
        {profile.institution && <p className="sheet__line">{profile.institution}</p>}
        {(profile.email || profile.phone) && (
          <p className="sheet__line sheet__contact">
            {profile.email && (
              <>
                <b>Email:</b> {profile.email}
              </>
            )}
            {profile.email && profile.phone && ' | '}
            {profile.phone && (
              <>
                <b>Contact:</b> {profile.phone}
              </>
            )}
          </p>
        )}
      </div>

      <table className="sheet__table">
        <thead>
          <tr>
            <th className="sheet__corner">
              <span className="t">TIME</span>
              <span className="d">DAY</span>
            </th>
            {columns.map((c) => (
              <th key={c.id}>
                {c.label}
                {c.altLabel && <span className="sheet__alt">{c.altLabel}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.days.map((day) => {
            const off = grid.offDays[day]
            const hasAny = grid.slots.some((s) => s.day === day)
            return (
              <tr key={day}>
                <td className="sheet__day">{DAY_LABELS[day].slice(0, 3)}</td>
                {!hasAny && off !== 'none' ? (
                  <td
                    colSpan={columns.length}
                    className={`sheet__off ${off === 'weekend' ? 'sheet__off--weekend' : ''}`}
                  >
                    {off === 'weekend' ? 'WEEKEND' : 'NO CLASS ON THIS DAY'}
                  </td>
                ) : (
                  columns.map((col) => (
                    <td key={col.id} className="sheet__cell">
                      {slotsAt(grid, day, col.id).map((s) => (
                        <span
                          key={s.id}
                          className={`sheet__chip ${s.type === 'lab' ? 'sheet__chip--lab' : ''}`}
                        >
                          <b>
                            {fullCourseCode(s)}
                            {s.type === 'lab' ? ' LAB' : ''}
                          </b>
                          {s.room && <small>{s.room}</small>}
                        </span>
                      ))}
                    </td>
                  ))
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      {workload.courses.length > 0 && (
        <>
          <ul className="sheet__workload">
            {workload.courses.map((c) => (
              <li key={c.courseCode}>{describeCourseLine(c)}</li>
            ))}
          </ul>
          <p className="sheet__total">Total Workload: {formatCredits(workload.totalCredits)} Credits</p>
        </>
      )}

      <div className="sheet__footer">
        <span>{[profile.fullName, profile.institution].filter(Boolean).join(' · ')}</span>
        <span>Generated with Faculty Routine Extractor</span>
      </div>
    </article>
  )
}
