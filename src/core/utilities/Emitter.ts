import { Logger } from './Logger'

const logger = Logger.forScope('emitter')

export type EmitterHandler<TPayload> = (payload: TPayload) => void

/**
 * Minimal typed event emitter.
 *
 * The shared core publishes state through this rather than writing to a store,
 * because a store is a framework choice and the core has to serve three
 * consumers with different ones: the Vue renderer (Pinia), the legacy renderer
 * (globals and the DOM) and headless tooling (nothing at all). Inverting the
 * dependency is what makes `core → renderer` a one-way arrow.
 *
 * A throwing subscriber is logged and skipped. One misbehaving listener must
 * not stop the others from being notified, because that would let a rendering
 * bug take down synchronisation.
 */
export class Emitter<TEvents extends object> {
  private readonly handlers = new Map<keyof TEvents, Set<EmitterHandler<never>>>()

  /** Subscribes; the returned function unsubscribes. */
  on<TKey extends keyof TEvents>(event: TKey, handler: EmitterHandler<TEvents[TKey]>): () => void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as EmitterHandler<never>)
    return () => {
      set?.delete(handler as EmitterHandler<never>)
    }
  }

  /** Subscribes for a single delivery. */
  once<TKey extends keyof TEvents>(event: TKey, handler: EmitterHandler<TEvents[TKey]>): () => void {
    const off = this.on(event, (payload) => {
      off()
      handler(payload)
    })
    return off
  }

  emit<TKey extends keyof TEvents>(event: TKey, payload: TEvents[TKey]): void {
    const set = this.handlers.get(event)
    if (!set?.size) return
    for (const handler of [...set]) {
      try {
        ;(handler as EmitterHandler<TEvents[TKey]>)(payload)
      } catch (error) {
        logger.error(`Listener for "${String(event)}" threw`, error)
      }
    }
  }

  listenerCount(event: keyof TEvents): number {
    return this.handlers.get(event)?.size ?? 0
  }

  removeAll(): void {
    this.handlers.clear()
  }
}
