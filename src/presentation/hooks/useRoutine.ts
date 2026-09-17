import { useContext } from 'react'
import { RoutineContext, type RoutineContextValue } from '../providers/routineContext'

export function useRoutine(): RoutineContextValue {
  const ctx = useContext(RoutineContext)
  if (!ctx) throw new Error('useRoutine must be used inside <RoutineProvider>')
  return ctx
}
