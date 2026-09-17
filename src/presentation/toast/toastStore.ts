/**
 * Toast notifications as a tiny observable store (Observer pattern):
 * anything can `notify()`, and the `<Toaster>` subscribes with
 * `useSyncExternalStore`. Kept outside React so use-case wrappers and
 * event handlers can raise toasts without prop drilling.
 */

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  readonly id: number
  readonly kind: ToastKind
  readonly message: string
  /** Auto-dismiss delay in ms; 0 keeps it until dismissed. */
  readonly ttl: number
}

type Listener = () => void

const DEFAULT_TTL: Record<ToastKind, number> = { success: 3500, info: 4000, error: 6500 }

export class ToastStore {
  private toasts: readonly Toast[] = []
  private readonly listeners = new Set<Listener>()
  private seq = 0

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): readonly Toast[] => this.toasts

  notify(kind: ToastKind, message: string, ttl = DEFAULT_TTL[kind]): number {
    const id = ++this.seq
    this.toasts = [...this.toasts, { id, kind, message, ttl }]
    this.emit()
    if (ttl > 0) setTimeout(() => this.dismiss(id), ttl)
    return id
  }

  dismiss(id: number): void {
    if (!this.toasts.some((t) => t.id === id)) return
    this.toasts = this.toasts.filter((t) => t.id !== id)
    this.emit()
  }

  clear(): void {
    this.toasts = []
    this.emit()
  }

  private emit(): void {
    for (const l of this.listeners) l()
  }
}
