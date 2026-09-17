import { Button } from '../components/ui'
import { useTheme } from '../hooks/useTheme'

export function AppHeader() {
  const [theme, toggleTheme] = useTheme()
  return (
    <header className="no-print sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <h1 className="truncate text-base leading-tight font-semibold text-slate-900 dark:text-slate-50">
              Faculty Routine Extractor
            </h1>
            <p className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">
              Departmental routine → personal routine, workload &amp; exports
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
          <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </Button>
      </div>
    </header>
  )
}
