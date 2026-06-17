export type ImageBlock = {
  type: 'image'
  /** Base64-encoded image data */
  data: string
  /** MIME type (image/png, image/jpeg, etc.) */
  mimeType: string
}

export type TextBlock = {
  type: 'text'
  text: string
}

/** Content block for user messages — can be text or image */
export type UserContentBlock = TextBlock | ImageBlock

export type UserMessage = {
  id: string
  type: 'user'
  /** String (legacy) or array of content blocks (multimodal) */
  content: string | UserContentBlock[]
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

/** Extract text content from a message, handling both string and multimodal formats */
export function getMessageText(message: Message): string {
  if (message.type === 'user') {
    if (typeof message.content === 'string') return message.content
    return message.content
      .filter((b): b is TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
  }
  if (message.type === 'assistant') {
    return message.content
      .filter((b): b is AssistantTextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
  }
  if (message.type === 'tool_result') return message.content
  return ''
}

/** Check if a message has image content */
export function hasImages(message: Message): boolean {
  if (message.type !== 'user') return false
  if (typeof message.content === 'string') return false
  return message.content.some(b => b.type === 'image')
}
