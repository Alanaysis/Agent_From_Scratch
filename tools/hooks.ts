/**
 * Tool Hook System
 *
 * Provides before/after interception points for tool execution.
 * Hooks can block, modify inputs, transform results, and trigger side effects.
 */

import type { ToolUseContext } from "./Tool";

/** Context passed to hooks before tool execution */
export type HookContext = {
  toolName: string;
  input: unknown;
  context: ToolUseContext;
  sessionId?: string;
  toolUseId: string;
  timestamp: number;
};

/** Result from beforeToolCall hook */
export type BeforeHookResult = {
  /** Whether to proceed with execution. false = blocked. */
  proceed: boolean;
  /** Modified input (if provided, replaces original) */
  modifiedInput?: unknown;
  /** Reason for blocking (shown to user/LM when proceed=false) */
  reason?: string;
};

/** Result from afterToolCall hook */
export type AfterHookResult = {
  /** Whether to replace the original result */
  replaceResult?: boolean;
  /** The replacement result data */
  newResult?: unknown;
  /** Additional metadata to log */
  metadata?: Record<string, unknown>;
};

/** Hook functions */
export type ToolHooks = {
  /** Called before tool execution. Can block or modify input. */
  beforeToolCall?: (ctx: HookContext) => Promise<BeforeHookResult>;
  /** Called after tool execution. Can transform result or trigger side effects. */
  afterToolCall?: (ctx: HookContext, result: unknown, error?: Error) => Promise<AfterHookResult>;
};

/** Global hook registry */
let registeredHooks: ToolHooks = {};

/** Register hooks (can be called multiple times, hooks are merged) */
export function registerHooks(hooks: ToolHooks): void {
  registeredHooks = { ...registeredHooks, ...hooks };
}

/** Get currently registered hooks */
export function getRegisteredHooks(): ToolHooks {
  return registeredHooks;
}

/** Clear all hooks (useful for testing) */
export function clearHooks(): void {
  registeredHooks = {};
}

/** Execute all beforeToolCall hooks in order. Returns final result. */
export async function executeBeforeHooks(ctx: HookContext): Promise<BeforeHookResult> {
  if (!registeredHooks.beforeToolCall) {
    return { proceed: true };
  }

  try {
    return await registeredHooks.beforeToolCall(ctx);
  } catch (error) {
    console.error("[Hook] beforeToolCall error:", error);
    // Don't block execution on hook failure
    return { proceed: true };
  }
}

/** Execute all afterToolCall hooks in order. Returns final result. */
export async function executeAfterHooks(
  ctx: HookContext,
  result: unknown,
  error?: Error,
): Promise<AfterHookResult> {
  if (!registeredHooks.afterToolCall) {
    return {};
  }

  try {
    return await registeredHooks.afterToolCall(ctx, result, error);
  } catch (hookError) {
    console.error("[Hook] afterToolCall error:", hookError);
    // Don't modify result on hook failure
    return {};
  }
}
