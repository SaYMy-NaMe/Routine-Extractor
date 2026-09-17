import { describe, expect, it } from 'vitest'
import { buildRoutineGrid, emptyDayView, gridReducer, visibleDays } from '../../src/application'
import {
  DEFAULT_EMPTY_DAY_SETTINGS,
  EVENING_RANGE,
  badgeDisplayText,
  coerceEmptyDaySettings,
  type EmptyDaySettings,
} from '../../src/domain'
import { makeCell } from '../helpers/fixtures'

const grid = buildRoutineGrid([
  makeCell('Sat', 690, 780, 'CSE 411', '6', 'N204'),
  makeCell('Tue', EVENING_RANGE.startMin, EVENING_RANGE.endMin, 'CSE 411', '', 'N202'), // evening only
])
const S = DEFAULT_EMPTY_DAY_SETTINGS

describe('emptyDayView', () => {
  it('detects empty days and spans the evening cell by default', () => {
    expect(emptyDayView(grid, 'Sat', S)).toBeNull()
    expect(emptyDayView(grid, 'Sun', S)).toEqual({ kind: 'no-class', spansEvening: true, collapsed: false })
    expect(emptyDayView(grid, 'Fri', S)).toEqual({ kind: 'weekend', spansEvening: true, collapsed: false })
    // Tuesday has an evening class → not empty when the evening slot counts.
    expect(emptyDayView(grid, 'Tue', S)).toBeNull()
  })

  it('excludes the evening slot from the empty state when asked', () => {
    const noEvening: EmptyDaySettings = { ...S, spanEvening: false }
    expect(emptyDayView(grid, 'Tue', noEvening)).toEqual({
      kind: 'no-class',
      spansEvening: false,
      collapsed: false,
    })
    expect(emptyDayView(grid, 'Sun', noEvening)?.spansEvening).toBe(false)
  })

  it('respects layout modes and the user\'s "show cells" choice', () => {
    expect(emptyDayView(grid, 'Sun', { ...S, mode: 'cells' })).toBeNull()
    expect(emptyDayView(grid, 'Sun', { ...S, mode: 'collapsed' })?.collapsed).toBe(true)
    const shown = gridReducer(grid, { type: 'grid/setOffDay', day: 'Sun', status: 'none' })
    expect(emptyDayView(shown, 'Sun', S)).toBeNull()
    expect(visibleDays(grid, S)).toHaveLength(7)
    expect(visibleDays(grid, { ...S, mode: 'hidden' })).toEqual(['Sat', 'Tue'])
    expect(visibleDays(grid, { ...S, mode: 'hidden', spanEvening: false })).toEqual(['Sat'])
  })
})

describe('badge settings', () => {
  it('formats display text with case and icon rules', () => {
    const b = S.badges['no-class']
    expect(badgeDisplayText(b)).toBe('NO CLASS ON THIS DAY')
    expect(badgeDisplayText({ ...b, uppercase: false, showIcon: true })).toBe('🚫 No Class On this day')
    expect(badgeDisplayText({ ...b, showIcon: true }, { icon: false })).toBe('NO CLASS ON THIS DAY')
    expect(badgeDisplayText({ ...b, text: '   ' })).toBe('NO CLASS')
  })

  it('coerces persisted junk defensively', () => {
    expect(coerceEmptyDaySettings(null)).toEqual(S)
    const c = coerceEmptyDaySettings({
      mode: 'weird',
      spanEvening: false,
      badges: { 'no-class': { text: 'Free day', background: 'red', bold: 'yes', border: 'accent' } },
    })
    expect(c.mode).toBe('badge')
    expect(c.spanEvening).toBe(false)
    expect(c.badges['no-class']).toMatchObject({
      text: 'Free day',
      background: '#F3F4F6',
      bold: true,
      border: 'accent',
    })
    expect(c.badges.weekend).toEqual(S.badges.weekend)
  })
})
