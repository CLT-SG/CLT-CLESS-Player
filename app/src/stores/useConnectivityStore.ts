import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ConnectivityState, SyncOutcome } from '@core/types'

/**
 * Owns: connectivity and synchronisation status.
 *
 * Deliberately separate from the layout store: whether the server is reachable
 * has no bearing on what is currently playing, and conflating the two is what
 * made the legacy player navigate away to `offline.html` — discarding the
 * content it was perfectly able to keep showing.
 */
export const useConnectivityStore = defineStore('connectivity', () => {
  const state = ref<ConnectivityState>('online')
  const lastOutcome = ref<SyncOutcome | null>(null)
  const lastError = ref<string | null>(null)
  const lastSyncAt = ref<number | null>(null)
  const lastSuccessAt = ref<number | null>(null)
  const nextPollSeconds = ref(0)
  const activeTransport = ref<'json' | 'xml' | null>(null)
  const failureStreak = ref(0)

  const isOnline = computed(() => state.value === 'online')
  /** Playback continues in `degraded`; only `offline` is user-visible. */
  const showOfflineIndicator = computed(() => state.value === 'offline')

  const secondsSinceLastSuccess = computed(() => {
    if (lastSuccessAt.value == null) return null
    return Math.round((Date.now() - lastSuccessAt.value) / 1000)
  })

  function setState(next: ConnectivityState, streak: number): void {
    state.value = next
    failureStreak.value = streak
  }

  function recordSync(outcome: SyncOutcome, message: string | null, at: number): void {
    lastOutcome.value = outcome
    lastError.value = message
    lastSyncAt.value = at
    if (outcome === 'updated' || outcome === 'unchanged') lastSuccessAt.value = at
  }

  function setTransport(transport: 'json' | 'xml' | null): void {
    activeTransport.value = transport
  }

  function setNextPoll(seconds: number): void {
    nextPollSeconds.value = seconds
  }

  return {
    state,
    lastOutcome,
    lastError,
    lastSyncAt,
    lastSuccessAt,
    nextPollSeconds,
    activeTransport,
    failureStreak,
    isOnline,
    showOfflineIndicator,
    secondsSinceLastSuccess,
    setState,
    recordSync,
    setTransport,
    setNextPoll,
  }
})
