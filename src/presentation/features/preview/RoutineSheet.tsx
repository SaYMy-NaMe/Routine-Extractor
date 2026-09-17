import { memo } from 'react'
import {
  DAY_LABELS,
  type DayName,
  type TimeSlot,
  badgeDisplayText,
  formatCredits,
  formatSections,
  sessionLabel,
} from '../../../domain'
import { type ExportData, emptyDayView, isEveningOff, slotsAt, visibleDays } from '../../../application'
import {
  EVENING_LEGEND,
  OFF_CELL_TEXT,
  WORKLOAD_HEADERS,
  contactLine,
  headerLines,
  routineTitle,
} from '../../../infrastructure'
import { badgeCss } from '../grid/badgeCss'
import './sheet.css'

interface Props {
  data: ExportData
}

/** Print-ready, WYSIWYG rendition of the personal routine (mirrors the PDF export). */
export const RoutineSheet = memo(function RoutineSheet({ data }: Props) {
  const { profile, grid, columns, workload, emptyDay } = data
  const dayColumns = columns.filter((c) => !c.evening)
  const eveningColumns = columns.filter((c) => c.evening)
  const contact = contactLine(profile)

  const cell = (day: DayName, col: TimeSlot) =>
    isEveningOff(grid, day, col) ? (
      <td key={col.id} className="sheet__cell sheet__cell--evening sheet__offcell">
        {OFF_CELL_TEXT}
      </td>
    ) : (
      <td key={col.id} className={`sheet__cell ${col.evening ? 'sheet__cell--evening' : ''}`}>
        {slotsAt(grid, day, col.id).map((s) => (
          <span key={s.id} className={`sheet__chip ${s.type === 'lab' ? 'sheet__chip--lab' : ''}`}>
            <b>{sessionLabel(s, col)}</b>
            {s.room && <small>{s.room}</small>}
          </span>
        ))}
      </td>
    )

  return (
    <article className="sheet print-sheet" aria-label="Routine sheet preview">
      <h1 className="sheet__title">{routineTitle(profile)}</h1>

      <div className="sheet__head">
        <p className="sheet__name">{profile.fullName || 'Faculty Name'}</p>
        {headerLines(profile).map((line) => (
          <p key={line} className="sheet__line">
            {line}
          </p>
        ))}
        {contact && <p className="sheet__line sheet__contact">{contact}</p>}
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
          {visibleDays(grid, emptyDay).map((day) => {
            const badge = emptyDayView(grid, day, emptyDay)
            const style = badge && emptyDay.badges[badge.kind]
            return (
              <tr key={day} className={badge?.collapsed ? 'sheet__row--collapsed' : undefined}>
                <td className="sheet__day">{DAY_LABELS[day].slice(0, 3)}</td>
                {badge && style ? (
                  <td
                    colSpan={badge.spansEvening ? columns.length : dayColumns.length}
                    className="sheet__off"
                  >
                    <span className="sheet__badge" style={badgeCss(style)}>
                      {badgeDisplayText(style)}
                    </span>
                  </td>
                ) : (
                  dayColumns.map((col) => cell(day, col))
                )}
                {badge?.spansEvening ? null : eveningColumns.map((col) => cell(day, col))}
              </tr>
            )
          })}
        </tbody>
      </table>

      {workload.courses.length > 0 && (
        <table className="sheet__workload">
          <thead>
            <tr>
              {WORKLOAD_HEADERS.map((h) => (
                <th key={h}>{h}</th>
              ))}
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
        <span>{EVENING_LEGEND}</span>
      </div>
    </article>
  )
})
