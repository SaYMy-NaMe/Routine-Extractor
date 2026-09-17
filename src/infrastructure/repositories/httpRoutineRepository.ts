/**
 * HTTP adapter for a shared routine library, so every user of a deployment
 * sees the same master routines. Expects a small JSON API (see README):
 *
 *   GET    {base}/routines          → MasterRoutineMeta[]
 *   GET    {base}/routines/:id      → MasterRoutine
 *   PUT    {base}/routines/:id      ← MasterRoutine
 *   DELETE {base}/routines/:id
 *
 * Selected by the factory when `VITE_ROUTINE_API_URL` is configured.
 */

import type { MasterRoutine, MasterRoutineMeta } from '../../domain'
import { isMasterRoutineMeta } from '../../domain'
import type { RoutineRepository } from '../../application'

export class HttpRoutineRepository implements RoutineRepository {
  readonly scope = 'shared' as const
  private readonly base: string
  private readonly fetchFn: typeof fetch

  constructor(baseUrl: string, fetchFn: typeof fetch = (...args) => fetch(...args)) {
    this.base = baseUrl.replace(/\/+$/, '')
    this.fetchFn = fetchFn
  }

  private async call<T>(path: string, init?: RequestInit): Promise<T | null> {
    const res = await this.fetchFn(`${this.base}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Routine service responded ${res.status}.`)
    return res.status === 204 ? null : ((await res.json()) as T)
  }

  async list(): Promise<MasterRoutineMeta[]> {
    const rows = (await this.call<unknown[]>('/routines')) ?? []
    return rows.filter(isMasterRoutineMeta)
  }

  async get(id: string): Promise<MasterRoutine | null> {
    const row = await this.call<unknown>(`/routines/${encodeURIComponent(id)}`)
    return isMasterRoutineMeta(row) && 'parse' in row ? (row as MasterRoutine) : null
  }

  async save(routine: MasterRoutine): Promise<void> {
    await this.call(`/routines/${encodeURIComponent(routine.id)}`, {
      method: 'PUT',
      body: JSON.stringify(routine),
    })
  }

  async remove(id: string): Promise<void> {
    await this.call(`/routines/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }
}
