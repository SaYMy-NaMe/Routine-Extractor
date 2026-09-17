import { describe, expect, it } from 'vitest'
import {
  breakWaived,
  buildRoutine,
  buildRoutineGrid,
  freeColumns,
  gridReducer,
  rowLayout,
  usedTimeSlots,
} from '../../src/application'
import { EVENING_RANGE, EVENING_SLOT_ID, type ScheduleSlot } from '../../src/domain'
import { makeCell } from '../helpers/fixtures'

const base = buildRoutineGrid([
  makeCell('Sat', 690, 780, 'CSE 411', '6', 'N204'),
  makeCell('Sat', 930, 1050, 'CSE 112', '7', 'N607', 'lab'),
  makeCell('Tue', EVENING_RANGE.startMin, EVENING_RANGE.endMin, 'CSE 411', '', 'N202'),
  makeCell('Wed', EVENING_RANGE.startMin, EVENING_RANGE.endMin, 'CSE 226', '', 'N607', 'lab'),
])

const manual = (over: Partial<ScheduleSlot>): ScheduleSlot => ({
  id: 'm1',
  day: 'Mon',
  slotId: base.timeSlots[1].id,
  courseCode: 'CSE 443',
  section: '1',
  room: '311',
  type: 'theory',
  startMin: base.timeSlots[1].startMin,
  endMin: base.timeSlots[1].endMin,
  facultyTag: 'ASHRAF',
  source: 'manual',
  ...over,
})

describe('gridBuilder', () => {
  it('always keeps the evening column, assigns default frequencies to evening classes only', () => {
    const evening = base.timeSlots.find((t) => t.evening)!
    expect(evening.id).toBe(EVENING_SLOT_ID)
    expect(usedTimeSlots(base).map((t) => t.label)).toEqual([
      '11:30 AM - 1:00 PM',
      'Break',
      '3:00 PM - 4:30 PM',
      '6:30 PM - 9:30 PM',
    ])
    const by = (day: string) => base.slots.find((s) => s.day === day)!
    expect(by('Tue').frequency).toBe('weekly')
    expect(by('Wed').frequency).toBe('alternate')
    expect(by('Sat').frequency).toBeUndefined()
  })
})

describe('gridReducer', () => {
  it('upserts, removes and recomputes off-days', () => {
    expect(base.offDays.Mon).toBe('no-class')
    const added = gridReducer(base, { type: 'grid/upsertSlot', slot: manual({}) })
    expect(added.offDays.Mon).toBe('none')
    const edited = gridReducer(added, { type: 'grid/upsertSlot', slot: manual({ room: '312' }) })
    expect(edited.slots.filter((s) => s.id === 'm1')).toHaveLength(1)
    expect(edited.slots.find((s) => s.id === 'm1')!.room).toBe('312')
    const removed = gridReducer(edited, { type: 'grid/removeSlot', id: 'm1' })
    expect(removed.offDays.Mon).toBe('no-class')
  })

  it('keeps an explicit off-day badge while the day stays empty', () => {
    const g = gridReducer(base, { type: 'grid/setOffDay', day: 'Mon', status: 'weekend' })
    const g2 = gridReducer(g, { type: 'grid/removeSlot', id: 'nope' })
    expect(g2.offDays.Mon).toBe('weekend')
  })

  it('marks evening cells off (dropping their class) and clears the marker on new classes', () => {
    const off = gridReducer(base, { type: 'grid/setEveningOff', day: 'Tue', off: true })
    expect(off.eveningOff).toEqual(['Tue'])
    expect(off.slots.some((s) => s.day === 'Tue')).toBe(false)
    const back = gridReducer(off, {
      type: 'grid/upsertSlot',
      slot: manual({ id: 'e1', day: 'Tue', slotId: EVENING_SLOT_ID, type: 'lab' }),
    })
    expect(back.eveningOff).toEqual([])
    expect(back.slots.find((s) => s.id === 'e1')!.frequency).toBe('alternate')
  })

  it('adds and removes columns but never the evening one', () => {
    const g = gridReducer(base, { type: 'grid/addTimeSlot', range: { startMin: 7 * 60, endMin: 8 * 60 } })
    expect(g.timeSlots[0].label).toBe('7:00 AM - 8:00 AM')
    expect(gridReducer(g, { type: 'grid/addTimeSlot', range: { startMin: 60, endMin: 0 } })).toBe(g)
    expect(gridReducer(g, { type: 'grid/removeTimeSlot', id: EVENING_SLOT_ID })).toBe(g)
    const g2 = gridReducer(g, { type: 'grid/removeTimeSlot', id: g.timeSlots[0].id })
    expect(g2.timeSlots.length).toBe(g.timeSlots.length - 1)
  })
})

describe('one class per cell', () => {
  it('the builder keeps the first parsed class in a cell and reports the rest', () => {
    const { grid, skipped } = buildRoutine([
      makeCell('Sat', 690, 780, 'CSE 411', '6', 'N204'),
      makeCell('Sat', 690, 780, 'CSE 999', '1', 'N999'),
    ])
    expect(grid.slots.map((s) => s.courseCode)).toEqual(['CSE 411'])
    expect(skipped.map((c) => c.courseCode)).toEqual(['CSE 999'])
  })

  it('the reducer refuses to stack a second class onto an occupied cell', () => {
    const sat = base.slots.find((s) => s.day === 'Sat' && s.courseCode === 'CSE 411')!
    const intruder = manual({ id: 'x', day: 'Sat', slotId: sat.slotId })
    expect(gridReducer(base, { type: 'grid/upsertSlot', slot: intruder })).toBe(base)
    // Editing the occupant itself is fine.
    const edited = gridReducer(base, { type: 'grid/upsertSlot', slot: { ...sat, room: 'Z' } })
    expect(edited.slots.find((s) => s.id === sat.id)!.room).toBe('Z')
  })

  it('lists the free columns of a day', () => {
    const free = freeColumns(base, 'Sat').map((c) => c.label)
    expect(free).not.toContain('11:30 AM - 1:00 PM')
    expect(free).toContain('10:00 AM - 11:30 AM')
    expect(freeColumns(base, 'Sun')).toHaveLength(base.timeSlots.length - 1) // the break column never takes a class
  })

  it('user-added columns stay visible while empty and can be removed', () => {
    const g = gridReducer(base, { type: 'grid/addTimeSlot', range: { startMin: 7 * 60, endMin: 8 * 60 } })
    expect(g.timeSlots[0].pinned).toBe(true)
    expect(usedTimeSlots(g).map((t) => t.label)).toContain('7:00 AM - 8:00 AM')
    const g2 = gridReducer(g, { type: 'grid/removeTimeSlot', id: g.timeSlots[0].id })
    expect(usedTimeSlots(g2).map((t) => t.label)).not.toContain('7:00 AM - 8:00 AM')
  })
})

describe('daily break', () => {
  const breakCol = base.timeSlots.find((t) => t.isBreak)!

  it('is a fixed 1:00–1:30 PM column that never holds a class', () => {
    expect(breakCol.label).toBe('Break')
    expect(breakCol.startMin).toBe(13 * 60)
    expect(
      gridReducer(base, {
        type: 'grid/upsertSlot',
        slot: manual({ id: 'b', slotId: breakCol.id, startMin: 780, endMin: 810 }),
      }),
    ).toBe(base)
    expect(gridReducer(base, { type: 'grid/removeTimeSlot', id: breakCol.id })).toBe(base)
  })

  it('is waived on a day with a lab running 11:30 AM – 1:30 PM', () => {
    const { grid } = buildRoutine([
      makeCell('Sat', 690, 810, 'CSE 224', '3', '105', 'lab'), // 11:30–1:30 lab
      makeCell('Mon', 690, 780, 'CSE 443', '1', '311'), // theory ending at 1:00
      makeCell('Tue', 690, 810, 'CSE 215', '1', '110'), // theory 11:30–1:30 does not waive
    ])
    expect(breakWaived(grid, 'Sat')).toBe(true)
    expect(breakWaived(grid, 'Mon')).toBe(false)
    expect(breakWaived(grid, 'Tue')).toBe(false)
    // The 11:30–1:30 lab still lands in the 11:30–1:00 column, never in the break column.
    const sat = grid.slots.find((s) => s.day === 'Sat')!
    expect(grid.timeSlots.find((t) => t.id === sat.slotId)!.label).toBe('11:30 AM - 1:00 PM')
  })
})

describe('rowLayout (cell merging)', () => {
  it('merges an 11:30–1:30 lab across the 11:30 column and the break', () => {
    const { grid } = buildRoutine([
      makeCell('Sat', 690, 810, 'CSE 224', '3', '105', 'lab'),
      makeCell('Sat', 900, 990, 'CSE 443', '3', 'N604'),
    ])
    const cols = usedTimeSlots(grid)
    const cells = rowLayout(grid, 'Sat', cols)
    const lab = cells.find((c) => c.slot?.courseCode === 'CSE 224')!
    expect(lab.span).toBe(2)
    expect(lab.columns.map((c) => c.label)).toEqual(['11:30 AM - 1:00 PM', 'Break'])
    // The absorbed break column is not emitted again, and totals still cover every column.
    expect(cells.some((c) => c.column.isBreak)).toBe(false)
    expect(cells.reduce((n, c) => n + c.span, 0)).toBe(cols.length)
  })

  it('does not merge theory classes or labs that end at 1:00', () => {
    const { grid } = buildRoutine([
      makeCell('Mon', 690, 810, 'CSE 215', '1', '110'), // theory 11:30–1:30
      makeCell('Tue', 690, 780, 'CSE 226', '5', '115', 'lab'), // lab ending 1:00
    ])
    const cols = usedTimeSlots(grid)
    expect(rowLayout(grid, 'Mon', cols).every((c) => c.span === 1)).toBe(true)
    expect(rowLayout(grid, 'Tue', cols).every((c) => c.span === 1)).toBe(true)
    expect(rowLayout(grid, 'Mon', cols).some((c) => c.column.isBreak)).toBe(true)
  })
})
