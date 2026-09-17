import { useContext } from 'react'
import { ServicesContext, type Services } from '../providers/servicesContext'

export function useServices(): Services {
  const ctx = useContext(ServicesContext)
  if (!ctx) throw new Error('useServices must be used inside <ServicesProvider>')
  return ctx
}
