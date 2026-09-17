import { useCallback, useEffect, useState } from 'react'
import { useServices } from '../hooks/useServices'

export type Theme = 'light' | 'dark'
const THEME_KEY = 'theme'

/**
 * Class-based dark mode. The persisted choice wins; otherwise the OS
 * preference is followed live (see index.html for the pre-paint script).
 */
export function useTheme(): [Theme, () => void] {
  const { storage } = useServices()
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Follow the OS while the user has not made an explicit choice.
  useEffect(() => {
    if (storage.get<Theme>(THEME_KEY)) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light')
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [storage])

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      storage.set(THEME_KEY, next)
      return next
    })
  }, [storage])

  return [theme, toggle]
}
