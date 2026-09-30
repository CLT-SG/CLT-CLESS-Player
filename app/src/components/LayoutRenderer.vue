<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { LayoutMath } from '@core/utilities'
import SlotFrame from '@/components/SlotFrame.vue'
import { useLayoutStore, usePlaylistStore } from '@/stores'

/**
 * Renders the active layout.
 *
 * The layout is painted at its authored resolution inside a fixed-size
 * surface, then scaled to the viewport with a single CSS transform. One
 * transform for the whole layout (instead of per-slot arithmetic) keeps slots
 * pixel-exact relative to each other at any screen size, and makes the
 * autoscale-vs-native decision a one-line branch.
 */
const layout = useLayoutStore()
const playlist = usePlaylistStore()

const viewport = ref({ width: 1920, height: 1080 })

const design = computed(() => layout.resolution)
const autoscale = computed(() => layout.layoutDefinition?.autoscale ?? true)

const scale = computed(() => (autoscale.value ? LayoutMath.fitScale(design.value, viewport.value) : 1))

const offset = computed(() =>
  autoscale.value
    ? LayoutMath.centerOffset(design.value, viewport.value, scale.value)
    : { x: 0, y: 0 },
)

const surfaceStyle = computed(() => ({
  width: LayoutMath.toPx(design.value.width),
  height: LayoutMath.toPx(design.value.height),
  transform: `translate(${LayoutMath.toPx(offset.value.x)}, ${LayoutMath.toPx(offset.value.y)}) scale(${scale.value})`,
  transformOrigin: 'top left',
}))

const backgroundStyle = computed(() => {
  const background = layout.background
  return {
    backgroundColor: background.color,
    backgroundImage: background.image ? `url("${background.image}")` : 'none',
    backgroundSize: background.stretch ? 'cover' : 'auto',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  }
})

const transitionClass = computed(() => {
  const style = playlist.transition.style
  return style === 'none' ? '' : `cless-transition-${style}`
})

const transitionStyle = computed(() => ({
  animationDuration: `${playlist.transition.speedMs}ms`,
  animationDelay: `${playlist.transition.delayMs}ms`,
}))

const mediaBaseUrl = computed(() => layout.layoutDefinition?.mediaBaseUrl ?? '')

function measure(): void {
  viewport.value = { width: window.innerWidth, height: window.innerHeight }
}

onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', measure)
})
</script>

<template>
  <div class="relative h-full w-full overflow-hidden" :style="backgroundStyle">
    <div
      :key="layout.renderGeneration"
      class="relative"
      :class="transitionClass"
      :style="{ ...surfaceStyle, ...transitionStyle }"
    >
      <SlotFrame
        v-for="content in layout.contents"
        :key="`${content.type}-${content.id}`"
        :content="content"
        :media-base-url="mediaBaseUrl"
      />
    </div>
  </div>
</template>
