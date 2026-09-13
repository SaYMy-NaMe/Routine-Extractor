import { useState } from 'react'
import type { ExportData, IcsOptions } from '../services/exportService'
import { exportDocx, exportIcs, exportPdf } from '../services/exportService'
import { Button, Field, Input } from './ui'

interface Props {
  data: ExportData
}

type Busy = 'pdf' | 'docx' | 'ics' | null

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

function defaultRange(): { start: string; end: string } {
  const start = new Date()
  const end = new Date(start)
  end.setDate(end.getDate() + 16 * 7) // a typical 16-week semester
  return { start: isoDate(start), end: isoDate(end) }
}

/** Download buttons for PDF / DOCX / iCal plus the browser print dialog. */
export function ExportControls({ data }: Props) {
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState(defaultRange)
  const [reminder, setReminder] = useState(10)
  const disabled = data.grid.slots.length === 0

  const run = async (kind: Exclude<Busy, null>, fn: () => void | Promise<void>) => {
    setBusy(kind)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not export ${kind.toUpperCase()}.`)
    } finally {
      setBusy(null)
    }
  }

  const icsOpts: IcsOptions = {
    semesterStart: range.start,
    semesterEnd: range.end,
    reminderMinutes: reminder,
  }
  const rangeValid = range.start && range.end && range.end >= range.start

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={disabled || busy !== null}
          onClick={() => run('pdf', () => exportPdf(data))}
        >
          <DownloadIcon /> {busy === 'pdf' ? 'Building…' : 'Download PDF'}
        </Button>
        <Button disabled={disabled || busy !== null} onClick={() => run('docx', () => exportDocx(data))}>
          <DownloadIcon /> {busy === 'docx' ? 'Building…' : 'Download DOCX'}
        </Button>
        <Button
          disabled={disabled || busy !== null || !rangeValid}
          onClick={() => run('ics', () => exportIcs(data, icsOpts))}
        >
          <DownloadIcon /> {busy === 'ics' ? 'Building…' : 'Download iCal (.ics)'}
        </Button>
        <Button variant="ghost" disabled={disabled} onClick={() => window.print()}>
          🖨 Print
        </Button>
      </div>

      <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <legend className="px-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
          Calendar options
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Semester starts">
            <Input
              type="date"
              value={range.start}
              onChange={(e) => setRange({ ...range, start: e.target.value })}
            />
          </Field>
          <Field label="Classes end">
            <Input
              type="date"
              value={range.end}
              min={range.start}
              onChange={(e) => setRange({ ...range, end: e.target.value })}
            />
          </Field>
          <Field label="Reminder (minutes)" hint="0 disables reminders">
            <Input
              type="number"
              min={0}
              max={1440}
              value={reminder}
              onChange={(e) => setReminder(Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Each class becomes a weekly repeating event in your local time zone, from the start date until
          classes end. Import the .ics into Google Calendar, Outlook, or Apple Calendar.
        </p>
      </fieldset>

      {disabled && <p className="text-xs text-slate-500">Add at least one class to enable exports.</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" />
    </svg>
  )
}
