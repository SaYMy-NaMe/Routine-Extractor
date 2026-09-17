import { useState } from 'react'
import type { ExportData, ExportFormat } from '../../../application'
import { Button } from '../../components/ui'
import { useServices } from '../../hooks/useServices'
import { useToast } from '../../hooks/useToast'

interface Props {
  data: ExportData
}

/** Download buttons for every registered exporter plus the browser print dialog. */
export function ExportControls({ data }: Props) {
  const { exportRoutine } = useServices()
  const toasts = useToast()
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const disabled = data.grid.slots.length === 0

  const run = async (format: ExportFormat) => {
    setBusy(format)
    try {
      const fileName = await exportRoutine.execute(format, data)
      toasts.notify('success', `Saved ${fileName}`)
    } catch (err) {
      toasts.notify('error', err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {exportRoutine.formats.map((e, i) => (
          <Button
            key={e.format}
            variant={i === 0 ? 'primary' : 'secondary'}
            disabled={disabled || busy !== null}
            onClick={() => run(e.format)}
            className="grow sm:grow-0"
          >
            <DownloadIcon /> {busy === e.format ? 'Building…' : `Download ${e.label}`}
          </Button>
        ))}
        <Button variant="ghost" disabled={disabled} onClick={() => window.print()} className="grow sm:grow-0">
          🖨 Print
        </Button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        PDF is a single landscape page with selectable text; DOCX is a fully editable Word table.
      </p>
      {disabled && <p className="text-xs text-slate-500">Add at least one class to enable exports.</p>}
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
