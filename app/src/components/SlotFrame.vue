<script setup lang="ts">
import { computed } from 'vue'
import type { BaseContent } from '@core/models'
import { LayoutMath } from '@core/utilities'
import ContentHost from '@/components/ContentHost.vue'
import { useScheduleStore } from '@/stores'

/**
 * Positions one slot on the design surface and gates it on its schedule.
 *
 * Geometry is emitted in *design* pixels; the parent scales the whole surface
 * with a CSS transform. That is a meaningful change from the legacy renderer,
 * which recomputed a percentage for every slot on every layout load and
 * produced rounding drift between slots that were meant to be flush.
 */
const props = defineProps<{ content: BaseContent; mediaBaseUrl: string }>()

const schedule = useScheduleStore()

const visible = computed(() => props.content.isScheduledAt(schedule.now))

const frameStyle = computed(() => {
  const geometry = props.content.geometry
  const background = props.content.backgroundColor
  return {
    position: 'absolute' as const,
    top: LayoutMath.toPx(geometry.top),
    left: LayoutMath.toPx(geometry.left),
    width: LayoutMath.toPx(geometry.width),
    height: LayoutMath.toPx(geometry.height),
    zIndex: geometry.layer,
    background: props.content.transparent ? 'transparent' : (background ?? 'transparent'),
    overflow: 'hidden',
  }
})
</script>

<template>
  <div v-if="visible" :style="frameStyle" :data-slot-name="content.name || undefined" :data-slot-type="content.type">
    <ContentHost :content="content" :media-base-url="mediaBaseUrl" />
  </div>
</template>
