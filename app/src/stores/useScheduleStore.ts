import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

/**
 * Owns: the shared clock and slot visibility derived from schedules.
 *
 * One store-held timestamp, advanced by `SchedulerService`, drives every
 * clock slot and every schedule evaluation. Components read `now` instead of
 * each starting their own interval, which is what keeps multiple clocks in a
 * layout showing the same second.
 */
export const useScheduleStore = defineStore('schedule', () => {
  const now = ref(new Date())
  const hiddenSlotIds = ref<readonly string[]>([])
  const scheduleId = ref<string | null>(null)

  const timestamp = computed(() => now.value.getTime())
  const hasScheduledSlots = computed(() => hiddenSlotIds.value.length > 0)

  function tick(next: Date): void {
    now.value = next
  }

  /** Recorded by the scheduler after evaluating each slot's window. */
  function setHiddenSlots(ids: readonly string[]): void {
    // Compared before assigning so an unchanged set does not invalidate every
    // component that reads it on each tick.
    const current = hiddenSlotIds.value
    if (current.length === ids.length && current.every((id, index) => id === ids[index])) return
    hiddenSlotIds.value = ids
  }

  function isHidden(slotId: string): boolean {
    return hiddenSlotIds.value.includes(slotId)
  }

  function setScheduleId(id: string | null): void {
    scheduleId.value = id
  }

  return {
    now,
    hiddenSlotIds,
    scheduleId,
    timestamp,
    hasScheduledSlots,
    tick,
    setHiddenSlots,
    isHidden,
    setScheduleId,
  }
})
