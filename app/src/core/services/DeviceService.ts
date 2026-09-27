import type { ConnectivityMonitor, RealtimeClient } from '../comm'
import type { PlayerConfiguration, PlayerLifecycle } from '../types'
import { Logger } from '../utils'

const logger = Logger.forScope('device')

export interface DeviceIdentity {
  readonly displayId: string
  readonly playerVersion: string
  readonly serial: string | null
  readonly macAddress: string | null
  readonly hostname: string | null
}

export interface DeviceStatusReport {
  readonly displayId: string
  readonly playerVersion: string
  readonly lifecycle: PlayerLifecycle
  readonly connectivity: string
  readonly currentLayoutId: string | null
  readonly layoutRevision: string | null
  readonly lastSyncAt: number | null
  readonly reportedAt: number
}

/**
 * Host-provided device facts (serial key, MAC, hostname).
 *
 * Supplied by the Electron main process, which already owns activation and
 * the serial-key validator. The service treats identity as read-only data so
 * the existing registration flow keeps working unchanged.
 */
export interface DeviceIdentitySource {
  read(): Promise<Partial<DeviceIdentity>>
}

/**
 * Reports player identity and status back to the platform.
 *
 * Registration itself is unchanged: a display is created in the CMS and the
 * device is configured with its numeric id, and the server records a heartbeat
 * from the `?v=` parameter on every layout poll. This service adds the
 * *outbound* half — a structured status push over the control-panel socket —
 * so the CMS can show what a device is actually playing rather than only when
 * it last called in.
 */
export class DeviceService {
  private identity: DeviceIdentity
  private lifecycle: PlayerLifecycle = 'booting'
  private currentLayoutId: string | null = null
  private layoutRevision: string | null = null
  private lastSyncAt: number | null = null
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    configuration: PlayerConfiguration,
    private readonly realtime: RealtimeClient,
    private readonly connectivity: ConnectivityMonitor,
    private readonly identitySource: DeviceIdentitySource | null = null,
  ) {
    this.identity = {
      displayId: configuration.displayId,
      playerVersion: configuration.playerVersion,
      serial: null,
      macAddress: null,
      hostname: null,
    }
  }

  get deviceIdentity(): DeviceIdentity {
    return this.identity
  }

  get state(): PlayerLifecycle {
    return this.lifecycle
  }

  async initialize(): Promise<DeviceIdentity> {
    if (this.identitySource) {
      try {
        const facts = await this.identitySource.read()
        this.identity = { ...this.identity, ...facts }
      } catch (error) {
        // Identity is diagnostic metadata; failing to read it must not stop
        // the player from playing.
        logger.warn('Device identity source failed', error)
      }
    }
    return this.identity
  }

  setLifecycle(lifecycle: PlayerLifecycle): void {
    if (this.lifecycle === lifecycle) return
    this.lifecycle = lifecycle
    this.report()
  }

  setCurrentLayout(layoutId: string | null, revision: string | null): void {
    this.currentLayoutId = layoutId
    this.layoutRevision = revision
  }

  markSynced(at: number): void {
    this.lastSyncAt = at
  }

  /** Begins periodic status reporting. */
  startReporting(intervalMs = 60_000): void {
    if (this.timer != null) return
    this.report()
    this.timer = setInterval(() => this.report(), intervalMs)
  }

  stopReporting(): void {
    if (this.timer != null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  buildReport(): DeviceStatusReport {
    return {
      displayId: this.identity.displayId,
      playerVersion: this.identity.playerVersion,
      lifecycle: this.lifecycle,
      connectivity: this.connectivity.state,
      currentLayoutId: this.currentLayoutId,
      layoutRevision: this.layoutRevision,
      lastSyncAt: this.lastSyncAt,
      reportedAt: Date.now(),
    }
  }

  /** Emits a status report; a dropped report is not retried, by design. */
  private report(): boolean {
    return this.realtime.emit('player-status', this.buildReport())
  }
}
