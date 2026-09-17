/**
 * User-adjustable presentation of the routine grid. The layout itself is
 * fixed (auto mode: cards on phones, table elsewhere; cozy density); only
 * the scale is customisable, and it is persisted per browser.
 */

import { useCallback, useEffect, useState } from 'react'
import type { KeyValueStorage } from '../../../application'

export const SCALE_MIN = 0.75
export const SCALE_MAX = 1.5
export const SCALE_STEP = 0.05
export const DEFAULT_SCALE = 1

const SCALE_KEY = 'gridScale'

export const clampScale = (n: number): number =>
  Number.isFinite(n) ? Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(n * 100) / 100)) : DEFAULT_SCALE

export function useGridScale(storage: KeyValueStorage): [number, (scale: number) => void] {
  const [scale, setScaleState] = useState(() => clampScale(storage.get<number>(SCALE_KEY) ?? DEFAULT_SCALE))
  useEffect(() => {
    storage.set(SCALE_KEY, scale)
  }, [storage, scale])
  const setScale = useCallback((n: number) => setScaleState(clampScale(n)), [])
  return [scale, setScale]
}
