export type TableCellKind = 'text' | 'image' | 'fader' | 'transition'

export interface DecodedTableCell {
  readonly kind: TableCellKind
  /** Trimmed, non-empty payload entries, in document order. */
  readonly entries: readonly string[]
  /** The value shown first; empty for an image cell. */
  readonly text: string
  readonly rotate: boolean
}

/**
 * Decodes the cell encoding the CMS writes into table rows.
 *
 * A cell is plain text unless it carries a prefix, and the two prefix
 * families delimit their payload differently. That asymmetry looks like a
 * bug and is not safe to "fix": layouts in the field depend on it.
 *
 *  - `image:<style>:<file,file>` — the file list follows the **last** colon,
 *    so any metadata between the prefix and the list is skipped.
 *  - `fader:<text,text>` and `transition:<text,text>` — the list follows the
 *    **first** colon, so the values themselves may contain colons.
 *
 * Presentation settings (transition style, timing) come from the column
 * definition, never from the cell.
 *
 * This lives in the shared core rather than in either renderer because both
 * have to agree on it exactly: a table that decodes differently under the two
 * renderers is the most visible way the migration could go wrong, and the
 * parity tests in `tests/shared-core-parity.spec.ts` pin it.
 */
export abstract class TableCellCodec {
  static decode(raw: string | null | undefined): DecodedTableCell {
    const value = raw ?? ''

    if (value.startsWith('image:')) {
      const entries = TableCellCodec.splitList(value.slice(value.lastIndexOf(':') + 1))
      return { kind: 'image', entries, text: '', rotate: entries.length > 1 }
    }

    if (value.startsWith('fader:')) {
      const entries = TableCellCodec.splitList(value.slice(value.indexOf(':') + 1))
      return { kind: 'fader', entries, text: entries[0] ?? '', rotate: entries.length > 1 }
    }

    if (value.startsWith('transition:')) {
      const entries = TableCellCodec.splitList(value.slice(value.indexOf(':') + 1))
      return { kind: 'transition', entries, text: entries[0] ?? '', rotate: entries.length > 1 }
    }

    return { kind: 'text', entries: [value], text: value, rotate: false }
  }

  /** Convenience for the legacy renderer, which only wants the list. */
  static entries(raw: string | null | undefined): readonly string[] {
    return TableCellCodec.decode(raw).entries
  }

  static splitList(payload: string): string[] {
    return payload
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
}
