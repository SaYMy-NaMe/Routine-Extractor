import type { FacultyProfile, RoutineGrid, TimeSlot, WorkloadSummary } from '../types/routine'
import { DAY_LABELS } from '../types/routine'
import { isEveningOff, sessionLabel, slotsAt } from '../services/routineBuilder'
import { formatCredits, formatSections } from '../services/workloadCalculator'
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
  const dayColumns = columns.filter((c) => !c.evening)
  const eveningColumns = columns.filter((c) => c.evening)

  const cell = (day: RoutineGrid['days'][number], col: TimeSlot) => {
    if (isEveningOff(grid, day, col)) {
      return (
        <td key={col.id} className="sheet__cell sheet__cell--evening sheet__offcell">
          OFF
        </td>
      )
    }
    return (
      <td key={col.id} className={`sheet__cell ${col.evening ? 'sheet__cell--evening' : ''}`}>
        {slotsAt(grid, day, col.id).map((s) => (
          <span key={s.id} className={`sheet__chip ${s.type === 'lab' ? 'sheet__chip--lab' : ''}`}>
            <b>{sessionLabel(s, col)}</b>
            {s.room && <small>{s.room}</small>}
          </span>
        ))}
      </td>
    )
  }

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
              <th key={c.id} className={c.evening ? 'sheet__th--evening' : undefined}>
                {c.label}
                {c.altLabel && <span className="sheet__alt">{c.altLabel}</span>}
                {c.evening && <span className="sheet__alt">Evening</span>}
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
                    colSpan={dayColumns.length}
                    className={`sheet__off ${off === 'weekend' ? 'sheet__off--weekend' : ''}`}
                  >
                    {off === 'weekend' ? 'WEEKEND' : 'NO CLASS ON THIS DAY'}
                  </td>
                ) : (
                  dayColumns.map((col) => cell(day, col))
                )}
                {eveningColumns.map((col) => cell(day, col))}
              </tr>
            )
          })}
        </tbody>
      </table>

      {workload.courses.length > 0 && (
        <table className="sheet__workload">
          <thead>
            <tr>
              <th>Course</th>
              <th>Title</th>
              <th>Type</th>
              <th>Sections</th>
              <th>Credits / Section</th>
              <th>Total Credits</th>
            </tr>
          </thead>
          <tbody>
            {workload.courses.map((c) => (
              <tr key={c.courseCode}>
                <td>
                  <b>{c.courseCode}</b>
                </td>
                <td className="sheet__wl-title">{c.title || '—'}</td>
                <td>{c.type === 'lab' ? 'Lab' : 'Theory'}</td>
                <td>{formatSections(c)}</td>
                <td>{formatCredits(c.creditsPerSection)}</td>
                <td>
                  <b>{formatCredits(c.totalCredits)}</b>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Total Workload</td>
              <td>{workload.totalSections} sections</td>
              <td />
              <td>
                <b>{formatCredits(workload.totalCredits)} Credits</b>
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      <div className="sheet__footer">
        <span>{[profile.fullName, profile.institution].filter(Boolean).join(' · ')}</span>
        <span>Evening classes: [Weekly] every week · [Alt. Week] alternating weeks</span>
      </div>
    </article>
  )
}
