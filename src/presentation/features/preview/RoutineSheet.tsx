import { memo } from 'react'
import {
  DAY_LABELS,
  type DayName,
  NOT_AVAILABLE,
  type ScheduleSlot,
  type TimeSlot,
  badgeDisplayText,
  formatCredits,
  formatSections,
  formatSectionCount,
  orNA,
  sessionLabel,
  sessionTiming,
} from '../../../domain'
import {
  type ExportData,
  breakWaived,
  emptyDayView,
  isEveningOff,
  rowLayout,
  slotsAt,
  visibleDays,
} from '../../../application'
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

  const cell = (day: DayName, col: TimeSlot, slot: ScheduleSlot | undefined, span: number) => {
    if (col.isBreak) {
      const waived = breakWaived(grid, day)
      return (
        <td key={col.id} className={`sheet__cell sheet__break ${waived ? 'sheet__break--waived' : ''}`}>
          {waived ? NOT_AVAILABLE : 'BREAK'}
        </td>
      )
    }
    if (isEveningOff(grid, day, col)) {
      return (
        <td key={col.id} className="sheet__cell sheet__cell--evening sheet__offcell">
          {OFF_CELL_TEXT}
        </td>
      )
    }
    return (
      <td
        key={col.id}
        colSpan={span}
        className={`sheet__cell ${col.evening ? 'sheet__cell--evening' : ''} ${span > 1 ? 'sheet__cell--merged' : ''}`}
      >
        {slot && (
          <span className={`sheet__chip ${slot.type === 'lab' ? 'sheet__chip--lab' : ''}`}>
            <b>{sessionLabel(slot, col)}</b>
            <small>{orNA(slot.room)}</small>
            {sessionTiming(slot) && <small className="sheet__timing">{sessionTiming(slot)}</small>}
          </span>
        )}
      </td>
    )
  }

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
              <th
                key={c.id}
                className={c.evening ? 'sheet__th--evening' : c.isBreak ? 'sheet__th--break' : undefined}
              >
                {c.label}
                {c.altLabel && <span className="sheet__alt">{c.altLabel}</span>}
                {c.evening && <span className="sheet__alt">Evening</span>}
                {c.isBreak && <span className="sheet__alt">1:00 PM - 1:30 PM</span>}
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
                  rowLayout(grid, day, dayColumns).map((c) => cell(day, c.column, c.slot, c.span))
                )}
                {badge?.spansEvening
                  ? null
                  : eveningColumns.map((col) => cell(day, col, slotsAt(grid, day, col.id)[0], 1))}
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
                <td className="sheet__wl-title">{orNA(c.title)}</td>
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
              <td>{formatSectionCount(workload.totalSections)}</td>
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
