import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { PlaylistDefinition, TransitionDefinition } from '@/core/schema'

/**
 * Owns: playlist identity, position and transition settings.
 *
 * The authoritative cursor lives in `PlaybackService`; this store is the
 * read model the UI renders from. Keeping the direction of flow one-way
 * (service writes, components read) is what makes playback debuggable —
 * in the legacy player both the renderer and three timers wrote the index.
 */
export const usePlaylistStore = defineStore('playlist', () => {
  const playlist = ref<PlaylistDefinition | null>(null)
  const index = ref(0)
  const total = ref(0)
  const paused = ref(false)
  const pauseReason = ref<string | null>(null)

  const isPlaylist = computed(() => total.value > 1)
  const name = computed(() => playlist.value?.name ?? '')

  const transition = computed<TransitionDefinition>(() => {
    if (total.value <= 1) return { style: 'none', speedMs: 0, delayMs: 0 }
    return playlist.value?.transition ?? { style: 'none', speedMs: 1000, delayMs: 0 }
  })

  const progressLabel = computed(() => (isPlaylist.value ? `${index.value + 1}/${total.value}` : ''))

  function setPlaylist(next: PlaylistDefinition | null, layoutCount: number): void {
    playlist.value = next
    total.value = layoutCount
  }

  function setPosition(nextIndex: number): void {
    index.value = nextIndex
  }

  function setPaused(value: boolean, reason: string | null = null): void {
    paused.value = value
    pauseReason.value = value ? reason : null
  }

  return {
    playlist,
    index,
    total,
    paused,
    pauseReason,
    isPlaylist,
    name,
    transition,
    progressLabel,
    setPlaylist,
    setPosition,
    setPaused,
  }
})
