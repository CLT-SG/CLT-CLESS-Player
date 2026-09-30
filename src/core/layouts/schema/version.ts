/**
 * Layout Definition Schema version.
 *
 * `MAJOR` changes break wire compatibility and require an explicit adapter;
 * `MINOR` changes are additive and must stay readable by older players. The
 * player therefore accepts any document whose major version it knows and
 * ignores unknown minor additions rather than rejecting the payload.
 */
export const SCHEMA_MAJOR = 1
export const SCHEMA_MINOR = 0
export const SCHEMA_VERSION = `${SCHEMA_MAJOR}.${SCHEMA_MINOR}` as const

export const SUPPORTED_SCHEMA_MAJORS: readonly number[] = [1]

export interface ParsedSchemaVersion {
  readonly major: number
  readonly minor: number
}

export function parseSchemaVersion(value: unknown): ParsedSchemaVersion | null {
  if (typeof value !== 'string') return null
  const match = /^(\d+)\.(\d+)$/.exec(value.trim())
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]) }
}

export function isSchemaVersionSupported(value: unknown): boolean {
  const parsed = parseSchemaVersion(value)
  return parsed !== null && SUPPORTED_SCHEMA_MAJORS.includes(parsed.major)
}
