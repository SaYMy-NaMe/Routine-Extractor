/**
 * IndexedDB adapter for the routine library: persistent on this device,
 * survives reloads and browser restarts, and holds the full parsed document.
 */

import type { MasterRoutine, MasterRoutineMeta } from '../../domain'
import { isMasterRoutineMeta } from '../../domain'
import type { RoutineRepository } from '../../application'

const DB_NAME = 'faculty-routine-extractor'
const DB_VERSION = 1
const STORE = 'masterRoutines'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('title', 'title', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open the routine database.'))
    req.onblocked = () => reject(new Error('The routine database is blocked by another tab.'))
  })
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Database request failed.'))
  })
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, mode)
    const result = await fn(tx.objectStore(STORE))
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Transaction failed.'))
      tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted.'))
    })
    return result
  } finally {
    db.close()
  }
}

const toMeta = ({ parse: _parse, ...meta }: MasterRoutine): MasterRoutineMeta => meta

export class IndexedDbRoutineRepository implements RoutineRepository {
  readonly scope = 'device' as const

  static isSupported(): boolean {
    return typeof indexedDB !== 'undefined'
  }

  async list(): Promise<MasterRoutineMeta[]> {
    const rows = await withStore('readonly', (s) => request(s.getAll() as IDBRequest<unknown[]>))
    return rows.filter((r): r is MasterRoutine => isMasterRoutineMeta(r) && 'parse' in r).map(toMeta)
  }

  async get(id: string): Promise<MasterRoutine | null> {
    const row = await withStore('readonly', (s) => request(s.get(id) as IDBRequest<unknown>))
    return isMasterRoutineMeta(row) && 'parse' in row ? (row as MasterRoutine) : null
  }

  async save(routine: MasterRoutine): Promise<void> {
    await withStore('readwrite', (s) => request(s.put(routine)))
  }

  async remove(id: string): Promise<void> {
    await withStore('readwrite', (s) => request(s.delete(id)))
  }
}
