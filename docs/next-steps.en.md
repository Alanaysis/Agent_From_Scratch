# Claude Code-lite Next Steps

[中文](./next-steps.md)

This document is for maintainers who want to publish `claude-code-lite` on GitHub as a learning-oriented AI coding agent reference project.

## Current Baseline

The current version already has enough to publish:

- installable / packageable / runnable
- TUI, REPL, headless chat
- OpenAI-compatible / Anthropic provider support
- streaming output, tool loop, session resume/export/cleanup
- minimal permission confirmation and session-scoped memory

## Priority 1: Improve Reference Value

Already completed:

- `docs/architecture.md`
- `docs/runtime-flow.md`
- `docs/core-interfaces.md`

These should remain up to date as runtime structure evolves.

## Priority 2: Stabilize Runtime

Recommended next:

- unified error model
- runtime-level tool result budget
- finer-grained interrupt semantics

## Priority 3: Expand Carefully

Recommended next:

- stronger provider capability model
- minimal MCP
- minimal subagent

Avoid jumping straight into:

- full compact systems
- background task platforms
- remote bridge / IDE bridge
- large plugin ecosystems

## Priority 4: Improve GitHub Experience

Already added:

- `CONTRIBUTING.md`
- `SECURITY.md`
- `CHANGELOG.md`
- issue templates
- PR template

Still useful later:

- screenshots / GIFs
- demo recordings
- architecture diagrams embedded in GitHub pages

## Priority 5: Add High-Value Tests

Most valuable early tests:

- command parsing tests
- session metadata tests
- provider SSE parsing tests

## Suggested Release Path

### v0.1.0

- reference project
- minimal usable agent CLI
- learning-oriented runtime sample

### v0.2.0

- stronger docs
- unified errors
- basic tests
- better session inspection

### v0.3.0

- minimal MCP
- minimal subagent
- tool result budget

## Positioning Recommendation

Do not position it as:

- “an open-source Claude Code replacement”

Better positioning:

- “A minimal AI coding agent CLI runtime for learning and extension”
- “A reference implementation of a local-first coding agent CLI”
- “A small, hackable runtime inspired by Claude Code”

## Release Checklist

- `bun run build`
- `bun run typecheck`
- `npm pack --dry-run`
- `node ./bin/claude-code-lite.js --help`
- `node ./bin/claude-code-lite.js sessions`
- `node ./bin/claude-code-lite.js inspect latest`
- `node ./bin/claude-code-lite.js export-session latest --format markdown --output /tmp/session.md`

## Standalone Binary Note

This project can also ship a standalone executable with Bun:

```bash
bun run build:exe
```

That binary:

- does not depend on Node.js
- embeds the Bun runtime
- is platform-specific

It is a good fit for GitHub Releases in addition to npm distribution.
