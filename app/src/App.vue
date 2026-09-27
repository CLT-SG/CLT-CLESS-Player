<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted } from 'vue'
import LayoutRenderer from '@/components/LayoutRenderer.vue'
import BootScreen from '@/components/status/BootScreen.vue'
import DiagnosticsOverlay from '@/components/status/DiagnosticsOverlay.vue'
import OfflineBanner from '@/components/status/OfflineBanner.vue'
import { RUNTIME_KEY } from '@/core/runtime/injection'
import type { PlayerRuntime } from '@/core/runtime'
import { useLayoutStore, usePlayerStatusStore } from '@/stores'

/**
 * Root shell.
 *
 * Renders content as soon as the layout store has any, which — because the
 * runtime loads the cache before touching the network — means a device with
 * no connectivity still shows content immediately on boot.
 */
const runtime = inject<PlayerRuntime>(RUNTIME_KEY)
const layout = useLayoutStore()
const status = usePlayerStatusStore()

const showContent = computed(() => layout.hasContent)

/** Operator shortcuts, matching the existing player's conventions. */
function onKeydown(event: KeyboardEvent): void {
  if (!event.ctrlKey && !event.metaKey) return

  if (event.key === 'd' || event.code === 'KeyD') {
    event.preventDefault()
    status.toggleDiagnostics()
    return
  }
  if (event.key === 'r' || event.code === 'KeyR') {
    event.preventDefault()
    void runtime?.refreshNow()
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    runtime?.advanceLayout()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true)
})
</script>

<template>
  <main class="h-screen w-screen cursor-none overflow-hidden bg-black">
    <LayoutRenderer v-if="showContent" />
    <BootScreen v-else />

    <OfflineBanner />
    <DiagnosticsOverlay />
  </main>
</template>
