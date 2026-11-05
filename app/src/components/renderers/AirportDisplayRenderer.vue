<script setup lang="ts">
import { computed } from 'vue'
import type { AirportDisplayContent } from '@core/airport-display'

/**
 * Renders the Airport Display overlay for an active boarding event.
 *
 * Slot value overrides are applied by `ContentHost`, which is the mechanism
 * that lets a zone trigger change a named text or media slot in the running
 * layout. This component covers the remaining case: an event that carries
 * flight information to show as a full overlay.
 */
const props = defineProps<{ content: AirportDisplayContent }>()

const flight = computed(() => props.content.flightInfo as Record<string, string | undefined>)
const hasFlight = computed(() => Object.keys(flight.value).length > 0)
// Gated on the announcement being enabled, not merely present: an event can
// carry a disabled announcement, and showing its text would caption something
// the player is deliberately not saying.
const announcementText = computed(() =>
  props.content.hasAnnouncement ? (props.content.announcementLanguages[0]?.text ?? '') : '',
)
</script>

<template>
  <div v-if="hasFlight || announcementText" class="flex h-full w-full flex-col justify-center gap-4 bg-black/80 px-10">
    <div v-if="hasFlight" class="grid grid-cols-2 gap-x-10 gap-y-2">
      <template v-for="(value, key) in flight" :key="key">
        <span class="text-sm uppercase tracking-wide text-white/50">{{ key }}</span>
        <span class="text-2xl font-semibold text-white">{{ value }}</span>
      </template>
    </div>

    <p v-if="announcementText" class="text-lg leading-snug text-white/80">{{ announcementText }}</p>
  </div>
</template>
