import type { FacultyProfile } from '../types/routine'
import { Field, Input, inputClass } from './ui'

interface Props {
  profile: FacultyProfile
  onChange: (patch: Partial<FacultyProfile>) => void
  /** Faculty short forms discovered in the PDF, offered as autocomplete. */
  suggestions: string[]
  matchCount: number
  fileLoaded: boolean
}

/** Search term + the header/footer metadata printed on the generated routine. */
export function MetadataForm({ profile, onChange, suggestions, matchCount, fileLoaded }: Props) {
  const set = (key: keyof FacultyProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ [key]: e.target.value })

  const searchState = !fileLoaded
    ? 'Load a PDF first'
    : !profile.searchQuery.trim()
      ? 'Enter the short form used in the routine (e.g. ASHRAF)'
      : matchCount
        ? `${matchCount} class${matchCount === 1 ? '' : 'es'} found`
        : 'No classes found for this term'

  return (
    <div className="space-y-5">
      <Field label="Faculty search term" hint={searchState}>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            list="faculty-tags"
            value={profile.searchQuery}
            onChange={(e) => onChange({ searchQuery: e.target.value.toUpperCase() })}
            placeholder="ASHRAF"
            autoCapitalize="characters"
            spellCheck={false}
            className={`${inputClass} pl-9 font-mono tracking-wider uppercase`}
          />
          <datalist id="faculty-tags">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" className="sm:col-span-2">
          <Input value={profile.fullName} onChange={set('fullName')} placeholder="Ashrafur Rahman Chowdhury" />
        </Field>
        <Field label="Title / designation">
          <Input value={profile.title} onChange={set('title')} placeholder="Lecturer" />
        </Field>
        <Field label="Department">
          <Input value={profile.department} onChange={set('department')} placeholder="Computer Science and Engineering" />
        </Field>
        <Field label="School / faculty" className="sm:col-span-2">
          <Input value={profile.school} onChange={set('school')} placeholder="School of Science, Engineering and Technology" />
        </Field>
        <Field label="Institution">
          <Input value={profile.institution} onChange={set('institution')} placeholder="East Delta University" />
        </Field>
        <Field label="Semester">
          <Input value={profile.semester} onChange={set('semester')} placeholder="Summer 2026" />
        </Field>
        <Field label="Email">
          <Input type="email" value={profile.email} onChange={set('email')} placeholder="name@university.edu" />
        </Field>
        <Field label="Phone">
          <Input type="tel" value={profile.phone} onChange={set('phone')} placeholder="+880 1XXX-XXXXXX" />
        </Field>
      </div>
    </div>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
    </svg>
  )
}
