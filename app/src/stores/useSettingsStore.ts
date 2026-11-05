import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { DEFAULT_PLAYER_CONFIGURATION, type PlayerConfiguration } from '@core/types'
import { Logger } from '@core/utilities'

/**
 * Owns: player configuration.
 *
 * Every other store and service reads configuration from here rather than
 * from a module-level `config` global, which is what made the legacy boot
 * order fragile (several files read `config.hostserver` before the async
 * `configLoaded` event had fired).
 */
export const useSettingsStore = defineStore('settings', () => {
  const configuration = ref<PlayerConfiguration>(DEFAULT_PLAYER_CONFIGURATION)
  const loaded = ref(false)

  const isOfflineMode = computed(() => configuration.value.mode === 'offline')
  const serverConfigured = computed(() => configuration.value.hostserver.length > 0)

  function apply(next: PlayerConfiguration): void {
    configuration.value = next
    loaded.value = true
    Logger.setLevel(next.logLevel)
  }

  /** Local, session-scoped adjustment; persistence is the repository's job. */
  function patch(partial: Partial<PlayerConfiguration>): void {
    configuration.value = { ...configuration.value, ...partial }
    if (partial.logLevel) Logger.setLevel(partial.logLevel)
  }

  return { configuration, loaded, isOfflineMode, serverConfigured, apply, patch }
})
