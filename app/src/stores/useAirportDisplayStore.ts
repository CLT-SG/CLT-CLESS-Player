import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AirportAnnouncementLanguage } from '@/core/content'
import type { AirportSlotOverride } from '@/core/services/AirportDisplayService'

export interface AnnouncementQueueItem {
  readonly eventId: string
  readonly languages: readonly AirportAnnouncementLanguage[]
  readonly queuedAt: number
}

/**
 * Owns: Airport Display overrides and the announcement queue.
 *
 * Overrides are keyed by slot *name* rather than slot id because a zone
 * trigger addresses a named slot that may appear in several layouts; that is
 * the existing server contract and it is preserved here.
 */
export const useAirportDisplayStore = defineStore('airport-display', () => {
  const overrides = ref<Record<string, AirportSlotOverride>>({})
  const announcementQueue = ref<AnnouncementQueueItem[]>([])
  const playingEventId = ref<string | null>(null)
  const lastEventAt = ref<number | null>(null)

  const hasOverrides = computed(() => Object.keys(overrides.value).length > 0)
  const isAnnouncing = computed(() => playingEventId.value !== null)
  const queueLength = computed(() => announcementQueue.value.length)

  function applyOverrides(next: readonly AirportSlotOverride[]): void {
    const merged = { ...overrides.value }
    for (const override of next) merged[override.slotName] = override
    overrides.value = merged
    lastEventAt.value = Date.now()
  }

  function overrideFor(slotName: string): AirportSlotOverride | null {
    return overrides.value[slotName] ?? null
  }

  function clearOverride(slotName: string): void {
    const { [slotName]: removed, ...rest } = overrides.value
    if (removed === undefined) return
    overrides.value = rest
  }

  function clearTemporaryOverrides(): void {
    overrides.value = Object.fromEntries(
      Object.entries(overrides.value).filter(([, override]) => !override.temporary),
    )
  }

  /** Announcements play in arrival order; duplicates are rejected upstream. */
  function enqueueAnnouncement(item: AnnouncementQueueItem): void {
    announcementQueue.value = [...announcementQueue.value, item]
  }

  function dequeueAnnouncement(): AnnouncementQueueItem | null {
    const [next, ...rest] = announcementQueue.value
    if (!next) return null
    announcementQueue.value = rest
    return next
  }

  function setPlaying(eventId: string | null): void {
    playingEventId.value = eventId
  }

  return {
    overrides,
    announcementQueue,
    playingEventId,
    lastEventAt,
    hasOverrides,
    isAnnouncing,
    queueLength,
    applyOverrides,
    overrideFor,
    clearOverride,
    clearTemporaryOverrides,
    enqueueAnnouncement,
    dequeueAnnouncement,
    setPlaying,
  }
})
