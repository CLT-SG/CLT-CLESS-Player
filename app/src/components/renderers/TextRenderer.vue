<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { TextContent } from '@/core/content'

/**
 * Renders a static or rotating text slot.
 *
 * Server-authored text may legitimately contain markup, so it is injected as
 * HTML. That is the existing contract with the CMS; sanitising here would
 * silently break layouts that rely on inline styling.
 */
const props = defineProps<{ content: TextContent }>()

const index = ref(0)
let timer: ReturnType<typeof setTimeout> | null = null

const items = computed(() => props.content.items)
const html = computed(() => items.value[index.value]?.text ?? '')
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

function clearTimer(): void {
  if (timer != null) {
    clearTimeout(timer)
    timer = null
  }
}

function schedule(): void {
  clearTimer()
  if (items.value.length <= 1) return

  const dwellMs = items.value[index.value]?.durationMs ?? 0
  if (dwellMs <= 0) return
  timer = setTimeout(() => {
    index.value = (index.value + 1) % items.value.length
    schedule()
  }, dwellMs)
}

watch(
  items,
  () => {
    index.value = 0
    schedule()
  },
  { immediate: true },
)

onBeforeUnmount(clearTimer)
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden" :style="style">
    <!-- eslint-disable-next-line vue/no-v-html -- server-authored markup, see component doc -->
    <div class="w-full" v-html="html" />
  </div>
</template>
