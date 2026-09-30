<script setup lang="ts">
import { computed } from 'vue'
import type { TickerContent } from '@core/models'

/**
 * Renders a scrolling ticker (horizontal) or scroller (vertical).
 *
 * Uses a CSS keyframe animation instead of the jQuery.Marquee plugin. Besides
 * dropping a dependency, this moves the animation onto the compositor, which
 * matters on the low-power players where the JS-driven marquee visibly
 * stuttered while a video was decoding in another slot.
 *
 * The message is rendered twice so the tail of one copy meets the head of the
 * next, giving a seamless loop without measuring the text.
 */
const props = defineProps<{ content: TickerContent }>()

const message = computed(() => props.content.message)
const horizontal = computed(() => props.content.orientation === 'horizontal')

const animationName = computed(() => {
  switch (props.content.direction) {
    case 'right':
      return 'cless-ticker-right'
    case 'up':
      return 'cless-ticker-up'
    case 'down':
      return 'cless-ticker-down'
    default:
      return 'cless-ticker-left'
  }
})

const trackStyle = computed(() => {
  const typography = props.content.typography
  return {
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize,
    color: typography.color,
    fontWeight: typography.fontWeight,
    fontStyle: typography.fontStyle,
    textDecoration: typography.textDecoration,
    animationName: animationName.value,
    animationDuration: `${props.content.animationDurationSeconds}s`,
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
    // Sub-pixel smoothing; disabling it is the documented way to get crisp
    // small text on the older panels.
    WebkitFontSmoothing: props.content.antialias ? 'antialiased' : 'none',
  }
})
</script>

<template>
  <div class="relative h-full w-full overflow-hidden">
    <div
      v-if="horizontal"
      class="absolute top-0 flex h-full items-center whitespace-nowrap will-change-transform"
      :style="trackStyle"
    >
      <span class="px-8">{{ message }}</span>
      <span class="px-8" aria-hidden="true">{{ message }}</span>
    </div>

    <div
      v-else
      class="absolute left-0 flex w-full flex-col items-center will-change-transform"
      :style="trackStyle"
    >
      <span class="py-4 text-center">{{ message }}</span>
      <span class="py-4 text-center" aria-hidden="true">{{ message }}</span>
    </div>
  </div>
</template>
