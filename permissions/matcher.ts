import type { PermissionRule } from './types'

export function matchesRule(
  _toolName: string,
  _rule: PermissionRule,
  _input: unknown,
): boolean {
  return false
}
