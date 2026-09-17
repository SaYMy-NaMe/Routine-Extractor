import { useCallback, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import type { ImportStatus } from '../../providers/routineState'
import { Spinner, cx } from '../../components/ui'
import { UploadIcon } from './icons'

interface Props {
  status: ImportStatus
  /** e.g. ".pdf,.doc,.docx" */
  accept: string
  onFile: (file: File) => void
}

/** Drag-and-drop (or click / keyboard) upload zone for a new master routine. */
export function FileDropzone({ status, accept, onFile }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = status.kind === 'reading' || status.kind === 'saving'

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    if (!busy) handleFiles(e.dataTransfer.files)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload master routine file"
      aria-busy={busy}
      onClick={() => !busy && inputRef.current?.click()}
      onKeyDown={onKeyDown}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cx(
        'focus-visible:ring-theory-500/50 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-5 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none',
        dragging
          ? 'border-theory-500 bg-theory-50 dark:bg-theory-900/30'
          : 'hover:border-theory-500 hover:bg-theory-50/60 border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800',
        busy && 'cursor-progress opacity-70',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {busy ? (
        <>
          <Spinner className="text-theory-500 mb-2 h-7 w-7" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {status.kind === 'reading' ? `Reading ${status.fileName}…` : `Saving ${status.fileName}…`}
          </p>
        </>
      ) : (
        <>
          <UploadIcon className="text-theory-500 mb-2 h-8 w-8" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Upload a new master routine
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            PDF or Word (.doc, .docx) · drop here or tap to browse · you will be asked for a semester title
          </p>
        </>
      )}
    </div>
  )
}
