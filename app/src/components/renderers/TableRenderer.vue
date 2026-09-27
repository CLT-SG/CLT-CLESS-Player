<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { TableContent } from '@core/models'
import { MediaUtils } from '@core/utilities'

/**
 * Renders a paginated data table (flight boards, queue displays, price lists).
 *
 * The component owns page flipping and nothing else: columns, widths, theme,
 * row decoding and page slicing all come from `TableContent`. A data refresh
 * replaces rows through `applyDataset`, so the header and the page cursor are
 * preserved — the legacy renderer tore down and rebuilt the whole table,
 * which is what caused the visible flash and the jump back to page one.
 */
const props = defineProps<{ content: TableContent; mediaBaseUrl: string }>()

const page = ref(0)
let flipTimer: ReturnType<typeof setInterval> | null = null

const theme = computed(() => props.content.theme)
const columns = computed(() => props.content.columns)
const columnWidths = computed(() => props.content.columnWidths)
const pageCount = computed(() => props.content.pageCount)

const visibleRows = computed(() => {
  // Read `page` so the slice recomputes on a flip.
  props.content.setPage(page.value)
  return props.content.visibleRows
})

const rowStyle = computed(() => (theme.value.rowHeight > 0 ? { height: `${theme.value.rowHeight}px` } : {}))

function imageUrl(path: string): string {
  return MediaUtils.joinUrl(props.mediaBaseUrl, path)
}

function stopFlipping(): void {
  if (flipTimer != null) {
    clearInterval(flipTimer)
    flipTimer = null
  }
}

function startFlipping(): void {
  stopFlipping()
  const seconds = props.content.pageFlipSeconds
  if (seconds <= 0 || pageCount.value <= 1) return

  flipTimer = setInterval(() => {
    page.value = (page.value + 1) % pageCount.value
  }, seconds * 1000)
}

watch(
  () => [props.content.id, props.content.datasetRevision, pageCount.value] as const,
  () => {
    if (page.value >= pageCount.value) page.value = 0
    startFlipping()
  },
  { immediate: true },
)

onBeforeUnmount(stopFlipping)
</script>

<template>
  <div
    class="flex h-full w-full flex-col overflow-hidden"
    :style="{
      backgroundColor: theme.backgroundColor,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      color: theme.color,
    }"
  >
    <table class="w-full table-fixed" :style="{ borderSpacing: `${theme.cellSpacing}px` }">
      <colgroup>
        <col v-for="(width, columnIndex) in columnWidths" :key="`col-${columnIndex}`" :style="{ width }" />
      </colgroup>

      <thead v-if="!theme.hideHeader">
        <tr :style="{ backgroundColor: theme.headerBackgroundColor }">
          <th
            v-for="column in columns"
            :key="`head-${column.key}`"
            class="px-2 py-1"
            :style="{
              textAlign: column.align,
              color: theme.headerColor,
              fontFamily: theme.headerFontFamily,
              fontSize: theme.headerFontSize,
            }"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="(row, rowIndex) in visibleRows"
          :key="row.key"
          :style="{
            backgroundColor: rowIndex % 2 === 0 ? theme.evenRowColor : theme.oddRowColor,
            ...rowStyle,
          }"
        >
          <td
            v-for="(cell, cellIndex) in row.cells"
            :key="`${row.key}-${cellIndex}`"
            class="px-2 py-1 align-middle"
            :class="theme.wrap ? 'whitespace-normal break-words' : 'truncate whitespace-nowrap'"
            :style="{
              textAlign: columns[cellIndex]?.align ?? 'left',
              backgroundColor: columns[cellIndex]?.backgroundColor ?? undefined,
            }"
          >
            <img
              v-if="cell.imagePaths.length"
              :src="imageUrl(cell.imagePaths[0] ?? '')"
              alt=""
              class="mx-auto max-h-full object-contain"
            />
            <span v-else>{{ cell.text }}</span>
          </td>
        </tr>

        <tr v-if="!visibleRows.length">
          <td :colspan="Math.max(1, columns.length)" class="py-6 text-center text-white/50">No data available</td>
        </tr>
      </tbody>
    </table>

    <div v-if="pageCount > 1 && !content.hidePagination" class="mt-auto flex justify-center gap-1 py-1">
      <span
        v-for="pageIndex in pageCount"
        :key="`page-${pageIndex}`"
        class="h-1.5 w-4 rounded-full transition-colors"
        :class="pageIndex - 1 === page ? 'bg-white/80' : 'bg-white/25'"
      />
    </div>
  </div>
</template>
