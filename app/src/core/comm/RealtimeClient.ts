import { Logger } from '../utils'

const logger = Logger.forScope('realtime')

export type RealtimeHandler = (payload: unknown) => void

/**
 * Minimal transport contract for the local Socket.IO connection.
 *
 * The player's control panel already runs a Socket.IO server in the Electron
 * main process; the socket instance is created by the host and handed in, so
 * this layer stays free of the `socket.io-client` import and can be exercised
 * with a stub in tests.
 */
export interface RealtimeSocket {
  on(event: string, handler: RealtimeHandler): void
  off(event: string, handler: RealtimeHandler): void
  emit(event: string, payload?: unknown): void
  readonly connected: boolean
}

/**
 * Subscription facade over the control-panel socket.
 *
 * All push-driven behaviour (content updates from the CMS, Airport Display
 * events, multi-screen sync) arrives here and is dispatched to services. The
 * value over calling `socket.on` directly is ownership: handlers are tracked
 * and removed together, so a re-registered service cannot leave a duplicate
 * listener behind — which in the legacy player caused an event to be applied
 * twice after a layout change.
 */
export class RealtimeClient {
  private socket: RealtimeSocket | null = null
  private readonly handlers = new Map<string, Set<RealtimeHandler>>()

  attach(socket: RealtimeSocket): void {
    if (this.socket === socket) return
    this.detach()
    this.socket = socket

    for (const [event, handlers] of this.handlers) {
      for (const handler of handlers) socket.on(event, handler)
    }
    logger.info('Realtime socket attached')
  }

  detach(): void {
    if (!this.socket) return
    for (const [event, handlers] of this.handlers) {
      for (const handler of handlers) this.socket.off(event, handler)
    }
    this.socket = null
    logger.info('Realtime socket detached')
  }

  get connected(): boolean {
    return this.socket?.connected ?? false
  }

  /** Subscribes to an event; returns an unsubscribe function. */
  on(event: string, handler: RealtimeHandler): () => void {
    const wrapped: RealtimeHandler = (payload) => {
      try {
        handler(payload)
      } catch (error) {
        // A throwing handler would otherwise surface as an unhandled
        // rejection inside the socket library and kill later events.
        logger.error(`Handler for "${event}" threw`, error)
      }
    }

    const existing = this.handlers.get(event) ?? new Set<RealtimeHandler>()
    existing.add(wrapped)
    this.handlers.set(event, existing)
    this.socket?.on(event, wrapped)

    return () => {
      existing.delete(wrapped)
      this.socket?.off(event, wrapped)
    }
  }

  /** Emits when connected; silently drops otherwise. */
  emit(event: string, payload?: unknown): boolean {
    if (!this.socket?.connected) return false
    this.socket.emit(event, payload)
    return true
  }
}
