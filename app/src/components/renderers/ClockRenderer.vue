<script setup lang="ts">
import { computed } from 'vue'
import type { ClockContent } from '@/core/content'
import { useScheduleStore } from '@/stores'

/**
 * Renders a date, time or datetime slot.
 *
 * The displayed value is derived from the store's shared clock, so this
 * component holds no timer at all. Several clocks in one layout therefore
 * update on the same tick and nothing needs cleaning up on teardown.
 */
const props = defineProps<{ content: ClockContent }>()

const schedule = useScheduleStore()

const text = computed(() => props.content.render(schedule.now))
const style = computed(() => {
  const typography = props.content.typography
  return {
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize,
    color: typography.color,
    textAlign: typography.textAlign,
    justifyContent: typography.justifyContent,
    fontWeight: typography.fontWeight,
    fontStyle: typography.fontStyle,
    textDecoration: typography.textDecoration,
  }
})
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden" :style="style">
    <span class="w-full tabular-nums">{{ text }}</span>
  </div>
</template>
