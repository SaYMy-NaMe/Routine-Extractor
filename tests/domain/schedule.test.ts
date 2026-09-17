import { describe, expect, it } from 'vitest'
import {
  BREAK_RANGE,
  EVENING_RANGE,
  coversBreak,
  defaultFrequency,
  makeTimeSlot,
  parseCourseCode,
  parseDayName,
  sessionLabel,
  sessionTiming,
  type ScheduleSlot,
} from '../../src/domain'

const slot = (over: Partial<ScheduleSlot>): ScheduleSlot => ({
  id: 'x',
  day: 'Tue',
  slotId: 'c',
  courseCode: 'CSE 411',
  section: '',
  room: 'N202',
  type: 'theory',
  startMin: 0,
  endMin: 1,
  facultyTag: '',
  source: 'manual',
  ...over,
})

describe('schedule domain', () => {
  it('parses day names loosely', () => {
    expect(parseDayName('Saturday')).toBe('Sat')
    expect(parseDayName('thurs.')).toBe('Thu')
    expect(parseDayName('Tues')).toBe('Tue')
    expect(parseDayName('Day 1')).toBeNull()
    expect(parseDayName('Satellite')).toBeNull()
  })
  it('normalises course codes', () => {
    expect(parseCourseCode('cse-443.2')).toEqual({ courseCode: 'CSE 443', section: '2', rest: '' })
    expect(parseCourseCode('CSE 215.1 (11.30-1.30)')).toEqual({
      courseCode: 'CSE 215',
      section: '1',
      rest: '(11.30-1.30)',
    })
    expect(parseCourseCode('hello')).toBeNull()
  })
  it('applies evening rules', () => {
    expect(defaultFrequency('theory')).toBe('weekly')
    expect(defaultFrequency('lab')).toBe('alternate')
    const evening = makeTimeSlot(EVENING_RANGE)
    expect(evening.evening).toBe(true)
    expect(evening.label).toBe('6:30 PM - 9:30 PM')
    expect(sessionLabel(slot({ frequency: 'weekly' }), evening)).toBe('CSE 411 [Weekly]')
    expect(sessionLabel(slot({ courseCode: 'CSE 226', section: '5', type: 'lab' }))).toBe('CSE 226.5 LAB')
  })

  it('prints explicit timings for labs only and knows when a lab covers the break', () => {
    const lab = slot({ type: 'lab', startMin: 690, endMin: 810 })
    expect(sessionTiming(lab)).toBe('11:30 AM - 1:30 PM')
    expect(sessionTiming(slot({ type: 'theory', startMin: 690, endMin: 810 }))).toBeNull()
    expect(coversBreak(lab)).toBe(true)
    expect(coversBreak({ startMin: 690, endMin: 780 })).toBe(false)
    expect(makeTimeSlot(BREAK_RANGE)).toMatchObject({ isBreak: true, label: 'Break' })
  })
})
