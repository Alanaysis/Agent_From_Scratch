export type UserMessage = {
  id: string
  type: 'user'
  content: string
}

export type AssistantTextBlock = {
  type: 'text'
  text: string
}

export type AssistantToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

export type AssistantMessage = {
  id: string
  type: 'assistant'
  content: Array<AssistantTextBlock | AssistantToolUseBlock>
}

export type ToolResultMessage = {
  id: string
  type: 'tool_result'
  toolUseId: string
  content: string
  isError?: boolean
}

export type Message = UserMessage | AssistantMessage | ToolResultMessage
