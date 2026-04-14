import type { AssistantMessage } from '../runtime/messages'
import type { CanUseToolFn, ToolUseContext } from './Tool'

export type ToolUseBlock = {
  id: string
  name: string
  input: unknown
}

export async function* runTools(
  _toolUses: ToolUseBlock[],
  _assistantMessages: AssistantMessage[],
  _canUseTool: CanUseToolFn,
  _toolUseContext: ToolUseContext,
): AsyncGenerator<void, void> {
  // Placeholder for serial or batched tool execution.
}
