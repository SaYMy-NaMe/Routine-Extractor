import { useState } from 'react'
import type { ExportData } from '../services/exportService'
import { exportDocx, exportPdf } from '../services/exportService'
import { Button } from './ui'

interface Props {
  data: ExportData
}

type Busy = 'pdf' | 'docx' | null

/** Download buttons for PDF / DOCX plus the browser print dialog. */
export function ExportControls({ data }: Props) {
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
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

  return (
    <div className="space-y-3">
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
        <Button variant="ghost" disabled={disabled} onClick={() => window.print()}>
          🖨 Print
        </Button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        PDF is a single landscape page with selectable text; DOCX is a fully editable Word table.
      </p>
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
