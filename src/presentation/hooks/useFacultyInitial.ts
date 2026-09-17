import { useCallback, useEffect } from 'react'
import { AUTO_FILL_KEYS, resolveFaculty } from '../../application'
import { useRoutine } from './useRoutine'

/**
 * Explicit reactive listener for the Faculty Initial field.
 *
 * Every change flows through `onChange`, which decides synchronously:
 *   - empty initial  → erase Full name / School / Institution to ""
 *   - resolved match → fill exactly those three fields
 *   - anything else  → leave the profile untouched
 * A companion effect re-runs the same decision when the active master
 * routine changes (a different directory can resolve the same initial).
 */
export function useFacultyInitial() {
  const { state, actions } = useRoutine()
  const parse = state.library.active?.parse ?? null
  const { searchQuery } = state.profile

  const onChange = useCallback(
    (raw: string) => {
      const initial = raw.toUpperCase()
      actions.patchProfile({ searchQuery: initial })
      if (!initial.trim()) {
        actions.eraseAutoFill(AUTO_FILL_KEYS)
        return
      }
      const match = parse ? resolveFaculty(parse, initial) : null
      if (match) actions.applyAutoFill(match.entry.shortForm, match.fields)
    },
    [actions, parse],
  )

  // Re-resolve when the directory changes underneath a typed initial.
  useEffect(() => {
    if (!parse || !searchQuery.trim()) return
    const match = resolveFaculty(parse, searchQuery)
    if (match && match.entry.shortForm !== state.autoFilledTag)
      actions.applyAutoFill(match.entry.shortForm, match.fields)
  }, [parse, searchQuery, state.autoFilledTag, actions])

  return { value: searchQuery, onChange }
}
