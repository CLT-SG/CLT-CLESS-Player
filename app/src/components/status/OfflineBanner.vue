<script setup lang="ts">
import { computed } from 'vue'
import { FormatUtils } from '@/core/utils'
import { useConnectivityStore, useSettingsStore } from '@/stores'

/**
 * Discreet indicator shown only when the server has been unreachable long
 * enough to matter.
 *
 * Deliberately small and non-blocking: content keeps playing behind it. The
 * legacy player replaced the entire screen with `offline.html`, which turned a
 * recoverable outage into a blank display even though a valid cached layout
 * was available.
 *
 * A player configured for offline operation shows nothing at all — being
 * offline is its normal state, not a fault.
 */
const connectivity = useConnectivityStore()
const settings = useSettingsStore()

const visible = computed(() => connectivity.showOfflineIndicator && !settings.isOfflineMode)

const label = computed(() => {
  const seconds = connectivity.secondsSinceLastSuccess
  if (seconds == null) return 'Playing from cache'
  return `Playing from cache · last sync ${FormatUtils.duration(seconds)} ago`
})
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-500"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-500"
    leave-to-class="opacity-0"
  >
    <div
      v-if="visible"
      class="pointer-events-none fixed bottom-4 right-4 z-overlay rounded-full bg-black/70 px-4 py-2 backdrop-blur-sm"
    >
      <p class="flex items-center gap-2 text-xs font-medium text-white/70">
        <span class="h-2 w-2 rounded-full bg-amber-400" />
        {{ label }}
      </p>
    </div>
  </Transition>
</template>
