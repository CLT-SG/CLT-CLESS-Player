import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { DeviceIdentity } from '@core/services'
import type { PlayerLifecycle } from '@core/types'

/**
 * Owns: player lifecycle, device identity and the diagnostics flag.
 *
 * The lifecycle value is what the boot sequence and the control panel agree
 * on, so a device that fails to find any layout ends up in a reportable
 * `error` state instead of an unexplained black screen.
 */
export const usePlayerStatusStore = defineStore('player-status', () => {
  const lifecycle = ref<PlayerLifecycle>('booting')
  const identity = ref<DeviceIdentity | null>(null)
  const bootedAt = ref<number | null>(null)
  const diagnosticsVisible = ref(false)
  const lastErrorMessage = ref<string | null>(null)

  const isPlaying = computed(() => lifecycle.value === 'playing')
  const isBooting = computed(() => lifecycle.value === 'booting')
  const uptimeSeconds = computed(() => (bootedAt.value == null ? 0 : Math.round((Date.now() - bootedAt.value) / 1000)))

  function setLifecycle(next: PlayerLifecycle, message: string | null = null): void {
    lifecycle.value = next
    lastErrorMessage.value = next === 'error' ? message : null
  }

  function setIdentity(next: DeviceIdentity): void {
    identity.value = next
  }

  function markBooted(): void {
    bootedAt.value = Date.now()
  }

  function toggleDiagnostics(): void {
    diagnosticsVisible.value = !diagnosticsVisible.value
  }

  return {
    lifecycle,
    identity,
    bootedAt,
    diagnosticsVisible,
    lastErrorMessage,
    isPlaying,
    isBooting,
    uptimeSeconds,
    setLifecycle,
    setIdentity,
    markBooted,
    toggleDiagnostics,
  }
})
