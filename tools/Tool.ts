import type { AppState } from '../runtime/state'
import type { AssistantMessage, Message } from '../runtime/messages'
import type { ResourceType, ActionType } from '../permissions/types'

export type ValidationResult =
  | { result: true }
  | { result: false; message: string; errorCode?: number }

/** JSON Schema (draft-07 subset) used for tool input validation and LLM tool definitions. */
export type JsonSchema = {
  type: "object" | "string" | "number" | "boolean" | "array" | "integer"
  description?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  additionalProperties?: boolean
  items?: JsonSchema
  enum?: (string | number)[]
  default?: unknown
  minimum?: number
  maximum?: number
  pattern?: string
}

export type PermissionDecision<Input> =
  | { behavior: 'allow'; updatedInput?: Input }
  | { behavior: 'deny'; message: string }
  | { behavior: 'ask'; message: string; updatedInput?: Input }

export type ToolResult<Output> = {
  data: Output
  extraMessages?: Message[]
  contextModifier?: (context: ToolUseContext) => ToolUseContext
}

export type ToolDescribeContext = {
  isNonInteractiveSession: boolean
}

export type ToolUseContext = {
  cwd: string
  abortController: AbortController
  messages: Message[]
  getAppState(): AppState
  setAppState(updater: (prev: AppState) => AppState): void
  setAppStateForTasks?: (updater: (prev: AppState) => AppState) => void
  agentId?: string
  agentType?: string
}

export type CanUseToolFn = <Input>(
  tool: Tool<Input, unknown>,
  input: Input,
  context: ToolUseContext,
  parentMessage: AssistantMessage,
  toolUseId: string,
) => Promise<PermissionDecision<Input>>

export type Tool<Input, Output> = {
  name: string
  /** JSON Schema describing the tool's input. When non-null, the LLM tool
   *  definition and input validation are derived from this schema. */
  inputSchema: JsonSchema | null
  outputSchema?: unknown
  resourceType?: ResourceType
  actionType?: ActionType

  description(input: Input, context: ToolDescribeContext): Promise<string>

  call(
    args: Input,
    context: ToolUseContext,
    canUseTool: CanUseToolFn,
    parentMessage: AssistantMessage,
    onProgress?: (progress: unknown) => void,
  ): Promise<ToolResult<Output>>

  isReadOnly(input: Input): boolean
  isConcurrencySafe(input: Input): boolean
  isDestructive?(input: Input): boolean

  validateInput?(
    input: Input,
    context: ToolUseContext,
  ): Promise<ValidationResult>

  checkPermissions?(
    input: Input,
    context: ToolUseContext,
  ): Promise<PermissionDecision<Input>>

  preparePermissionMatcher?(
    input: Input,
  ): Promise<(pattern: string) => boolean>

  toClassifierInput?(input: Input): unknown
}

export type Tools = readonly Tool<any, any>[]

export function findToolByName(tools: Tools, name: string): Tool<any, any> | undefined {
  return tools.find(tool => tool.name === name)
}
