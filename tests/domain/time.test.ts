import { describe, expect, it } from 'vitest'
import {
  formatRange,
  formatTime,
  fromInputTime,
  isTimeRange,
  overlapMinutes,
  parseTimeRange,
  toInputTime,
} from '../../src/domain'

describe('time', () => {
  it('parses routine-style ranges without meridiem', () => {
    expect(parseTimeRange('8.30-10.00')).toEqual({ startMin: 510, endMin: 600 })
    expect(parseTimeRange('1.30-3.00')).toEqual({ startMin: 810, endMin: 900 })
    expect(parseTimeRange('6.30-9.30')).toEqual({ startMin: 1110, endMin: 1290 })
    expect(parseTimeRange('11.30-1.00')).toEqual({ startMin: 690, endMin: 780 })
  })
  it('parses explicit meridiem and rejects junk', () => {
    expect(parseTimeRange('10:00 AM - 11:30 AM')).toEqual({ startMin: 600, endMin: 690 })
    expect(parseTimeRange('12:00 PM - 1:00 PM')).toEqual({ startMin: 720, endMin: 780 })
    expect(parseTimeRange('Day 1')).toBeNull()
    expect(isTimeRange('3.00-4.30')).toBe(true)
    expect(isTimeRange('CSE 443')).toBe(false)
  })
  it('formats and round-trips input values', () => {
    expect(formatTime(810)).toBe('1:30 PM')
    expect(formatRange({ startMin: 600, endMin: 690 })).toBe('10:00 AM - 11:30 AM')
    expect(toInputTime(510)).toBe('08:30')
    expect(fromInputTime('18:30')).toBe(1110)
    expect(fromInputTime('')).toBe(0)
  })
  it('computes overlap', () => {
    expect(overlapMinutes({ startMin: 900, endMin: 990 }, { startMin: 930, endMin: 1050 })).toBe(60)
    expect(overlapMinutes({ startMin: 0, endMin: 60 }, { startMin: 60, endMin: 120 })).toBe(0)
  })
})
