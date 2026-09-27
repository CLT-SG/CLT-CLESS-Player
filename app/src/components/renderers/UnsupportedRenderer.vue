<script setup lang="ts">
import { computed } from 'vue'
import type { BaseContent } from '@/core/content'
import { usePlayerStatusStore } from '@/stores'

/**
 * Placeholder for a content type this build cannot render.
 *
 * In production it renders nothing at all: an unknown slot must not put
 * diagnostic text on a public screen. The explanation appears only when
 * diagnostics are enabled, which is how a technician sees that a player needs
 * updating rather than guessing why an area is empty.
 */
const props = defineProps<{ content: BaseContent }>()

const status = usePlayerStatusStore()
const message = computed(() => `Unsupported content type "${props.content.type}"`)
</script>

<template>
  <div v-if="status.diagnosticsVisible" class="flex h-full w-full items-center justify-center border border-dashed border-amber-400/50 bg-amber-950/30">
    <p class="px-3 text-center text-xs text-amber-200/80">{{ message }}</p>
  </div>
</template>
