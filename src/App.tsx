import { AppHeader } from './components/AppHeader'
import { ExportControls } from './components/ExportControls'
import { FileDropzone } from './components/FileDropzone'
import { MetadataForm } from './components/MetadataForm'
import { RoutineGrid } from './components/RoutineGrid'
import { RoutineSheet } from './components/RoutineSheet'
import { WorkloadSummary } from './components/WorkloadSummary'
import { Card } from './components/ui'
import { visibleTimeSlots } from './services/routineBuilder'
import { useRoutineState } from './hooks/useRoutineState'
import { useTheme } from './hooks/useTheme'

function App() {
  const [theme, toggleTheme] = useTheme()
  const state = useRoutineState()

  return (
    <div className="min-h-screen">
      <AppHeader theme={theme} onToggleTheme={toggleTheme} />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="no-print grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Card
            title="1 · Master routine file"
            subtitle="The whole-department routine (.pdf or .docx) published by the office"
          >
            <FileDropzone status={state.status} onFile={state.loadFile} onReset={state.reset} />
            {state.parse?.warnings.length ? (
              <ul className="mt-3 space-y-1 text-xs text-amber-700 dark:text-amber-300">
                {state.parse.warnings.map((w) => (
                  <li key={w}>⚠ {w}</li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card title="2 · Faculty & header details" subtitle="Printed on the generated routine">
            <MetadataForm
              profile={state.profile}
              onChange={state.setProfile}
              suggestions={state.directoryTags}
              matchCount={state.matches.length}
              fileLoaded={state.status.kind === 'ready'}
            />
          </Card>
        </div>

        {state.grid && (state.profile.searchQuery.trim() || state.grid.slots.length > 0) && (
          <>
            <Card
              className="no-print"
              title="3 · Routine matrix"
              subtitle="Click a class to edit it, hover an empty cell to add one. Edits are kept until you re-extract."
            >
              <RoutineGrid
                grid={state.grid}
                showEmptyColumns={state.showEmptyColumns}
                onToggleEmptyColumns={state.setShowEmptyColumns}
                onUpsertSlot={state.upsertSlot}
                onRemoveSlot={state.removeSlot}
                onSetOffDay={state.setOffDay}
                onSetEveningOff={state.setEveningOff}
                onAddTimeSlot={state.addTimeSlot}
                onRemoveTimeSlot={state.removeTimeSlot}
                onReset={state.rebuildGrid}
                newManualSlot={state.newManualSlot}
              />
            </Card>

            <Card
              className="no-print"
              title="4 · Credit workload"
              subtitle="Theory 3.0 credits per section · Lab 1.5 credits per section"
            >
              <WorkloadSummary summary={state.workload} onTitleChange={state.setCourseTitle} />
            </Card>

            <Card
              className="no-print"
              title="5 · Export"
              subtitle="Single-page landscape PDF or editable Word document"
            >
              <ExportControls
                data={{
                  profile: state.profile,
                  grid: state.grid,
                  columns: visibleTimeSlots(state.grid, state.showEmptyColumns),
                  workload: state.workload,
                }}
              />
            </Card>

            <Card
              className="print-sheet-card"
              title="6 · Print preview"
              subtitle="Exactly what the exported PDF will look like"
            >
              <div className="overflow-x-auto">
                <RoutineSheet
                  profile={state.profile}
                  grid={state.grid}
                  columns={visibleTimeSlots(state.grid, state.showEmptyColumns)}
                  workload={state.workload}
                />
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

export default App
