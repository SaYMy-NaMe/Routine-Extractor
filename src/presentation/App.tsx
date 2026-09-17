import { lazy, Suspense, useMemo } from 'react'
import { DEFAULT_EMPTY_DAY_SETTINGS } from '../domain'
import { type ExportData, usedTimeSlots } from '../application'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Card, Spinner } from './components/ui'
import { ExportControls } from './features/export/ExportControls'
import { RoutineGrid } from './features/grid/RoutineGrid'
import { MasterRoutineLibrary } from './features/library/MasterRoutineLibrary'
import { MetadataForm } from './features/profile/MetadataForm'
import { WorkloadSummary } from './features/workload/WorkloadSummary'
import { useRoutine } from './hooks/useRoutine'
import { useServices } from './hooks/useServices'
import { AppHeader } from './layout/AppHeader'
import { Toaster } from './toast/Toaster'

// The print sheet (and its stylesheet) is only needed once a routine exists.
const RoutineSheet = lazy(() =>
  import('./features/preview/RoutineSheet').then((m) => ({ default: m.RoutineSheet })),
)

export function App() {
  const { state, matches, workload, directory, semesterLocked, actions } = useRoutine()
  const { toasts } = useServices()
  const active = state.library.active
  const hasRoutine =
    active !== null && (state.profile.searchQuery.trim() !== '' || state.grid.slots.length > 0)

  const exportData = useMemo<ExportData>(
    () => ({
      profile: state.profile,
      grid: state.grid,
      columns: usedTimeSlots(state.grid),
      workload,
      emptyDay: DEFAULT_EMPTY_DAY_SETTINGS,
    }),
    [state.profile, state.grid, workload],
  )

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6">
        <div className="no-print grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]">
          <Card
            title="1 · Master routines"
            subtitle={
              active
                ? `Selected: ${active.title} — ${active.fileName}`
                : 'Pick a stored semester routine or upload a new one'
            }
          >
            <MasterRoutineLibrary />
            {active?.parse.warnings.length ? (
              <ul className="mt-3 space-y-1 text-xs text-amber-700 dark:text-amber-300">
                {active.parse.warnings.map((w) => (
                  <li key={w}>⚠ {w}</li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card
            title="2 · Faculty & header details"
            subtitle="Search the faculty directory; matched details are filled in for you"
          >
            <MetadataForm
              profile={state.profile}
              onChange={actions.patchProfile}
              directory={directory}
              matchCount={matches.length}
              routineLoaded={active !== null}
              semesterLocked={semesterLocked}
              autoFilledTag={state.autoFilledTag}
              autoFilledFields={state.autoFilledFields}
            />
          </Card>
        </div>

        {hasRoutine && (
          <ErrorBoundary>
            <Card
              className="no-print"
              title="3 · Routine matrix"
              subtitle="One class per cell. Tap a class to edit it, or an empty cell to add one."
            >
              <RoutineGrid grid={state.grid} />
            </Card>

            <Card
              className="no-print"
              title="4 · Credit workload"
              subtitle="Theory 3.0 credits per section · Lab 1.5 credits per section"
            >
              <WorkloadSummary summary={workload} onTitleChange={actions.setCourseTitle} />
            </Card>

            <Card
              className="no-print"
              title="5 · Export"
              subtitle="Single-page landscape PDF or editable Word document"
            >
              <ExportControls data={exportData} />
            </Card>

            <Card
              className="print-sheet-card"
              title="6 · Print preview"
              subtitle="Exactly what the exported PDF will look like"
            >
              <div className="overflow-x-auto">
                <Suspense fallback={<Spinner className="text-theory-500 mx-auto my-8 h-6 w-6" />}>
                  <RoutineSheet data={exportData} />
                </Suspense>
              </div>
            </Card>
          </ErrorBoundary>
        )}
      </main>
      <Toaster store={toasts} />
    </div>
  )
}
