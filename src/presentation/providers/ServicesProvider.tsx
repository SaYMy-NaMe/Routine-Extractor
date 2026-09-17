/**
 * Dependency injection root. Every use case the UI needs is constructed here
 * from infrastructure adapters, so components depend only on the
 * application-layer interfaces and tests can substitute fakes.
 */

import { useMemo, type ReactNode } from 'react'
import { ServicesContext, createDefaultServices, type Services } from './servicesContext'

export function ServicesProvider({ services, children }: { services?: Services; children: ReactNode }) {
  const value = useMemo(() => services ?? createDefaultServices(), [services])
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>
}
