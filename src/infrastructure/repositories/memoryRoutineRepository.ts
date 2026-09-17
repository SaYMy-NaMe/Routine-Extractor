import type { MasterRoutine, MasterRoutineMeta } from '../../domain'
import type { RoutineRepository } from '../../application'

/** In-memory adapter for tests and environments without IndexedDB. */
export class MemoryRoutineRepository implements RoutineRepository {
  readonly scope = 'device' as const
  private readonly rows = new Map<string, MasterRoutine>()

  async list(): Promise<MasterRoutineMeta[]> {
    return [...this.rows.values()].map(({ parse: _p, ...meta }) => meta)
  }
  async get(id: string): Promise<MasterRoutine | null> {
    return this.rows.get(id) ?? null
  }
  async save(routine: MasterRoutine): Promise<void> {
    this.rows.set(routine.id, routine)
  }
  async remove(id: string): Promise<void> {
    this.rows.delete(id)
  }
}
