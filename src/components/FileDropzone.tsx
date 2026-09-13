import { useCallback, useRef, useState, type DragEvent } from 'react'
import type { FileStatus } from '../hooks/useRoutineState'
import { Button, Spinner } from './ui'

interface Props {
  status: FileStatus
  onFile: (file: File) => void
  onReset: () => void
}

/** Drag-and-drop (or click-to-browse) PDF upload with parse status feedback. */
export function FileDropzone({ status, onFile, onReset }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
    handleFiles(e.dataTransfer.files)
  }

  const tone =
    status.kind === 'ready'
      ? 'border-lab-500 bg-lab-50 dark:bg-lab-900/20'
      : status.kind === 'error'
        ? 'border-red-400 bg-red-50 dark:bg-red-950/30'
        : dragging
          ? 'border-theory-500 bg-theory-50 dark:bg-theory-900/30'
          : 'border-slate-300 bg-slate-50 hover:border-theory-500 hover:bg-theory-50/60 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload routine PDF"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${tone}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {status.kind === 'idle' && (
        <>
          <UploadIcon className="mb-3 h-10 w-10 text-theory-500" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Drop the departmental routine PDF here
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            or click to browse · text-based PDF only · processed locally in your browser
          </p>
        </>
      )}

      {status.kind === 'parsing' && (
        <>
          <Spinner className="mb-3 h-8 w-8 text-theory-500" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Reading {status.fileName}…</p>
          <p className="mt-1 text-xs text-slate-500">Extracting the routine matrix</p>
        </>
      )}

      {status.kind === 'ready' && (
        <>
          <CheckIcon className="mb-3 h-10 w-10 text-lab-500" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{status.fileName}</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {status.pageCount} page{status.pageCount === 1 ? '' : 's'} · {status.cellCount} class cells found
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-3"
            onClick={(e) => {
              e.stopPropagation()
              onReset()
            }}
          >
            Remove file
          </Button>
        </>
      )}

      {status.kind === 'error' && (
        <>
          <ErrorIcon className="mb-3 h-10 w-10 text-red-500" />
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{status.fileName}</p>
          <p className="mt-1 max-w-md text-xs text-red-600 dark:text-red-400">{status.message}</p>
          <p className="mt-2 text-xs text-slate-500">Drop another file to try again</p>
        </>
      )}
    </div>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  )
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  )
}
function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 8v5m0 3h.01" />
    </svg>
  )
}
