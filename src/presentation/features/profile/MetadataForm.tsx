import { useMemo, type ChangeEvent } from 'react'
import { type FacultyDirectoryEntry, type FacultyProfile, validateProfile } from '../../../domain'
import { Field, Input } from '../../components/ui'
import { useFacultyInitial } from '../../hooks/useFacultyInitial'
import { FacultySearch } from './FacultySearch'

interface Props {
  profile: FacultyProfile
  onChange: (patch: Partial<FacultyProfile>) => void
  directory: readonly FacultyDirectoryEntry[]
  matchCount: number
  routineLoaded: boolean
  /** The selected master routine owns the semester; the field is read-only then. */
  semesterLocked: boolean
  /** Short form that auto-filled the profile, if any, and the fields it supplied. */
  autoFilledTag: string | null
  autoFilledFields: readonly (keyof FacultyProfile)[]
}

interface TextFieldSpec {
  key: keyof FacultyProfile
  label: string
  placeholder: string
  type?: 'email' | 'tel'
  span?: boolean
}

const FIELDS: readonly TextFieldSpec[] = [
  {
    key: 'fullName',
    label: 'Full name',
    placeholder: 'Ashrafur Rahman Chowdhury',
    span: true,
  },
  { key: 'title', label: 'Designation', placeholder: 'Lecturer' },
  { key: 'department', label: 'Department', placeholder: 'Computer Science and Engineering' },
  {
    key: 'school',
    label: 'School / faculty',
    placeholder: 'School of Science, Engineering and Technology',
    span: true,
  },
  { key: 'institution', label: 'Institution', placeholder: 'East Delta University' },
  { key: 'email', label: 'Email', placeholder: 'name@university.edu', type: 'email' },
  { key: 'phone', label: 'Phone', placeholder: '+880 1XXX-XXXXXX', type: 'tel' },
]

/** Search term + the header/footer metadata printed on the generated routine. */
export function MetadataForm({
  profile,
  onChange,
  directory,
  matchCount,
  routineLoaded,
  semesterLocked,
  autoFilledTag,
  autoFilledFields,
}: Props) {
  const errors = useMemo(() => validateProfile(profile), [profile])
  const initial = useFacultyInitial()
  const set = (key: keyof FacultyProfile) => (e: ChangeEvent<HTMLInputElement>) =>
    onChange({ [key]: e.target.value })

  const searchHint = !routineLoaded
    ? 'Select a master routine first'
    : !profile.searchQuery.trim()
      ? 'Type the faculty initial (e.g. ASHRAF or MHN)'
      : matchCount
        ? `${matchCount} class${matchCount === 1 ? '' : 'es'} found${autoFilledTag ? ` · profile filled from the directory` : ''}`
        : 'No classes found for this term'

  return (
    <div className="space-y-5">
      <Field label="Faculty initial" hint={searchHint} error={errors.searchQuery}>
        {(id, describedBy) => (
          <FacultySearch
            id={id}
            describedBy={describedBy}
            value={initial.value}
            directory={directory}
            onChange={initial.onChange}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            error={errors[f.key]}
            hint={
              autoFilledFields.includes(f.key)
                ? `Filled from initial ${autoFilledTag} — cleared when the initial is erased`
                : undefined
            }
            className={f.span ? 'sm:col-span-2' : undefined}
          >
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type={f.type}
                value={profile[f.key]}
                onChange={set(f.key)}
                placeholder={f.placeholder}
                invalid={Boolean(errors[f.key])}
                maxLength={200}
              />
            )}
          </Field>
        ))}
        <Field
          label="Semester"
          hint={
            semesterLocked
              ? 'Set by the selected master routine'
              : 'Select a master routine to set this automatically'
          }
        >
          {(id, describedBy) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={profile.semester}
              onChange={set('semester')}
              placeholder="Summer 2026"
              readOnly={semesterLocked}
              aria-readonly={semesterLocked}
              className={
                semesterLocked
                  ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  : undefined
              }
              maxLength={40}
            />
          )}
        </Field>
      </div>
    </div>
  )
}
