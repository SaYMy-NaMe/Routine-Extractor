import { type WorkloadSummary as Summary, formatCredits } from '../../../domain'
import { Badge, inputClass } from '../../components/ui'

interface Props {
  summary: Summary
  onTitleChange: (courseCode: string, title: string) => void
}

/** Per-course section counts and credit totals, with editable course titles. */
export function WorkloadSummary({ summary, onTitleChange }: Props) {
  if (!summary.courses.length) {
    return (
      <p className="text-sm text-slate-500">
        No classes yet — the workload appears once the routine has sessions.
      </p>
    )
  }
  return (
    <div className="space-y-4">
      {/* Card list (mobile) */}
      <ul className="space-y-2 md:hidden">
        {summary.courses.map((c) => (
          <li key={c.courseCode} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-50">
                {c.courseCode}
              </span>
              <Badge tone={c.type}>{c.type === 'lab' ? 'LAB' : 'THEORY'}</Badge>
            </div>
            <input
              aria-label={`Title for ${c.courseCode}`}
              value={c.title}
              onChange={(e) => onTitleChange(c.courseCode, e.target.value)}
              placeholder="Course title (optional)"
              className={`${inputClass} mt-2`}
            />
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-500">
                {c.sections.length} section{c.sections.length === 1 ? '' : 's'} ×{' '}
                {formatCredits(c.creditsPerSection)}
              </span>
              <span className="font-semibold">{formatCredits(c.totalCredits)} cr</span>
            </div>
          </li>
        ))}
      </ul>

      {/* Table (tablet and up) */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
              <th className="pr-3 pb-2 font-medium">Course</th>
              <th className="pr-3 pb-2 font-medium">Title</th>
              <th className="pr-3 pb-2 font-medium">Type</th>
              <th className="pr-3 pb-2 font-medium">Sections</th>
              <th className="pr-3 pb-2 text-right font-medium">Cr / section</th>
              <th className="pb-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {summary.courses.map((c) => (
              <tr key={c.courseCode}>
                <td className="py-2 pr-3 font-mono font-semibold whitespace-nowrap text-slate-900 dark:text-slate-50">
                  {c.courseCode}
                </td>
                <td className="py-2 pr-3">
                  <input
                    aria-label={`Title for ${c.courseCode}`}
                    value={c.title}
                    onChange={(e) => onTitleChange(c.courseCode, e.target.value)}
                    placeholder="Course title (optional)"
                    className={`${inputClass} min-w-48 py-1`}
                  />
                </td>
                <td className="py-2 pr-3">
                  <Badge tone={c.type}>{c.type === 'lab' ? 'LAB' : 'THEORY'}</Badge>
                </td>
                <td className="py-2 pr-3">
                  <div className="flex flex-wrap gap-1">
                    {c.sections.map((s) => (
                      <span
                        key={s || 'none'}
                        className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {s ? `${c.courseCode}.${s}` : c.courseCode}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatCredits(c.creditsPerSection)}</td>
                <td className="py-2 text-right font-semibold text-slate-900 tabular-nums dark:text-slate-50">
                  {formatCredits(c.totalCredits)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t-2 border-slate-200 pt-3 dark:border-slate-700">
        <span className="text-xs text-slate-500">
          {summary.courses.length} course{summary.courses.length === 1 ? '' : 's'} · {summary.totalSections}{' '}
          sections
        </span>
        <span className="text-theory-700 dark:text-theory-100 text-lg font-bold tabular-nums">
          {formatCredits(summary.totalCredits)} <span className="text-xs font-medium">credits</span>
        </span>
      </div>
    </div>
  )
}
