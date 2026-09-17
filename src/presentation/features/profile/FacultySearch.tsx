import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { type FacultyDirectoryEntry, cleanPersonName } from '../../../domain'
import { searchFaculty } from '../../../application'
import { cx, inputClass } from '../../components/ui'

interface Props {
  id: string
  describedBy?: string
  value: string
  directory: readonly FacultyDirectoryEntry[]
  onChange: (value: string) => void
}

/** Combobox over the faculty directory: type a short form or a name, pick a match. */
export function FacultySearch({ id, describedBy, value, directory, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const listId = useId()
  const candidates = useMemo(() => searchFaculty(directory, value), [directory, value])
  const exact = candidates.length === 1 && candidates[0].entry.shortForm === value.trim().toUpperCase()
  const showList = open && candidates.length > 0 && !exact

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [])

  const pick = (entry: FacultyDirectoryEntry) => {
    onChange(entry.shortForm)
    setOpen(false)
  }

  return (
    <div ref={wrap} className="relative">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${cursor}` : undefined}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase())
          setOpen(true)
          setCursor(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setCursor((c) => Math.min(c + 1, candidates.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setCursor((c) => Math.max(c - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            pick(candidates[cursor].entry)
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder="ASHRAF or a name"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={40}
        className={`${inputClass} pl-9 font-mono tracking-wider uppercase`}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {candidates.map((c, i) => (
            <li
              key={c.entry.shortForm}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === cursor}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(c.entry)}
              onMouseEnter={() => setCursor(i)}
              className={cx(
                'flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm',
                i === cursor && 'bg-theory-50 dark:bg-theory-900/40',
              )}
            >
              <span className="min-w-0 truncate text-slate-800 dark:text-slate-100">
                {cleanPersonName(c.entry.name)}
                {c.entry.designation && (
                  <span className="ml-2 text-xs text-slate-500">{c.entry.designation}</span>
                )}
              </span>
              <span className="text-theory-700 dark:text-theory-100 shrink-0 font-mono text-xs font-semibold">
                {c.entry.shortForm}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
    </svg>
  )
}
