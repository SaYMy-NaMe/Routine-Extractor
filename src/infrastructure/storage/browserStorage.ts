/**
 * `KeyValueStorage` adapters. The browser adapter wraps localStorage
 * defensively (private mode, quota, corrupt JSON) and the in-memory adapter
 * backs tests and SSR-like environments.
 */

import type { KeyValueStorage } from '../../application'

export class BrowserStorage implements KeyValueStorage {
  private readonly prefix: string

  constructor(prefix = 'fre:') {
    this.prefix = prefix
  }

  get<T>(key: string): T | null {
    try {
      const raw = globalThis.localStorage?.getItem(this.prefix + key)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }

  set<T>(key: string, value: T): void {
    try {
      globalThis.localStorage?.setItem(this.prefix + key, JSON.stringify(value))
    } catch {
      /* quota exceeded or storage disabled — persistence is best-effort */
    }
  }

  remove(key: string): void {
    try {
      globalThis.localStorage?.removeItem(this.prefix + key)
    } catch {
      /* ignore */
    }
  }
}

export class MemoryStorage implements KeyValueStorage {
  private readonly map = new Map<string, unknown>()
  get<T>(key: string): T | null {
    return (this.map.get(key) as T) ?? null
  }
  set<T>(key: string, value: T): void {
    this.map.set(key, value)
  }
  remove(key: string): void {
    this.map.delete(key)
  }
}
