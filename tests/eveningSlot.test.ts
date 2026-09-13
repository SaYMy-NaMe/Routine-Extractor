import { describe, expect, it } from 'vitest'
import {
  buildRoutineGrid,
  usedTimeSlots,
  visibleTimeSlots,
  EVENING_SLOT_ID,
} from '../src/services/routineBuilder'
import { defaultFrequency, type ParsedCell } from '../src/types/routine'

const cell = (
  day: ParsedCell['day'],
  start: number,
  end: number,
  code: string,
  kind: ParsedCell['tableKind'],
): ParsedCell => ({
  day,
  tableKind: kind,
  room: 'N202',
  slotLabel: '',
  startMin: start,
  endMin: end,
  rawText: `${code} / ASHRAF`,
  courseCode: code,
  section: '',
  facultyTag: 'ASHRAF',
  page: 1,
})

describe('evening slot rules', () => {
  it('theory defaults to weekly, lab to alternating', () => {
    expect(defaultFrequency('theory')).toBe('weekly')
    expect(defaultFrequency('lab')).toBe('alternate')
  })

  it('always keeps the 6:30–9:30 PM column visible, even when empty', () => {
    const grid = buildRoutineGrid([cell('Sat', 690, 780, 'CSE 411', 'theory')])
    const evening = grid.timeSlots.find((t) => t.evening)!
    expect(evening.id).toBe(EVENING_SLOT_ID)
    expect(evening.label).toBe('6:30 PM - 9:30 PM')
    expect(usedTimeSlots(grid).map((t) => t.label)).toEqual(['11:30 AM - 1:00 PM', '6:30 PM - 9:30 PM'])
    expect(visibleTimeSlots(grid, true).length).toBe(grid.timeSlots.length)
    expect(grid.eveningOff).toEqual([])
  })

  it('assigns default frequencies to parsed evening classes only', () => {
    const grid = buildRoutineGrid([
      cell('Tue', 18 * 60 + 30, 21 * 60 + 30, 'CSE 411', 'theory'),
      cell('Wed', 18 * 60 + 30, 21 * 60 + 30, 'CSE 226', 'lab'),
      cell('Thu', 690, 780, 'CSE 443', 'theory'),
    ])
    const by = (day: string) => grid.slots.find((s) => s.day === day)!
    expect(by('Tue').slotId).toBe(EVENING_SLOT_ID)
    expect(by('Tue').frequency).toBe('weekly')
    expect(by('Wed').frequency).toBe('alternate')
    expect(by('Thu').frequency).toBeUndefined()
  })
})
