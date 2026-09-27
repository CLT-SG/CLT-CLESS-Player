<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { MediaContent, ResolvedMediaItem } from '@/core/content'

/**
 * Renders an image/video/stream rotation.
 *
 * All source resolution happened in `MediaContent`; this component only picks
 * an element type and owns the advance timer. The timer is cleared in
 * `onBeforeUnmount`, which is the structural fix for the legacy leak where
 * `mediaTimeout[slotid]` entries survived a layout change and fired against
 * DOM that no longer existed.
 */
const props = defineProps<{ content: MediaContent }>()

const index = ref(0)
const failed = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const sources = computed(() => props.content.sources)
const current = computed<ResolvedMediaItem | null>(() => sources.value[index.value] ?? null)
const objectFit = computed(() => props.content.objectFit)

function clearTimer(): void {
  if (timer != null) {
    clearTimeout(timer)
    timer = null
  }
}

function advance(): void {
  failed.value = false
  if (sources.value.length <= 1) {
    // A single item still needs its timer re-armed for looping video/streams.
    scheduleAdvance()
    return
  }
  index.value = (index.value + 1) % sources.value.length
  scheduleAdvance()
}

function scheduleAdvance(): void {
  clearTimer()
  const dwellMs = props.content.dwellMsFor(index.value)
  // A zero dwell means the element signals completion itself (`@ended`).
  if (dwellMs <= 0) return
  timer = setTimeout(advance, dwellMs)
}

function onMediaError(): void {
  failed.value = true
  // Skipping a broken asset keeps the rotation alive rather than freezing on
  // a missing file, which is the common case after a partial media sync.
  if (sources.value.length > 1) {
    timer = setTimeout(advance, 2_000)
  }
}

watch(
  sources,
  () => {
    index.value = 0
    failed.value = false
    scheduleAdvance()
  },
  { immediate: true },
)

onBeforeUnmount(clearTimer)
</script>

<template>
  <div class="relative h-full w-full overflow-hidden">
    <template v-if="current && !failed">
      <img
        v-if="current.kind === 'image'"
        :key="current.itemId"
        :src="current.url"
        alt=""
        class="h-full w-full"
        :style="{ objectFit }"
        @error="onMediaError"
      />

      <iframe
        v-else-if="current.kind === 'youtube'"
        :key="`yt-${current.itemId}`"
        :src="current.url"
        class="h-full w-full border-0"
        allow="autoplay; encrypted-media"
        referrerpolicy="no-referrer"
      />

      <video
        v-else
        :key="`v-${current.itemId}`"
        :src="current.url"
        class="h-full w-full"
        :style="{ objectFit }"
        autoplay
        playsinline
        :muted="current.muted"
        :loop="sources.length === 1 && current.endsNaturally"
        @ended="advance"
        @error="onMediaError"
      />
    </template>

    <div v-else class="flex h-full w-full items-center justify-center bg-black/60">
      <p class="px-4 text-center text-sm text-white/60">
        {{ failed ? 'Media unavailable' : 'No media assigned' }}
      </p>
    </div>
  </div>
</template>
