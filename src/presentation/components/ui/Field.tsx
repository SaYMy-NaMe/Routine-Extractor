import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cx } from './cx'

export const inputClass =
  'w-full min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs outline-none placeholder:text-slate-400 focus:border-theory-500 focus:ring-2 focus:ring-theory-500/30 aria-invalid:border-red-500 aria-invalid:ring-red-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600'

export interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string
  className?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}

/** Labelled form control with accessible hint/error wiring. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId()
  const hintId = hint || error ? `${id}-hint` : undefined
  return (
    <div className={cx('block', className)}>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-medium tracking-wide text-slate-600 uppercase dark:text-slate-400"
      >
        {label}
      </label>
      {children(id, hintId)}
      {(error || hint) && (
        <p
          id={hintId}
          className={cx('mt-1 text-xs', error ? 'text-red-600 dark:text-red-400' : 'text-slate-500')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export function Input({ className, invalid, ...props }: InputProps) {
  return <input {...props} aria-invalid={invalid || undefined} className={cx(inputClass, className)} />
}
