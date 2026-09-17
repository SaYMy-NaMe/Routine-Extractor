import { describe, expect, it } from 'vitest'
import {
  buildRoutine,
  buildRoutineGrid,
  freeColumns,
  gridReducer,
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
    expect(freeColumns(base, 'Sun')).toHaveLength(base.timeSlots.length)
  })

  it('user-added columns stay visible while empty and can be removed', () => {
    const g = gridReducer(base, { type: 'grid/addTimeSlot', range: { startMin: 7 * 60, endMin: 8 * 60 } })
    expect(g.timeSlots[0].pinned).toBe(true)
    expect(usedTimeSlots(g).map((t) => t.label)).toContain('7:00 AM - 8:00 AM')
    const g2 = gridReducer(g, { type: 'grid/removeTimeSlot', id: g.timeSlots[0].id })
    expect(usedTimeSlots(g2).map((t) => t.label)).not.toContain('7:00 AM - 8:00 AM')
  })
})
