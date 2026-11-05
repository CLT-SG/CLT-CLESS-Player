<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { EmbedContent } from '@core/models'
import { useConnectivityStore } from '@/stores'

/**
 * Renders HTML and server widget slots in an iframe.
 *
 * Two behaviours are load-bearing for offline operation:
 *  - a widget that is not marked offline-capable is replaced by a placeholder
 *    when the server is unreachable, instead of showing a browser error page;
 *  - `refreshSeconds` reloads the frame on a timer, which is how live widgets
 *    (queue counters, flight data) stay current without a layout change.
 *
 * Electron loads this through a `<webview>` in the shipping build; the iframe
 * keeps the component host-agnostic and testable.
 */
const props = defineProps<{ content: EmbedContent }>()

const connectivity = useConnectivityStore()

const index = ref(0)
const reloadToken = ref(0)
let rotateTimer: ReturnType<typeof setTimeout> | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

const targets = computed(() => props.content.rotation)
const current = computed(() => targets.value[index.value] ?? null)

const blocked = computed(() => {
  if (connectivity.state !== 'offline') return false
  return !(current.value?.allowOffline ?? false)
})

const frameSrc = computed(() => {
  const target = current.value
  if (!target?.url) return ''
  // The token forces a reload without mutating the authored URL.
  return reloadToken.value === 0 ? target.url : `${target.url}${target.url.includes('?') ? '&' : '?'}_r=${reloadToken.value}`
})

function clearTimers(): void {
  if (rotateTimer != null) clearTimeout(rotateTimer)
  if (refreshTimer != null) clearTimeout(refreshTimer)
  rotateTimer = null
  refreshTimer = null
}

function schedule(): void {
  clearTimers()
  const target = current.value
  if (!target) return

  if (targets.value.length > 1 && target.dwellMs > 0) {
    rotateTimer = setTimeout(() => {
      index.value = (index.value + 1) % targets.value.length
      reloadToken.value = 0
      schedule()
    }, target.dwellMs)
  }

  if (target.refreshSeconds > 0) {
    refreshTimer = setTimeout(() => {
      reloadToken.value = Date.now()
      schedule()
    }, target.refreshSeconds * 1000)
  }
}

watch(
  targets,
  () => {
    index.value = 0
    reloadToken.value = 0
    schedule()
  },
  { immediate: true },
)

onBeforeUnmount(clearTimers)
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-black">
    <iframe
      v-if="frameSrc && !blocked"
      :key="frameSrc"
      :src="frameSrc"
      class="h-full w-full border-0"
      :class="content.interactive ? '' : 'pointer-events-none'"
      referrerpolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin"
    />

    <div v-else class="flex h-full w-full flex-col items-center justify-center gap-2 bg-black/70 px-4 text-center">
      <p class="text-sm text-white/70">{{ current?.label || 'Embedded content' }}</p>
      <p class="text-xs text-white/40">
        {{ blocked ? 'Unavailable while the server is offline' : 'No source configured' }}
      </p>
    </div>
  </div>
</template>
