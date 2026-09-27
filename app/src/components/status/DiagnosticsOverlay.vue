<script setup lang="ts">
import { computed } from 'vue'
import { FormatUtils } from '@core/utilities'
import {
  useConnectivityStore,
  useLayoutStore,
  useMediaStore,
  usePlayerStatusStore,
  usePlaylistStore,
} from '@/stores'

/**
 * On-device diagnostics panel, toggled with Ctrl+D.
 *
 * Exists because the state it shows used to be spread across global variables
 * that could only be inspected from the DevTools console — impractical on a
 * wall-mounted screen. Everything here is read from stores, which is a direct
 * benefit of centralising state.
 */
const connectivity = useConnectivityStore()
const layout = useLayoutStore()
const playlist = usePlaylistStore()
const media = useMediaStore()
const status = usePlayerStatusStore()

const rows = computed(() => [
  { label: 'Lifecycle', value: status.lifecycle },
  { label: 'Uptime', value: FormatUtils.duration(status.uptimeSeconds) },
  { label: 'Connectivity', value: `${connectivity.state} (${connectivity.failureStreak} failures)` },
  { label: 'Transport', value: connectivity.activeTransport ?? 'not negotiated' },
  { label: 'Last sync', value: connectivity.lastOutcome ?? 'never' },
  { label: 'Next poll', value: `${connectivity.nextPollSeconds}s` },
  { label: 'Source', value: layout.isFromCache ? 'cache' : layout.isXmlSourced ? 'XML adapter' : 'JSON API' },
  { label: 'Layout', value: `${layout.layoutDefinition?.name || '—'} (#${layout.activeLayoutId ?? '—'})` },
  { label: 'Revision', value: layout.revision ?? '—' },
  { label: 'Playlist', value: playlist.isPlaylist ? playlist.progressLabel : 'single layout' },
  { label: 'Slots', value: String(layout.contents.length) },
  { label: 'Asset cache', value: media.backendName },
  { label: 'Pending assets', value: String(media.pendingPaths.length) },
])

const problems = computed(() => {
  const entries: string[] = []
  if (layout.unsupportedTypes.length) {
    entries.push(`Unsupported content types: ${layout.unsupportedTypes.join(', ')}`)
  }
  for (const report of layout.validationReports) {
    entries.push(`Slot ${report.slotId} (${report.type}): ${report.issues.join('; ')}`)
  }
  if (connectivity.lastError) entries.push(`Last error: ${connectivity.lastError}`)
  return entries
})
</script>

<template>
  <div
    v-if="status.diagnosticsVisible"
    class="fixed left-4 top-4 z-overlay max-h-[80vh] w-96 overflow-auto rounded-lg border border-white/10 bg-black/85 p-4 font-mono text-xs text-white/80 backdrop-blur"
  >
    <h1 class="mb-3 text-sm font-semibold text-white">eCLESS Player diagnostics</h1>

    <dl class="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
      <template v-for="row in rows" :key="row.label">
        <dt class="text-white/45">{{ row.label }}</dt>
        <dd class="truncate text-white/90">{{ row.value }}</dd>
      </template>
    </dl>

    <div v-if="problems.length" class="mt-3 border-t border-white/10 pt-3">
      <h2 class="mb-1 text-white/60">Warnings</h2>
      <ul class="space-y-1">
        <li v-for="problem in problems" :key="problem" class="text-amber-300/80">{{ problem }}</li>
      </ul>
    </div>

    <p class="mt-3 border-t border-white/10 pt-2 text-white/35">Ctrl+D to hide</p>
  </div>
</template>
