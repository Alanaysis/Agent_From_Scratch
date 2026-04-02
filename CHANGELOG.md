# Changelog

[English](./CHANGELOG.en.md)

All notable changes to `claude-code-lite` will be documented in this file.

## [0.1.0] - 2026-04-01

### Added

- Installable CLI package with `tui`, `repl`, and headless command entrypoints.
- OpenAI-compatible and Anthropic provider support.
- Streaming assistant output in TUI and headless chat.
- Local fallback planner for basic `read/run/fetch/write/edit` prompts when no LLM is configured.
- Session transcript storage and session metadata index.
- Session inspection, export, cleanup, and recovery commands.
- Session-level permission memory.
- Build script for standalone executable via Bun compile.
- Architecture, runtime flow, core interface, and next-step docs.

### Changed

- Session metadata now includes summary, tool count, error count, and attention status.
- Session list now prioritizes `needs_attention` sessions.
- Exported transcript content is clipped to keep output manageable.

### Packaging

- Added MIT license.
- Added package-level `.gitignore`.
- Added GitHub-facing repo files: contributing, security, changelog, issue templates, and PR template.
