<script setup lang="ts">
import { computed, inject } from 'vue'
import type { BaseContent } from '@/core/content'
import { TextContent } from '@/core/content'
import { contentSlotSchema } from '@/core/schema/layout'
import { ContentPluginRegistry } from '@/core/plugins'
import { REGISTRY_KEY } from '@/core/runtime/injection'
import UnsupportedRenderer from '@/components/renderers/UnsupportedRenderer.vue'
import { useAirportDisplayStore, useLayoutStore } from '@/stores'

/**
 * Resolves a content object to its renderer and applies any active override.
 *
 * This is the only place that maps a content type to a component, which is
 * what keeps the plugin architecture honest: adding a content type cannot
 * require a change anywhere in the component tree above this file.
 *
 * Airport Display overrides are applied here too. A zone trigger replaces the
 * *value* of a named slot while leaving the slot's geometry and styling from
 * the layout intact, so the override is expressed as a substituted content
 * object rather than as mutated layout state.
 */
const props = defineProps<{ content: BaseContent; mediaBaseUrl: string }>()

const registry = inject<ContentPluginRegistry>(REGISTRY_KEY)
const airport = useAirportDisplayStore()
const layout = useLayoutStore()

const override = computed(() => (props.content.name ? airport.overrideFor(props.content.name) : null))

/**
 * A text-like override is rendered through `TextContent` so the override
 * value picks up the slot's authored typography.
 */
const effectiveContent = computed<BaseContent>(() => {
  const active = override.value
  if (!active || !active.value) return props.content
  if (props.content.type === 'media') return props.content

  const parsed = contentSlotSchema.safeParse({
    ...props.content.toJSON(),
    items: [{ id: `${props.content.id}-override`, text: active.value, duration: 0, order: 0 }],
  })
  return parsed.success ? new TextContent(parsed.data) : props.content
})

const component = computed(() => {
  const resolved = registry?.componentFor(effectiveContent.value.type)
  return resolved ?? UnsupportedRenderer
})

/** Forces a fresh renderer instance when the layout or the override changes. */
const instanceKey = computed(
  () => `${layout.renderGeneration}-${effectiveContent.value.id}-${override.value?.appliedAt ?? 0}`,
)
</script>

<template>
  <component
    :is="component"
    :key="instanceKey"
    :content="effectiveContent"
    :media-base-url="mediaBaseUrl"
  />
</template>
