import { useEffect, useId, useState } from 'react'
import { SEMESTER_TITLE_MAX, validateSemesterTitle } from '../../../domain'
import type { ImportedRoutine } from '../../../application'
import { Button, Field, Input } from '../../components/ui'

interface Props {
  imported: ImportedRoutine
  suggestedTitle: string
  saving: boolean
  onConfirm: (title: string) => void
  onCancel: () => void
}

/** Asks for the semester title a freshly parsed routine should be indexed under. */
export function SaveRoutineDialog({ imported, suggestedTitle, saving, onConfirm, onCancel }: Props) {
  const [title, setTitle] = useState(suggestedTitle)
  const [touched, setTouched] = useState(false)
  const titleId = useId()
  const error = touched ? validateSemesterTitle(title) : null
  const days = new Set(imported.result.cells.map((c) => c.day)).size

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, saving])

  const submit = () => {
    setTouched(true)
    if (!validateSemesterTitle(title)) onConfirm(title)
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <h3 id={titleId} className="text-base font-semibold text-slate-900 dark:text-slate-50">
          Name this master routine
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-200">{imported.fileName}</span> ·{' '}
          {imported.result.cells.length} classes across {days} days
          {imported.result.facultyDirectory.length
            ? ` · ${imported.result.facultyDirectory.length} faculty`
            : ''}
        </p>
        <div className="mt-4">
          <Field
            label="Semester title"
            hint='e.g. "Fall 2025", "Spring 2026". An existing title is replaced.'
            error={error ?? undefined}
          >
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                autoFocus
                value={title}
                invalid={Boolean(error)}
                maxLength={SEMESTER_TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setTouched(true)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Summer 2026"
              />
            )}
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save to library'}
          </Button>
        </div>
      </div>
    </div>
  )
}
