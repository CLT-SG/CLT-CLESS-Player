/**
 * Key/value persistence abstraction.
 *
 * The player runs in three hosts with different storage guarantees (Electron
 * renderer, Capacitor WebView, plain browser for the control-panel preview).
 * Keeping the interface narrow and synchronous-optional means the repositories
 * above it never branch on host, and the offline test suite can substitute an
 * in-memory driver.
 */
export interface StorageDriver {
  readonly name: string
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  keys(): Promise<readonly string[]>
  /** Approximate bytes used, or `null` when the host cannot report it. */
  usedBytes?(): Promise<number | null>
}

export class MemoryStorageDriver implements StorageDriver {
  readonly name = 'memory'
  private readonly store = new Map<string, string>()

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key)
  }

  async keys(): Promise<readonly string[]> {
    return [...this.store.keys()]
  }

  async usedBytes(): Promise<number | null> {
    let total = 0
    for (const [key, value] of this.store) total += key.length + value.length
    return total * 2
  }
}

/**
 * `localStorage`-backed driver.
 *
 * This is deliberately the default: the legacy player already persists layouts
 * in `localStorage`, so a modern build reads the *same* cache and an upgraded
 * device can keep playing offline immediately after the update, without a
 * successful server round trip to repopulate storage.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'localStorage'

  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  static isAvailable(): boolean {
    try {
      const probe = '__cless_probe__'
      globalThis.localStorage.setItem(probe, '1')
      globalThis.localStorage.removeItem(probe)
      return true
    } catch {
      return false
    }
  }

  async getItem(key: string): Promise<string | null> {
    return this.storage.getItem(key)
  }

  async setItem(key: string, value: string): Promise<void> {
    this.storage.setItem(key, value)
  }

  async removeItem(key: string): Promise<void> {
    this.storage.removeItem(key)
  }

  async keys(): Promise<readonly string[]> {
    const result: string[] = []
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index)
      if (key != null) result.push(key)
    }
    return result
  }

  async usedBytes(): Promise<number | null> {
    let total = 0
    for (const key of await this.keys()) {
      total += key.length + (this.storage.getItem(key)?.length ?? 0)
    }
    return total * 2
  }
}

/**
 * Picks the best driver the current host offers, falling back to memory.
 *
 * A memory fallback keeps the player running (online-only) on a locked-down
 * host rather than failing at boot.
 */
export function createDefaultStorageDriver(): StorageDriver {
  return LocalStorageDriver.isAvailable() ? new LocalStorageDriver() : new MemoryStorageDriver()
}
