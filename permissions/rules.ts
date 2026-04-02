import type { PermissionContext, PermissionRule } from './types'

export function addAllowRule(
  context: PermissionContext,
  rule: PermissionRule,
): PermissionContext {
  return {
    ...context,
    allowRules: [...context.allowRules, rule],
  }
}
