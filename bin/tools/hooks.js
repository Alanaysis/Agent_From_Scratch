/**
 * Tool Hook System
 *
 * Provides before/after interception points for tool execution.
 * Hooks can block, modify inputs, transform results, and trigger side effects.
 */
/** Global hook registry */
let registeredHooks = {};
/** Register hooks (can be called multiple times, hooks are merged) */
export function registerHooks(hooks) {
    registeredHooks = { ...registeredHooks, ...hooks };
}
/** Get currently registered hooks */
export function getRegisteredHooks() {
    return registeredHooks;
}
/** Clear all hooks (useful for testing) */
export function clearHooks() {
    registeredHooks = {};
}
/** Execute all beforeToolCall hooks in order. Returns final result. */
export async function executeBeforeHooks(ctx) {
    if (!registeredHooks.beforeToolCall) {
        return { proceed: true };
    }
    try {
        return await registeredHooks.beforeToolCall(ctx);
    }
    catch (error) {
        console.error("[Hook] beforeToolCall error:", error);
        // Don't block execution on hook failure
        return { proceed: true };
    }
}
/** Execute all afterToolCall hooks in order. Returns final result. */
export async function executeAfterHooks(ctx, result, error) {
    if (!registeredHooks.afterToolCall) {
        return {};
    }
    try {
        return await registeredHooks.afterToolCall(ctx, result, error);
    }
    catch (hookError) {
        console.error("[Hook] afterToolCall error:", hookError);
        // Don't modify result on hook failure
        return {};
    }
}
