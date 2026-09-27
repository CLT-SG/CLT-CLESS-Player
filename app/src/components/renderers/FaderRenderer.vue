<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { FaderContent } from '@/core/content'

/**
 * Cross-fades between text pages.
 *
 * Replaces the recursive jQuery `fadeOut`/`fadeIn` chain, which had no stop
 * condition and kept running after its slot was removed from the DOM.
 */
const props = defineProps<{ content: FaderContent }>()

const index = ref(0)
const visible = ref(true)
let timer: ReturnType<typeof setTimeout> | null = null

const items = computed(() => props.content.items)
const text = computed(() => items.value[index.value]?.text ?? '')
const fadeMs = computed(() => props.content.fadeMs)

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
    transitionDuration: `${fadeMs.value}ms`,
  }
})

function clearTimer(): void {
  if (timer != null) {
    clearTimeout(timer)
    timer = null
  }
}

function cycle(): void {
  clearTimer()
  if (items.value.length <= 1) return

  timer = setTimeout(() => {
    visible.value = false
    timer = setTimeout(() => {
      index.value = (index.value + 1) % items.value.length
      visible.value = true
      cycle()
    }, fadeMs.value)
  }, props.content.dwellMs)
}

watch(
  items,
  () => {
    index.value = 0
    visible.value = true
    cycle()
  },
  { immediate: true },
)

onBeforeUnmount(clearTimer)
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden">
    <div
      class="w-full transition-opacity ease-in-out"
      :class="visible ? 'opacity-100' : 'opacity-0'"
      :style="style"
    >
      {{ text }}
    </div>
  </div>
</template>
