import { useSyncExternalStore } from 'react'
import { cx } from '../components/ui'
import type { ToastStore } from './toastStore'

const TONE = {
  success:
    'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
  error: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
  info: 'border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
} as const

/** Renders the toast queue in the bottom-right corner (bottom-centre on phones). */
export function Toaster({ store }: { store: ToastStore }) {
  const toasts = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  if (!toasts.length) return null
  return (
    <div className="no-print pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={cx(
            'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg',
            TONE[t.kind],
          )}
        >
          <span aria-hidden="true">{t.kind === 'success' ? '✓' : t.kind === 'error' ? '⚠' : 'ⓘ'}</span>
          <p className="flex-1">{t.message}</p>
          <button
            type="button"
            onClick={() => store.dismiss(t.id)}
            aria-label="Dismiss"
            className="opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
