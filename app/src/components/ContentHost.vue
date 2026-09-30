<script setup lang="ts">
import { computed } from 'vue'
import type { BaseContent } from '@core/models'
import { MediaContent, TextContent } from '@core/models'
import { contentSlotSchema } from '@core/layouts/schema/layout'
import { rendererFor } from '@/renderers'
import { useAirportDisplayStore, useLayoutStore } from '@/stores'

/**
 * Resolves a content object to its renderer and applies any active override.
 *
 * This is the only place that consults the renderer map, which is what keeps
 * the plugin architecture honest: adding a content type cannot require a
 * change anywhere in the component tree above this file.
 *
 * Airport Display overrides are applied here too. A zone trigger replaces the
 * *value* of a named slot while leaving the slot's geometry and styling from
 * the layout intact, so the override is expressed as a substituted content
 * object rather than as mutated layout state.
 */
const props = defineProps<{ content: BaseContent; mediaBaseUrl: string }>()

const airport = useAirportDisplayStore()
const layout = useLayoutStore()

const override = computed(() => (props.content.name ? airport.overrideFor(props.content.name) : null))

/**
 * A text-like override is rendered through `TextContent` so the override
 * value picks up the slot's authored typography; a media override is rendered
 * through `MediaContent` so it picks up the slot's fit and mute settings.
 *
 * Substituting rather than mutating is what makes the override temporary for
 * free: dropping it from the store restores the layout's own content, with no
 * snapshot to take and restore the way the legacy renderer has to.
 */
const effectiveContent = computed<BaseContent>(() => {
  const active = override.value
  if (!active) return props.content

  if (props.content.type === 'media') {
    if (!active.mediaItems.length) return props.content
    const parsed = contentSlotSchema.safeParse({
      ...props.content.toJSON(),
      items: active.mediaItems.map((item, index) => ({
        id: `${props.content.id}-override-${index}`,
        text: item.path,
        duration: item.duration,
        order: index,
      })),
    })
    return parsed.success ? new MediaContent(parsed.data, props.mediaBaseUrl) : props.content
  }

  if (!active.value) return props.content

  const parsed = contentSlotSchema.safeParse({
    ...props.content.toJSON(),
    items: [{ id: `${props.content.id}-override`, text: active.value, duration: 0, order: 0 }],
  })
  return parsed.success ? new TextContent(parsed.data) : props.content
})

const component = computed(() => rendererFor(effectiveContent.value.type))

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
