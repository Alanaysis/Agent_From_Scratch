# Changelog

[中文](./CHANGELOG.md)

All notable changes to `claude-code-lite` will be documented here.

## [0.1.0] - 2026-04-01

### Added

- installable CLI package with `tui`, `repl`, and headless command entrypoints
- OpenAI-compatible and Anthropic provider support
- streaming assistant output in TUI and headless chat
- local fallback planner for `read/run/fetch/write/edit` prompts when no LLM is configured
- session transcript storage and session metadata index
- session inspection, export, cleanup, and recovery commands
- session-level permission memory
- standalone executable build via Bun compile
- architecture, runtime flow, core interface, and next-step docs

### Changed

- session metadata now includes summary, tool count, error count, and attention status
- session list prioritizes `needs_attention` sessions
- exported transcript content is clipped to keep output manageable

### Packaging

- MIT license
- package-level `.gitignore`
- GitHub-facing repo files: contributing, security, changelog, issue templates, and PR template
