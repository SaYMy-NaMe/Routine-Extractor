import type { ReactNode } from 'react'
import { cx } from './cx'

export type BadgeTone = 'neutral' | 'theory' | 'lab' | 'warn' | 'ok' | 'evening'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  theory: 'bg-theory-100 text-theory-700 dark:bg-theory-900/60 dark:text-theory-100',
  lab: 'bg-lab-100 text-lab-700 dark:bg-lab-900/60 dark:text-lab-100',
  warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  evening: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
