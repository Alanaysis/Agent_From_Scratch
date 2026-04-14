export type Usage = {
  inputTokens: number
  outputTokens: number
}

export function emptyUsage(): Usage {
  return {
    inputTokens: 0,
    outputTokens: 0,
  }
}
