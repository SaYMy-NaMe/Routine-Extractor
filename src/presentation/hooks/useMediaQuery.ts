import { useSyncExternalStore } from 'react'

/** Subscribe to a CSS media query (Observer over `matchMedia`). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Tailwind-aligned breakpoints. */
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const

export type Viewport = 'mobile' | 'tablet' | 'laptop' | 'desktop'

export function useViewport(): Viewport {
  const md = useMediaQuery(`(min-width: ${BREAKPOINTS.md}px)`)
  const lg = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`)
  const xl = useMediaQuery(`(min-width: ${BREAKPOINTS.xl}px)`)
  if (xl) return 'desktop'
  if (lg) return 'laptop'
  if (md) return 'tablet'
  return 'mobile'
}
