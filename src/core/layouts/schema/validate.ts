import type { ZodTypeAny, output } from 'zod'
import { layoutDocumentSchema, type LayoutDocument } from './layout'
import { parseSchemaVersion } from './version'

export interface ValidationIssue {
  readonly path: string
  readonly message: string
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T; readonly warnings: readonly ValidationIssue[] }
  | { readonly ok: false; readonly errors: readonly ValidationIssue[] }

function toIssues(error: { issues: Array<{ path: Array<string | number>; message: string }> }): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join('.') : '(root)',
    message: issue.message,
  }))
}

/**
 * Validates against a schema and returns a result object instead of throwing,
 * because a malformed payload from the server must degrade to the cached
 * layout rather than take the player down.
 */
export function validateWith<TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): ValidationResult<output<TSchema>> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, errors: toIssues(parsed.error) }
  }
  return { ok: true, value: parsed.data as output<TSchema>, warnings: [] }
}

/**
 * Validates a layout document and reports forward-compatibility warnings: a
 * newer minor version is accepted (additive by contract) but surfaced so
 * diagnostics can show that the server is ahead of the player.
 */
export function validateLayoutDocument(input: unknown): ValidationResult<LayoutDocument> {
  const result = validateWith(layoutDocumentSchema, input)
  if (!result.ok) return result

  const warnings: ValidationIssue[] = []
  const version = parseSchemaVersion(result.value.schemaVersion)
  if (version && version.minor > 0) {
    warnings.push({
      path: 'schemaVersion',
      message: `Document uses schema ${result.value.schemaVersion}; unknown additive fields are ignored`,
    })
  }
  return { ok: true, value: result.value, warnings }
}

export function describeIssues(issues: readonly ValidationIssue[], limit = 5): string {
  return issues
    .slice(0, limit)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join('; ')
}
