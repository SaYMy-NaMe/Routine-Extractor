import { useState } from 'react'
import { type MasterRoutineMeta } from '../../../domain'
import { Badge, Button, Spinner, cx } from '../../components/ui'
import { useRoutine } from '../../hooks/useRoutine'
import { useServices } from '../../hooks/useServices'
import { FileDropzone } from './FileDropzone'
import { SaveRoutineDialog } from './SaveRoutineDialog'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

/** Stored master routines: pick one (locks the semester), upload a new one, or remove one. */
export function MasterRoutineLibrary() {
  const { state, actions } = useRoutine()
  const { importRoutine, library } = useServices()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const { routines, active, loading, error } = state.library
  const accept = importRoutine.acceptedExtensions.join(',')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {library.scope === 'shared'
            ? 'Shared library — visible to everyone using this deployment.'
            : 'Stored on this device — available every time you open the app.'}
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={actions.refreshLibrary}
          aria-label="Refresh library"
          disabled={loading}
        >
          ↻
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {loading && !routines.length ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner className="h-4 w-4" /> Loading stored routines…
        </div>
      ) : routines.length ? (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Stored master routines">
          {routines.map((r) => (
            <RoutineCard
              key={r.id}
              routine={r}
              active={active?.id === r.id}
              confirming={confirmDelete === r.id}
              onSelect={() => actions.selectRoutine(active?.id === r.id ? null : r.id)}
              onAskDelete={() => setConfirmDelete(r.id)}
              onCancelDelete={() => setConfirmDelete(null)}
              onDelete={() => {
                setConfirmDelete(null)
                void actions.deleteRoutine(r.id)
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No master routines yet — upload the first one below.</p>
      )}

      <FileDropzone status={state.importStatus} accept={accept} onFile={actions.loadFile} />

      {state.importStatus.kind === 'naming' && (
        <SaveRoutineDialog
          imported={state.importStatus.imported}
          suggestedTitle={state.importStatus.suggestedTitle}
          saving={false}
          onConfirm={actions.confirmImport}
          onCancel={actions.cancelImport}
        />
      )}
    </div>
  )
}

interface CardProps {
  routine: MasterRoutineMeta
  active: boolean
  confirming: boolean
  onSelect: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}

function RoutineCard({
  routine,
  active,
  confirming,
  onSelect,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: CardProps) {
  return (
    <li
      className={cx(
        'rounded-xl border p-3 transition-colors',
        active
          ? 'border-theory-500 bg-theory-50 ring-theory-500/30 dark:bg-theory-900/30 ring-2'
          : 'hover:border-theory-500/60 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="w-full text-left focus-visible:outline-none"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{routine.title}</span>
          {active ? (
            <Badge tone="theory">SELECTED</Badge>
          ) : (
            <Badge tone="neutral">{routine.format.toUpperCase()}</Badge>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={routine.fileName}>
          {routine.fileName}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {routine.cellCount} classes · {formatDate(routine.uploadedAt)}
        </p>
      </button>
      <div className="mt-2 flex justify-end gap-1">
        {confirming ? (
          <>
            <span className="self-center text-xs text-slate-500">Remove permanently?</span>
            <Button size="sm" variant="ghost" onClick={onCancelDelete}>
              Keep
            </Button>
            <Button size="sm" variant="danger" onClick={onDelete}>
              Remove
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={onAskDelete} aria-label={`Remove ${routine.title}`}>
            Remove
          </Button>
        )}
      </div>
    </li>
  )
}
