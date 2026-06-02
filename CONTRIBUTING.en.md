# Contributing

[中文](./CONTRIBUTING.md)

Thanks for your interest in `irg`.

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
cd irg
npm install
bun run build
bun run typecheck
node ./bin/irg.js --help
```

Standalone executable:

```bash
bun run build:exe
./dist/irg --help
```

## Before Opening a PR

At minimum, run:

```bash
bun run build
bun run typecheck
node ./bin/irg.js --help
node ./bin/irg.js sessions
```

If you changed session/export/cleanup behavior, also run:

```bash
node ./bin/irg.js inspect latest
node ./bin/irg.js export-session latest --format markdown --output /tmp/session.md
node ./bin/irg.js cleanup-sessions --status needs_attention --dry-run --older-than 0
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

- `IRG_LLM_PROVIDER`
- `IRG_LLM_API_KEY`
- `IRG_LLM_MODEL`
- `IRG_LLM_BASE_URL`
- `IRG_LLM_SYSTEM_PROMPT`
- `IRG_ANTHROPIC_VERSION`
