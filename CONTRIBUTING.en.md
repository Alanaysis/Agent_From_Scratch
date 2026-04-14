# Contributing

[中文](./CONTRIBUTING.md)

Thanks for your interest in `claude-code-lite`.

This repository is intentionally positioned as:

- a local-first AI coding agent CLI reference implementation
- a readable, hackable minimal runtime
- a learning-oriented codebase for agent runtime, tool loops, and terminal UI

## Good Contribution Areas

- runtime stability
- documentation
- provider abstraction
- tool protocol and built-in tools
- session / transcript management
- tests
- minimal MCP / minimal subagent

## Areas Not Recommended Right Now

- full Claude Code-grade compact
- large plugin marketplace systems
- heavy remote / bridge architectures
- product-heavy features that significantly reduce readability

## Local Development

```bash
cd claude-code-lite
npm install
bun run build
bun run typecheck
node ./bin/claude-code-lite.js --help
```

Standalone executable:

```bash
bun run build:exe
./dist/claude-code-lite --help
```

## Before Opening a PR

At minimum, run:

```bash
bun run build
bun run typecheck
node ./bin/claude-code-lite.js --help
node ./bin/claude-code-lite.js sessions
```

If you changed session/export/cleanup behavior, also run:

```bash
node ./bin/claude-code-lite.js inspect latest
node ./bin/claude-code-lite.js export-session latest --format markdown --output /tmp/session.md
node ./bin/claude-code-lite.js cleanup-sessions --status needs_attention --dry-run --older-than 0
```

## Code Style Expectations

- keep current layering: `app / runtime / tools / permissions / storage`
- do not move CLI rendering concerns into runtime
- do not leak provider-specific details into TUI / REPL
- prefer stable extension boundaries
- do not expand the `Tool` protocol unless the need is truly cross-cutting

## PR Expectations

A good PR should explain:

- what problem it solves
- why the change belongs in that layer
- whether it changes runtime / provider / tool protocol semantics
- how it was validated

If the change is substantial, update docs too:

- `README.md`
- `docs/architecture.md`
- `docs/runtime-flow.md`
- `docs/core-interfaces.md`

## Provider Keys

Do not commit real API keys to code, tests, issues, or PRs.

Relevant variables:

- `CCL_LLM_PROVIDER`
- `CCL_LLM_API_KEY`
- `CCL_LLM_MODEL`
- `CCL_LLM_BASE_URL`
- `CCL_LLM_SYSTEM_PROMPT`
- `CCL_ANTHROPIC_VERSION`
