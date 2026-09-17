import type { RoutineRepository } from '../../application'
import { HttpRoutineRepository } from './httpRoutineRepository'
import { IndexedDbRoutineRepository } from './indexedDbRoutineRepository'
import { MemoryRoutineRepository } from './memoryRoutineRepository'

/**
 * Factory: a shared HTTP library when a routine API is configured, otherwise
 * the device's IndexedDB, otherwise memory (e.g. tests, locked-down browsers).
 */
export function createRoutineRepository(
  apiUrl: string | undefined = import.meta.env?.VITE_ROUTINE_API_URL,
): RoutineRepository {
  if (apiUrl) return new HttpRoutineRepository(apiUrl)
  if (IndexedDbRoutineRepository.isSupported()) return new IndexedDbRoutineRepository()
  return new MemoryRoutineRepository()
}

export { HttpRoutineRepository, IndexedDbRoutineRepository, MemoryRoutineRepository }
