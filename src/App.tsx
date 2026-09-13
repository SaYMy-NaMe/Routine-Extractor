import { AppHeader } from './components/AppHeader'
import { FileDropzone } from './components/FileDropzone'
import { MetadataForm } from './components/MetadataForm'
import { Card } from './components/ui'
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
          <Card title="1 · Routine PDF" subtitle="The whole-department routine published by the office">
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

        {state.grid && (
          <Card title="3 · Routine preview" subtitle="Interactive grid coming in the next step">
            <pre className="overflow-x-auto text-xs">{JSON.stringify(state.grid.slots, null, 1)}</pre>
          </Card>
        )}
      </main>
    </div>
  )
}

export default App
