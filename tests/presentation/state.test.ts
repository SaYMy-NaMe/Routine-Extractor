import { describe, expect, it } from 'vitest'
import { EMPTY_PROFILE, type MasterRoutine } from '../../src/domain'
import { EMPTY_GRID, parseRoutinePages } from '../../src/application'
import { initialState, routineReducer } from '../../src/presentation/providers/routineState'
import { clampScale } from '../../src/presentation/features/grid/viewSettings'
import { MemoryStorage } from '../../src/infrastructure'
import { ToastStore } from '../../src/presentation/toast/toastStore'

const routine: MasterRoutine = {
  id: 'r1',
  title: 'Fall 2026',
  fileName: 'r.docx',
  format: 'docx',
  uploadedAt: '2026-09-01T00:00:00.000Z',
  cellCount: 0,
  pageCount: 0,
  parse: parseRoutinePages([]),
}

describe('routineReducer', () => {
  it('tracks the import flow and locks the semester to the active routine', () => {
    let s = routineReducer(initialState(), { type: 'import/reading', fileName: 'r.pdf' })
    expect(s.importStatus.kind).toBe('reading')
    s = routineReducer(s, { type: 'import/done' })
    expect(s.importStatus.kind).toBe('idle')
    s = routineReducer(s, { type: 'profile/patch', patch: { fullName: 'X', semester: 'Typed' } })
    s = routineReducer(s, { type: 'library/activate', routine })
    expect(s.profile).toEqual({ ...EMPTY_PROFILE, fullName: 'X', semester: 'Fall 2026' })
    expect(s.library.active?.id).toBe('r1')
    s = routineReducer(s, { type: 'library/activate', routine: null })
    expect(s.grid).toBe(EMPTY_GRID)
  })

  it('records auto-filled tags and delegates grid actions', () => {
    const s = routineReducer(initialState(), {
      type: 'profile/autoFilled',
      tag: 'ASHRAF',
      patch: { fullName: 'A' },
    })
    expect(s.autoFilledTag).toBe('ASHRAF')
    expect(s.autoFilledFields).toEqual(['fullName'])
    const erased = routineReducer(
      { ...s, profile: { ...s.profile, school: 'S', institution: 'I' } },
      { type: 'profile/autoErased', keys: ['fullName', 'school', 'institution'] },
    )
    expect(erased.profile).toMatchObject({ fullName: '', school: '', institution: '' })
    expect(erased.autoFilledTag).toBeNull()
    expect(s.profile.fullName).toBe('A')
    expect(routineReducer(s, { type: 'grid/removeTimeSlot', id: 'missing' })).toBe(s)
  })
})

describe('view + infrastructure helpers', () => {
  it('clamps the grid scale', () => {
    expect(clampScale(9)).toBe(1.5)
    expect(clampScale(0.1)).toBe(0.75)
    expect(clampScale(Number.NaN)).toBe(1)
  })

  it('MemoryStorage round-trips', () => {
    const m = new MemoryStorage()
    m.set('k', { a: 1 })
    expect(m.get('k')).toEqual({ a: 1 })
    m.remove('k')
    expect(m.get('k')).toBeNull()
  })

  it('ToastStore notifies subscribers and dismisses', () => {
    const store = new ToastStore()
    let calls = 0
    const off = store.subscribe(() => calls++)
    const id = store.notify('error', 'boom', 0)
    expect(store.getSnapshot()).toHaveLength(1)
    store.dismiss(id)
    expect(store.getSnapshot()).toHaveLength(0)
    expect(calls).toBe(2)
    off()
  })
})
