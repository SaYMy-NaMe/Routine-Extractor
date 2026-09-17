import { describe, expect, it } from 'vitest'
import { EMPTY_PROFILE, cleanPersonName, coerceProfile, validateProfile } from '../../src/domain'

describe('profile', () => {
  it('validates email and phone', () => {
    expect(validateProfile({ ...EMPTY_PROFILE, email: 'nope' }).email).toBeDefined()
    expect(validateProfile({ ...EMPTY_PROFILE, email: 'a@b.co', phone: '+880 1798-262185' })).toEqual({})
    expect(validateProfile({ ...EMPTY_PROFILE, phone: 'call me' }).phone).toBeDefined()
  })
  it('coerces persisted junk safely', () => {
    expect(coerceProfile(null)).toEqual(EMPTY_PROFILE)
    expect(coerceProfile({ fullName: 42, email: 'x@y.zz', extra: true })).toMatchObject({
      fullName: '',
      email: 'x@y.zz',
    })
  })
  it('strips honorifics', () => {
    expect(cleanPersonName('Mr. Ashrafur Rahman Chowdhury')).toBe('Ashrafur Rahman Chowdhury')
    expect(cleanPersonName('Dr Jane')).toBe('Jane')
    expect(cleanPersonName('Mr.Mehedi Hasan Jony')).toBe('Mehedi Hasan Jony')
    expect(cleanPersonName('Mdx Person')).toBe('Mdx Person')
  })
})
