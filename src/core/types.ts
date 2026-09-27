export interface ViewportSize {
  readonly width: number
  readonly height: number
}

export interface Geometry {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
  readonly layer: number
}

/** Connectivity as the player experiences it, not as the OS reports it. */
export type ConnectivityState = 'online' | 'degraded' | 'offline'

export type PlayerLifecycle = 'booting' | 'playing' | 'recovering' | 'stopped' | 'error'

export type SyncOutcome = 'updated' | 'unchanged' | 'offline' | 'invalid' | 'error'

export interface PlayerConfiguration {
  /** Base URL of CLESS-Server, e.g. `https://cless.example.com/demo`. */
  readonly hostserver: string
  /** Digital signage (display) id this player is registered as. */
  readonly displayId: string
  /** `offline` pins the player to cache and never polls. */
  readonly mode: 'online' | 'offline'
  /**
   * Preferred transport. `auto` tries the JSON Layout Definition API and falls
   * back to XML, which is what lets a new player run against an old server.
   */
  readonly transport: 'auto' | 'json' | 'xml'
  readonly corsProxy: boolean
  readonly playerVersion: string
  readonly requestTimeoutMs: number
  /** Seconds; used until the server supplies its own refresh interval. */
  readonly defaultRefreshSeconds: number
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error'
}

export const DEFAULT_PLAYER_CONFIGURATION: PlayerConfiguration = {
  hostserver: '',
  displayId: '1',
  mode: 'online',
  transport: 'auto',
  corsProxy: false,
  playerVersion: '0.0.0',
  requestTimeoutMs: 15_000,
  defaultRefreshSeconds: 60,
  logLevel: 'info',
}
