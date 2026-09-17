/** Faculty metadata printed in the header/footer of the generated routine. */

export interface FacultyProfile {
  /** Term used to find the faculty in the routine matrix, e.g. "ASHRAF". */
  searchQuery: string
  fullName: string
  title: string
  department: string
  school: string
  institution: string
  email: string
  phone: string
  semester: string
}

export const EMPTY_PROFILE: Readonly<FacultyProfile> = Object.freeze({
  searchQuery: '',
  fullName: '',
  title: 'Lecturer',
  department: 'Computer Science and Engineering',
  school: 'School of Science, Engineering and Technology',
  institution: 'East Delta University',
  email: '',
  phone: '',
  semester: '',
})

export type ProfileErrors = Partial<Record<keyof FacultyProfile, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_RE = /^\+?[\d\s()-]{6,20}$/

/** Field-level validation; empty optional fields are valid. */
export function validateProfile(p: FacultyProfile): ProfileErrors {
  const errors: ProfileErrors = {}
  if (p.email && !EMAIL_RE.test(p.email.trim())) errors.email = 'Enter a valid email address'
  if (p.phone && !PHONE_RE.test(p.phone.trim())) errors.phone = 'Enter a valid phone number'
  if (p.fullName.length > 120) errors.fullName = 'Name is too long'
  if (p.searchQuery.length > 40) errors.searchQuery = 'Search term is too long'
  return errors
}

/** Strip "Mr."/"Dr." style honorifics from directory names for the headline. */
export function cleanPersonName(name: string): string {
  return name.replace(/^(mr|mrs|ms|dr|prof|engr|md)\.?\s+/i, '').trim()
}

/** Coerce unknown (e.g. persisted) data into a valid profile. */
export function coerceProfile(input: unknown): FacultyProfile {
  const out: FacultyProfile = { ...EMPTY_PROFILE }
  if (!input || typeof input !== 'object') return out
  for (const key of Object.keys(out) as (keyof FacultyProfile)[]) {
    const v = (input as Record<string, unknown>)[key]
    if (typeof v === 'string') out[key] = v.slice(0, 200)
  }
  return out
}
