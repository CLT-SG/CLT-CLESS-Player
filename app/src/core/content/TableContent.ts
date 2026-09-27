import { BaseContent } from './BaseContent'
import type { ContentSlotDefinition, DatasetDefinition } from '../schema'
import { ColorUtils, LayoutMath, ValidationUtils } from '../utils'

export interface TableColumn {
  readonly key: string
  readonly label: string
  /** Relative width as authored; converted to a percentage by `columnWidths`. */
  readonly width: number
  readonly align: 'left' | 'center' | 'right'
  readonly backgroundColor: string | null
  readonly fillToColumn: boolean
}

export interface TableCell {
  readonly text: string
  /** Media reference when the cell encodes `image:...`. */
  readonly imagePaths: readonly string[]
  readonly rotate: boolean
}

export interface TableRow {
  readonly key: string
  readonly cells: readonly TableCell[]
  readonly inlineStyle: string
}

export interface TableTheme {
  readonly fontFamily: string
  readonly fontSize: string
  readonly color: string
  readonly backgroundColor: string
  readonly headerFontFamily: string
  readonly headerFontSize: string
  readonly headerColor: string
  readonly headerBackgroundColor: string
  readonly oddRowColor: string
  readonly evenRowColor: string
  readonly rowHeight: number
  readonly cellSpacing: number
  readonly hideHeader: boolean
  readonly wrap: boolean
}

/**
 * Data table content (flight boards, price lists, queue displays).
 *
 * This is the most configuration-heavy content type, and in the legacy player
 * it was also the largest single file (~1500 lines) because parsing, styling,
 * pagination and cell animation were interleaved. Here the class owns only
 * *interpretation* of the definition and dataset: column geometry, the theme,
 * row decoding and page slicing. Animation and DOM belong to the renderer.
 */
export class TableContent extends BaseContent {
  private dataset: DatasetDefinition | null
  private page = 0

  constructor(definition: ContentSlotDefinition, dataset: DatasetDefinition | null) {
    super(definition)
    this.dataset = dataset
  }

  override get type(): string {
    return 'table'
  }

  get title(): string {
    return this.configString('title', this.name)
  }

  get columns(): readonly TableColumn[] {
    const raw = this.rawConfig['columns']
    if (!Array.isArray(raw)) return []
    return raw.map((entry, index) => {
      const record = ValidationUtils.isRecord(entry) ? entry : {}
      const align = ValidationUtils.toStringValue(record['align'], 'left').toLowerCase()
      const bgEnabled = ValidationUtils.toBoolean(record['backgroundEnabled'], false)
      return {
        key: ValidationUtils.toStringValue(record['key'], `col${String(index + 1).padStart(2, '0')}`),
        label: ValidationUtils.toStringValue(record['label'], ''),
        width: ValidationUtils.toNumber(record['width'], 0),
        align: align === 'center' || align === 'c' ? 'center' : align === 'right' || align === 'r' ? 'right' : 'left',
        backgroundColor: bgEnabled ? ColorUtils.normalizeHex(ValidationUtils.toStringValue(record['backgroundColor'])) : null,
        fillToColumn: ValidationUtils.toBoolean(record['fillToColumn'], false),
      }
    })
  }

  /**
   * Column widths as CSS percentages.
   *
   * Authored widths are relative units, and legacy layouts frequently declare
   * them inconsistently (some in pixels, some already summing to 100). They
   * are normalised against their own total so the table always fills the slot,
   * and columns with no declared width share the remainder equally.
   */
  get columnWidths(): readonly string[] {
    const columns = this.columns
    if (!columns.length) return []

    const declared = columns.filter((column) => column.width > 0)
    const total = declared.reduce((sum, column) => sum + column.width, 0)
    if (!declared.length || total <= 0) {
      return columns.map(() => `${(100 / columns.length).toFixed(4)}%`)
    }

    const impliedShare = 100 / columns.length
    return columns.map((column) =>
      column.width > 0 ? `${((column.width / total) * 100).toFixed(4)}%` : `${impliedShare.toFixed(4)}%`,
    )
  }

  get theme(): TableTheme {
    const header = this.configRecord('header')
    return {
      fontFamily: this.configString('font', 'inherit') || 'inherit',
      fontSize: `${this.configNumber('fontSize', 24)}px`,
      color: ColorUtils.normalizeHex(this.configString('fontColor', '#ffffff'), '#ffffff'),
      backgroundColor: this.transparent ? 'transparent' : ColorUtils.normalizeHex(this.configString('backgroundColor'), '#000000'),
      headerFontFamily: ValidationUtils.toStringValue(header['font'], 'inherit') || 'inherit',
      headerFontSize: `${ValidationUtils.toNumber(header['fontSize'], 24)}px`,
      headerColor: ColorUtils.normalizeHex(ValidationUtils.toStringValue(header['fontColor'], '#ffffff'), '#ffffff'),
      headerBackgroundColor: ColorUtils.normalizeHex(ValidationUtils.toStringValue(header['backgroundColor'], '#222222'), '#222222'),
      oddRowColor: ColorUtils.normalizeHex(this.configString('oddRowColor', '#111111'), '#111111'),
      evenRowColor: ColorUtils.normalizeHex(this.configString('evenRowColor', '#1a1a1a'), '#1a1a1a'),
      rowHeight: this.configNumber('rowHeight', 0),
      cellSpacing: this.configNumber('cellSpacing', 0),
      hideHeader: ValidationUtils.toBoolean(header['hidden'], false),
      wrap: this.configBoolean('wrap', false),
    }
  }

  /** `0` disables the row cap. */
  get maxRows(): number {
    return this.configBoolean('maxRowsEnabled', false) ? Math.max(0, this.configNumber('maxRows', 0)) : 0
  }

  get rowsPerPage(): number {
    const explicit = this.configNumber('rowsPerPage', 0)
    if (explicit > 0) return Math.trunc(explicit)

    const rowHeight = this.theme.rowHeight
    if (rowHeight <= 0) return this.rows.length || 1
    const headerAllowance = this.theme.hideHeader ? 0 : rowHeight
    return Math.max(1, Math.floor((this.geometry.height - headerAllowance) / rowHeight))
  }

  /** Seconds between automatic page flips; `0` disables pagination. */
  get pageFlipSeconds(): number {
    return Math.max(0, this.configNumber('pageFlipSeconds', 0))
  }

  get hidePagination(): boolean {
    return this.configBoolean('hidePagination', false)
  }

  get transition(): string {
    return this.configString('transition', 'none') || 'none'
  }

  get datasetRevision(): string {
    return this.dataset?.revision ?? ''
  }

  get rows(): readonly TableRow[] {
    const rows = this.dataset?.rows ?? []
    const limited = this.maxRows > 0 ? rows.slice(0, this.maxRows) : rows
    const columns = this.columns
    return limited.map((row, rowIndex) => ({
      key: `${this.id}-${rowIndex}`,
      inlineStyle: row['style'] ?? '',
      cells: columns.map((column) => TableContent.decodeCell(row[column.key] ?? '')),
    }))
  }

  get pageCount(): number {
    const perPage = this.rowsPerPage
    if (perPage <= 0) return 1
    return Math.max(1, Math.ceil(this.rows.length / perPage))
  }

  get currentPage(): number {
    return this.page
  }

  get visibleRows(): readonly TableRow[] {
    const perPage = this.rowsPerPage
    const rows = this.rows
    if (perPage <= 0 || perPage >= rows.length) return rows
    const start = this.page * perPage
    return rows.slice(start, start + perPage)
  }

  /** Advances to the next page. Returns `true` when it wrapped to page 0. */
  advancePage(): boolean {
    const count = this.pageCount
    this.page = (this.page + 1) % count
    return this.page === 0
  }

  setPage(index: number): void {
    this.page = LayoutMath.clamp(Math.trunc(index), 0, this.pageCount - 1)
  }

  /**
   * Replaces row data without rebuilding the slot.
   *
   * This is the supported path for the "silent refresh" behaviour: header,
   * column geometry and the page cursor survive, so a data update does not
   * make the table flash or jump back to page one.
   */
  applyDataset(dataset: DatasetDefinition | null): void {
    this.dataset = dataset
    if (this.page >= this.pageCount) this.page = 0
  }

  /**
   * Decodes the server's cell encoding.
   *
   * Cells are plain text unless they carry a `image:`, `fader:` or
   * `transition:` prefix, in which case the trailing comma-separated list is
   * the rotation payload.
   */
  private static decodeCell(raw: string): TableCell {
    const value = raw ?? ''
    const match = /^(image|fader|transition):(?:[^:]*:)?(.*)$/.exec(value)
    if (!match) return { text: value, imagePaths: [], rotate: false }

    const [, kind, payload] = match
    const entries = (payload ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)

    if (kind === 'image') {
      return { text: '', imagePaths: entries, rotate: entries.length > 1 }
    }
    return { text: entries.join(' '), imagePaths: [], rotate: entries.length > 1 }
  }
}
