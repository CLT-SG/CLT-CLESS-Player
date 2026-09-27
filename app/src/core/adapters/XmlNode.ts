import { ValidationUtils } from '../utils'

/**
 * Minimal shape of an `xml-js` node in non-compact mode, which is the format
 * the existing player already produces via `convert.xml2json(xml, { compact: false })`.
 */
export interface RawXmlNode {
  type?: string
  name?: string
  text?: string | number
  attributes?: Record<string, string | number | undefined>
  elements?: RawXmlNode[]
}

/**
 * Read-only cursor over an `xml-js` tree.
 *
 * The legacy code addressed nodes by literal index chains such as
 * `result['elements']['0']['elements']['0']['elements']['0']['elements']`,
 * which threw a `TypeError` whenever the server omitted an optional element —
 * and a thrown error in that path took the whole layout down. This wrapper
 * makes every traversal total: a missing node yields an empty node, so the
 * adapter can express "the slots under display" without any guard clauses.
 */
export class XmlNode {
  private static readonly EMPTY: RawXmlNode = {}

  private constructor(private readonly raw: RawXmlNode) {}

  static from(raw: unknown): XmlNode {
    return new XmlNode(XmlNode.isRawNode(raw) ? raw : XmlNode.EMPTY)
  }

  /** Wraps a parsed `ds.xml` document, descending past the document node. */
  static fromDocument(parsed: unknown): XmlNode {
    const document = XmlNode.from(parsed)
    const root = document.children.find((child) => child.exists)
    return root ?? XmlNode.from(XmlNode.EMPTY)
  }

  private static isRawNode(value: unknown): value is RawXmlNode {
    return ValidationUtils.isRecord(value)
  }

  get exists(): boolean {
    return this.raw !== XmlNode.EMPTY && (this.raw.name != null || this.raw.elements != null || this.raw.text != null)
  }

  get name(): string {
    return this.raw.name ?? ''
  }

  /** Concatenated text of this node and any nested text nodes. */
  get text(): string {
    if (this.raw.text != null) return String(this.raw.text)
    const parts: string[] = []
    for (const child of this.raw.elements ?? []) {
      if (child.text != null) parts.push(String(child.text))
    }
    return parts.join('')
  }

  get children(): XmlNode[] {
    return (this.raw.elements ?? [])
      .filter((child) => child.type !== 'text' && child.type !== 'comment')
      .map((child) => new XmlNode(child))
  }

  /** Direct children with the given tag name. */
  childrenNamed(name: string): XmlNode[] {
    return this.children.filter((child) => child.name === name)
  }

  /** First direct child with the given name, or an empty node. */
  child(name: string): XmlNode {
    return this.childrenNamed(name)[0] ?? XmlNode.from(XmlNode.EMPTY)
  }

  /** Follows a chain of child names, e.g. `path('display', 'slots')`. */
  path(...names: string[]): XmlNode {
    let node: XmlNode = this
    for (const name of names) node = node.child(name)
    return node
  }

  attr(name: string, fallback = ''): string {
    const value = this.raw.attributes?.[name]
    return value == null ? fallback : String(value)
  }

  hasAttr(name: string): boolean {
    return this.raw.attributes?.[name] != null
  }

  attrNumber(name: string, fallback = 0): number {
    return ValidationUtils.toNumber(this.raw.attributes?.[name], fallback)
  }

  attrInt(name: string, fallback = 0): number {
    return ValidationUtils.toInteger(this.raw.attributes?.[name], fallback)
  }

  /** Reads the `Y`/`N` convention used throughout the player XML. */
  attrBoolean(name: string, fallback = false): boolean {
    if (!this.hasAttr(name)) return fallback
    return ValidationUtils.toBoolean(this.raw.attributes?.[name], fallback)
  }

  /** Every attribute, for passing unknown slot types through unmodified. */
  get attributes(): Readonly<Record<string, string>> {
    const entries = Object.entries(this.raw.attributes ?? {})
    return Object.fromEntries(entries.map(([key, value]) => [key, value == null ? '' : String(value)]))
  }
}
