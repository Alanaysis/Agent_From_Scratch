# Claude Code-lite Runtime Flow

[中文](./runtime-flow.md)

This document focuses on runtime behavior:

1. what happens after user input
2. how tool calls run
3. how sessions and transcripts are persisted

## Turn Flow

```mermaid
sequenceDiagram
    participant User
    participant Shell as TUI / REPL / Headless
    participant Query as query()
    participant LLM as runtime/llm.ts
    participant Perm as canUseTool()
    participant Tool as Tool.call()
    participant Session as SessionEngine

    User->>Shell: prompt
    Shell->>Session: record user message
    Shell->>Query: query(prompt, history, context)

    alt configured LLM
        Query->>LLM: runLlmTurn()
        LLM-->>Shell: text deltas
        LLM-->>Query: final text + tool calls
    else fallback planner
        Query-->>Query: planPrompt()
    end

    alt tool call exists
        Query->>Perm: canUseTool()
        Perm-->>Shell: ask if needed
        Shell-->>Perm: decision
        Query->>Tool: call()
        Tool-->>Query: ToolResult
        Query-->>Shell: assistant/tool_result messages
    else text only
        Query-->>Shell: assistant text message
    end

    Shell->>Session: record new messages
```

## Entrypoints

### TUI

- full-screen interaction
- best for day-to-day local usage

### REPL

- lighter persistent session
- good for debugging runtime behavior

### Headless

- best for scripts and utility commands
- also exposes chat, sessions, inspect, export, cleanup

## Query Responsibilities

`runtime/query.ts` currently:

- builds tool definitions
- chooses provider or fallback planner
- processes assistant text and tool calls
- checks permissions
- executes tools
- emits normalized messages

## Provider Flow

```mermaid
flowchart TD
    ENV[getLlmConfigFromEnv] --> P{provider}
    P -- openai --> OAI[OpenAI-compatible adapter]
    P -- anthropic --> ANT[Anthropic adapter]
    OAI --> RESP[LlmTurnResponse]
    ANT --> RESP
```

Both providers normalize to:

- `text`
- `toolCalls[]`

## Tool Flow

```mermaid
flowchart TD
    Q[query] --> FIND[findToolByName]
    FIND --> PERM[canUseTool]
    PERM --> DEC{allow/ask/deny}
    DEC -- allow --> CALL[tool.call]
    DEC -- ask --> UI[user confirmation]
    UI --> CALL
    DEC -- deny --> ERR[tool_result error]
    CALL --> RES[ToolResult]
```

## Session Persistence

`SessionEngine.recordMessages()` currently:

1. appends `.jsonl` transcript
2. updates `.json` session metadata

This split is deliberate:

- transcript stores raw history
- session index stores searchable / display-friendly metadata

## Current Limitations

- no advanced compacting
- no runtime-level result budget yet
- no full MCP layer
- no full subagent runtime
