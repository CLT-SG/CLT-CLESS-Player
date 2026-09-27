import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AssetSyncSummary } from '@/core/storage'

/**
 * Owns: asset cache state.
 *
 * Separated from the layout store because asset availability changes on a
 * different cadence than the layout itself: media keeps downloading in the
 * background while a layout is already on screen.
 */
export const useMediaStore = defineStore('media', () => {
  const lastSummary = ref<AssetSyncSummary | null>(null)
  const pendingPaths = ref<readonly string[]>([])
  const resolvedUrls = ref<Record<string, string>>({})
  const backendName = ref('metadata-only')

  const hasPendingDownloads = computed(() => pendingPaths.value.length > 0)
  const cacheComplete = computed(
    () => lastSummary.value != null && lastSummary.value.failed === 0 && pendingPaths.value.length === 0,
  )

  function recordSummary(summary: AssetSyncSummary): void {
    lastSummary.value = summary
  }

  function setPending(paths: readonly string[]): void {
    pendingPaths.value = paths
  }

  /** Caches the local URL for an asset so renderers avoid repeat lookups. */
  function rememberUrl(path: string, url: string): void {
    resolvedUrls.value = { ...resolvedUrls.value, [path]: url }
  }

  function urlFor(path: string): string | null {
    return resolvedUrls.value[path] ?? null
  }

  function setBackend(name: string): void {
    backendName.value = name
  }

  return {
    lastSummary,
    pendingPaths,
    resolvedUrls,
    backendName,
    hasPendingDownloads,
    cacheComplete,
    recordSummary,
    setPending,
    rememberUrl,
    urlFor,
    setBackend,
  }
})
