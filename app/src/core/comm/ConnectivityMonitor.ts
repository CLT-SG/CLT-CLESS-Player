import type { ConnectivityState } from '../types'
import { Logger } from '../utils'

const logger = Logger.forScope('connectivity')

export type ConnectivityListener = (state: ConnectivityState, previous: ConnectivityState) => void

export interface ConnectivityMonitorOptions {
  /** Consecutive failures before the state drops from `degraded` to `offline`. */
  readonly offlineThreshold?: number
}

/**
 * Tracks whether the server is actually usable.
 *
 * Deliberately driven by sync outcomes rather than `navigator.onLine`: these
 * players sit on networks where the NIC is up but the VPN or the server is
 * down, and the browser would happily report "online" the whole time. The
 * legacy player used a reachability probe for the same reason but treated any
 * single failure as full offline, which caused visible flapping on a lossy
 * link.
 *
 * `degraded` is the state that fixes that: the first failures are absorbed
 * without switching the UI to offline, and only sustained failure escalates.
 */
export class ConnectivityMonitor {
  private current: ConnectivityState = 'online'
  private consecutiveFailures = 0
  private lastSuccessAt: number | null = null
  private lastFailureMessage: string | null = null
  private readonly listeners = new Set<ConnectivityListener>()
  private readonly offlineThreshold: number

  constructor(options: ConnectivityMonitorOptions = {}) {
    this.offlineThreshold = Math.max(1, options.offlineThreshold ?? 3)
  }

  get state(): ConnectivityState {
    return this.current
  }

  get isServerReachable(): boolean {
    return this.current !== 'offline'
  }

  get failureStreak(): number {
    return this.consecutiveFailures
  }

  get lastSuccessTimestamp(): number | null {
    return this.lastSuccessAt
  }

  get lastError(): string | null {
    return this.lastFailureMessage
  }

  onChange(listener: ConnectivityListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Records a successful exchange with the server. */
  reportSuccess(): void {
    this.consecutiveFailures = 0
    this.lastSuccessAt = Date.now()
    this.lastFailureMessage = null
    this.transition('online')
  }

  /** Records a failed exchange; escalates once the threshold is exceeded. */
  reportFailure(message: string): void {
    this.consecutiveFailures += 1
    this.lastFailureMessage = message
    this.transition(this.consecutiveFailures >= this.offlineThreshold ? 'offline' : 'degraded')
  }

  /** Used when configuration pins the player to offline mode. */
  forceOffline(reason: string): void {
    this.lastFailureMessage = reason
    this.transition('offline')
  }

  private transition(next: ConnectivityState): void {
    if (next === this.current) return

    const previous = this.current
    this.current = next
    logger.info(`Connectivity ${previous} -> ${next}`, { failures: this.consecutiveFailures })

    for (const listener of this.listeners) {
      try {
        listener(next, previous)
      } catch (error) {
        logger.warn('Connectivity listener failed', error)
      }
    }
  }
}
