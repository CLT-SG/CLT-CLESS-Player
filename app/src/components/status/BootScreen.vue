<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStatusStore, useSettingsStore } from '@/stores'

/**
 * Shown while the player is booting, and when neither the server nor the
 * cache could supply a layout.
 *
 * The failure state names the reason instead of leaving a black screen,
 * because "nothing on the display" is the single hardest signage fault to
 * triage remotely.
 */
const status = usePlayerStatusStore()
const settings = useSettingsStore()

const isError = computed(() => status.lifecycle === 'error')
const detail = computed(() => {
  if (!isError.value) return 'Loading layout…'
  if (!settings.serverConfigured) return 'No server address configured for this player.'
  return status.lastErrorMessage ?? 'No layout available from the server or the local cache.'
})
</script>

<template>
  <div class="flex h-full w-full flex-col items-center justify-center gap-4 bg-black px-8 text-center">
    <div
      v-if="!isError"
      class="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70"
      role="status"
      aria-label="Loading"
    />
    <h1 class="text-lg font-medium text-white/80">eCLESS Player</h1>
    <p class="max-w-md text-sm" :class="isError ? 'text-amber-300/80' : 'text-white/45'">{{ detail }}</p>
    <p v-if="isError" class="text-xs text-white/30">
      Display {{ settings.configuration.displayId }} · {{ settings.configuration.hostserver || 'no server' }}
    </p>
  </div>
</template>
