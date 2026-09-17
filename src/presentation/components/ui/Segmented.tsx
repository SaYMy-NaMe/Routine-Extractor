import type { ReactNode } from 'react'
import { cx } from './cx'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** Accent used for the active segment. */
  tone?: 'theory' | 'lab' | 'neutral'
  title?: string
}

const ACTIVE: Record<NonNullable<SegmentedOption<string>['tone']>, string> = {
  theory: 'bg-theory-500 text-white',
  lab: 'bg-lab-500 text-white',
  neutral: 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900',
}

/** Radio-group style switch (view mode, type, frequency, density …). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
  className,
}: {
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700', className)}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex-1 rounded-md font-semibold whitespace-nowrap transition-colors',
              size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs',
              active
                ? ACTIVE[o.tone ?? 'neutral']
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
