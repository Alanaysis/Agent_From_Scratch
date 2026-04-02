# Claude Code-lite Core Interfaces

[中文](./core-interfaces.md)

This document explains the five most important interfaces in the current runtime:

- `query()`
- `canUseTool()`
- `SessionEngine`
- `Tool`
- `LlmProvider`

## Interface Map

```mermaid
flowchart TD
    Shell[TUI / REPL / Headless] --> Query[query()]
    Query --> Provider[runLlmTurn / LlmProvider]
    Query --> Permission[canUseTool()]
    Query --> Tool[Tool.call()]
    Shell --> Session[SessionEngine]
    Query --> Session
```

## `query()`

File:

- `runtime/query.ts`

Role:

- single-turn runtime entrypoint
- chooses configured LLM vs fallback planner
- normalizes assistant output
- executes tool calls
- emits assistant and tool_result messages

Change it when:

- turn-state behavior changes
- you add runtime result budgets
- you add MCP or subagent orchestration

Do not change it just to add a normal new tool.

## `canUseTool()`

File:

- `permissions/engine.ts`

Role:

- central permission decision point
- returns one of:
  - `allow`
  - `deny`
  - `ask`

Current decision order:

1. input validation
2. mode short-circuit
3. deny rules
4. allow rules
5. ask rules
6. tool-specific permission hook
7. read-only allow
8. default ask

## `SessionEngine`

File:

- `runtime/session.ts`

Role:

- hold current in-memory message list
- append transcript entries
- update session metadata index

The most important method is `recordMessages()`, because it bridges runtime state and on-disk persistence.

## `Tool`

File:

- `tools/Tool.ts`

Role:

- main extension boundary for capabilities

It covers:

- description
- execution
- read-only / concurrency semantics
- input validation
- tool-specific permission hooks

In most cases, adding a new tool should mean implementing this interface and registering it.

## `LlmProvider`

File:

- `runtime/llm.ts`

Role:

- compress provider-specific HTTP/SSE behavior into one normalized turn shape

Current normalized outputs:

- `text`
- `toolCalls[]`

This keeps provider details from leaking into TUI / REPL / headless layers.

## Stability

Relatively stable today:

- `Tool`
- `SessionEngine`
- `canUseTool()`

More likely to evolve:

- `query()`
- `LlmProvider`

Reason:

the first group is already close to a minimal complete boundary, while the second group will still evolve with MCP, subagents, budgets, and richer error models.
