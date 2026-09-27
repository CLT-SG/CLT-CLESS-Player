import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { LayoutDefinition, LayoutDocument } from '@/core/schema'
import type { PreparedLayout } from '@/core/services/LayoutService'

/**
 * Owns: the active layout document and the prepared (renderable) layout.
 *
 * This is the single source of truth the renderer reads. Content models are
 * held in a `shallowRef` on purpose: they are plain classes with their own
 * internal cursors, and making them deeply reactive would let a component
 * mutate playback state as a side effect of rendering — exactly the coupling
 * this architecture is meant to remove.
 */
export const useLayoutStore = defineStore('layout', () => {
  const document = shallowRef<LayoutDocument | null>(null)
  const prepared = shallowRef<PreparedLayout | null>(null)
  const activeLayoutId = ref<string | null>(null)
  const revision = ref<string | null>(null)
  /** Increments on every prepared-layout swap; renderers key off it. */
  const renderGeneration = ref(0)

  const layoutDefinition = computed<LayoutDefinition | null>(() => prepared.value?.definition ?? null)
  const contents = computed(() => prepared.value?.contents ?? [])
  const hasContent = computed(() => contents.value.length > 0)

  const resolution = computed(() => layoutDefinition.value?.resolution ?? { width: 1920, height: 1080, orientation: 'landscape' as const })

  const background = computed(
    () => layoutDefinition.value?.background ?? { color: '#000000', image: null, stretch: false },
  )

  const unsupportedTypes = computed(() => prepared.value?.unsupportedTypes ?? [])
  const validationReports = computed(() => prepared.value?.validationReports ?? [])

  /** True when the document came from cache rather than the network. */
  const isFromCache = computed(() => document.value?.origin === 'cache')
  const isXmlSourced = computed(() => document.value?.origin === 'xml-adapter')

  function setDocument(next: LayoutDocument | null): void {
    document.value = next
    revision.value = next?.etag ?? null
  }

  function setPrepared(next: PreparedLayout | null): void {
    prepared.value = next
    activeLayoutId.value = next?.definition.id ?? null
    renderGeneration.value += 1
  }

  function clear(): void {
    document.value = null
    prepared.value = null
    activeLayoutId.value = null
    revision.value = null
  }

  return {
    document,
    prepared,
    activeLayoutId,
    revision,
    renderGeneration,
    layoutDefinition,
    contents,
    hasContent,
    resolution,
    background,
    unsupportedTypes,
    validationReports,
    isFromCache,
    isXmlSourced,
    setDocument,
    setPrepared,
    clear,
  }
})
