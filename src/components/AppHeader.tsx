import { Button } from './ui'

export function AppHeader({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  return (
    <header className="no-print sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg" />
          <div>
            <h1 className="text-base leading-tight font-semibold text-slate-900 dark:text-slate-50">
              Faculty Routine Extractor
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Departmental routine PDF → personal routine, workload &amp; calendar
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onToggleTheme} aria-label="Toggle dark mode">
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </Button>
      </div>
    </header>
  )
}
