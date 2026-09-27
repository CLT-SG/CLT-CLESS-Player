import { DEFAULT_PLAYER_CONFIGURATION, type PlayerConfiguration } from '../types'
import { Logger, ValidationUtils } from '../utils'
import type { StorageDriver } from './StorageDriver'

const logger = Logger.forScope('settings')

/**
 * Host-provided configuration bridge.
 *
 * Electron exposes the on-disk `config.json` through the preload script and
 * Capacitor through Preferences; both are injected rather than imported so the
 * core never reaches for a global.
 */
export interface ConfigurationSource {
  readonly name: string
  read(): Promise<Record<string, unknown> | null>
}

/**
 * Loads and persists player configuration.
 *
 * Resolution order is host source, then last-known-good cache, then defaults.
 * The cache step is what lets an offline player boot with the right server
 * address and display id even when the host's config bridge is slow or
 * temporarily unavailable.
 */
export class SettingsRepository {
  private static readonly CACHE_KEY = 'cless:settings'
  private static readonly OVERRIDES_KEY = 'cless:settings:overrides'

  constructor(
    private readonly driver: StorageDriver,
    private readonly source: ConfigurationSource | null = null,
  ) {}

  async load(): Promise<PlayerConfiguration> {
    const hostConfig = await this.readHostConfig()
    if (hostConfig) {
      const configuration = SettingsRepository.normalize(hostConfig)
      await this.driver.setItem(SettingsRepository.CACHE_KEY, JSON.stringify(configuration))
      return this.applyOverrides(configuration)
    }

    const cached = await this.driver.getItem(SettingsRepository.CACHE_KEY)
    if (cached) {
      try {
        return this.applyOverrides(SettingsRepository.normalize(JSON.parse(cached) as Record<string, unknown>))
      } catch {
        logger.warn('Cached settings were unreadable; falling back to defaults')
      }
    }
    return this.applyOverrides(DEFAULT_PLAYER_CONFIGURATION)
  }

  /**
   * Locally applied settings that must survive a config reload, e.g. a
   * technician switching a device to offline mode from the control panel.
   */
  async saveOverrides(overrides: Partial<PlayerConfiguration>): Promise<void> {
    await this.driver.setItem(SettingsRepository.OVERRIDES_KEY, JSON.stringify(overrides))
  }

  async clearOverrides(): Promise<void> {
    await this.driver.removeItem(SettingsRepository.OVERRIDES_KEY)
  }

  private async applyOverrides(configuration: PlayerConfiguration): Promise<PlayerConfiguration> {
    const raw = await this.driver.getItem(SettingsRepository.OVERRIDES_KEY)
    if (!raw) return configuration
    try {
      const overrides = JSON.parse(raw) as Partial<PlayerConfiguration>
      return { ...configuration, ...overrides }
    } catch {
      return configuration
    }
  }

  private async readHostConfig(): Promise<Record<string, unknown> | null> {
    if (!this.source) return null
    try {
      return await this.source.read()
    } catch (error) {
      logger.warn(`Configuration source "${this.source.name}" failed`, error)
      return null
    }
  }

  /**
   * Maps the on-disk `config.json` onto the typed configuration.
   *
   * The legacy field names (`id`, `hostserver`, `corsproxy`) are preserved as
   * inputs so an existing device's config file keeps working untouched after
   * the update.
   */
  static normalize(raw: Record<string, unknown>): PlayerConfiguration {
    const transport = ValidationUtils.toStringValue(raw['transport'], 'auto').toLowerCase()
    const mode = ValidationUtils.toStringValue(raw['mode'], 'online').toLowerCase()
    const logLevel = ValidationUtils.toStringValue(raw['logLevel'] ?? raw['loglevel'], 'info').toLowerCase()

    return {
      hostserver: ValidationUtils.toStringValue(raw['hostserver'], DEFAULT_PLAYER_CONFIGURATION.hostserver).replace(/\/+$/, ''),
      displayId: ValidationUtils.toStringValue(raw['id'] ?? raw['displayId'], DEFAULT_PLAYER_CONFIGURATION.displayId),
      mode: mode === 'offline' ? 'offline' : 'online',
      transport: transport === 'json' || transport === 'xml' ? transport : 'auto',
      corsProxy: ValidationUtils.toBoolean(raw['corsproxy'] ?? raw['corsProxy'], false),
      playerVersion: ValidationUtils.toStringValue(raw['version'] ?? raw['playerVersion'], DEFAULT_PLAYER_CONFIGURATION.playerVersion),
      requestTimeoutMs: ValidationUtils.clampInt(
        raw['requestTimeoutMs'],
        1_000,
        120_000,
        DEFAULT_PLAYER_CONFIGURATION.requestTimeoutMs,
      ),
      defaultRefreshSeconds: ValidationUtils.clampInt(
        raw['defaultRefreshSeconds'] ?? raw['updateInterval'],
        5,
        86_400,
        DEFAULT_PLAYER_CONFIGURATION.defaultRefreshSeconds,
      ),
      logLevel: (['debug', 'info', 'warn', 'error'] as const).includes(logLevel as 'debug')
        ? (logLevel as PlayerConfiguration['logLevel'])
        : 'info',
    }
  }
}
