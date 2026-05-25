export type Usage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  approxCost?: number
}

export function emptyUsage(): Usage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  }
}

// Estimate tokens from text (rough approximation)
// Rule of thumb: ~4 chars per token for English
export function estimateTokens(text: string): number {
  if (!text) return 0
  // Count newlines as separate tokens
  const newlineCount = (text.match(/\n/g) || []).length
  const charTokens = Math.ceil(text.length / 4)
  return charTokens + newlineCount
}

// Estimate tokens from messages
export function estimateMessageTokens(messages: Array<{ type: string; content: string | Array<any> }>): number {
  let total = 0
  for (const msg of messages) {
    if (msg.type === "user") {
      total += estimateTokens(typeof msg.content === "string" ? msg.content : "")
    } else if (msg.type === "tool_result") {
      total += estimateTokens(typeof msg.content === "string" ? msg.content : "")
    } else if (msg.type === "assistant") {
      const contentArr = Array.isArray(msg.content) ? msg.content : []
      for (const block of contentArr) {
        if (block.type === "text") {
          total += estimateTokens(block.text)
        } else if (block.type === "tool_use") {
          total += estimateTokens(JSON.stringify(block.input ?? {}))
        }
      }
    }
  }
  return total
}

// Simple sliding window compression: keep recent messages, summarize older ones
export function compressMessages(
  messages: Array<{ type: string; content: string | Array<any> }>,
  targetTokenLimit: number,
  currentTokenCount: number,
): { compressed: Array<{ type: string; content: string | Array<any> }>; summary: string } {
  if (currentTokenCount <= targetTokenLimit * 0.8) {
    return { compressed: [...messages], summary: "" }
  }

  const summaryParts: string[] = []
  let compressed: Array<{ type: string; content: string | Array<any> }> = []
  let tokenCount = 0

  // Keep the last N messages, compress the rest
  const keepLast = Math.max(3, Math.floor(messages.length * 0.3))
  const toCompress = messages.slice(0, messages.length - keepLast)
  const toKeep = messages.slice(messages.length - keepLast)

  // Summarize compressed messages by grouping
  for (let i = 0; i < toCompress.length; i += 2) {
    const msg = toCompress[i]
    if (msg.type === "user") {
      const content = typeof msg.content === "string" ? msg.content : ""
      summaryParts.push(`User: ${content.slice(0, 200)}...`)
    } else if (msg.type === "tool_result") {
      const content = typeof msg.content === "string" ? msg.content : ""
      summaryParts.push(`Tool result: ${content.slice(0, 100)}...`)
    } else if (msg.type === "assistant") {
      const contentArr = Array.isArray(msg.content) ? msg.content : []
      const textBlocks = contentArr.filter((b) => b.type === "text")
      const text = textBlocks.map((b) => b.text).join("\n")
      if (text) {
        summaryParts.push(`Assistant: ${text.slice(0, 200)}...`)
      }
    }
  }

  const summary = summaryParts.length > 0
    ? `Earlier conversation summary (${toCompress.length} messages compressed): ${summaryParts.join(" | ")}`
    : ""

  tokenCount = estimateMessageTokens(toKeep) + estimateTokens(summary)

  compressed = toKeep

  return { compressed: [...compressed], summary }
}

// Format usage for display
export function formatUsage(usage: Usage): string {
  const lines = [
    `Input tokens: ${usage.inputTokens.toLocaleString()}`,
    `Output tokens: ${usage.outputTokens.toLocaleString()}`,
    `Total tokens: ${usage.totalTokens.toLocaleString()}`,
  ]
  if (usage.approxCost !== undefined) {
    lines.push(`Estimated cost: $${usage.approxCost.toFixed(4)}`)
  }
  return lines.join("\n")
}
