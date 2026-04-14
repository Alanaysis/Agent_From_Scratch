# GitHub Release Kit

[中文](./github-release-kit.md)

This document helps you publish `claude-code-lite` as a GitHub repository with ready-to-use description text, topics, and initial release notes.

## 1. Suggested Repository Name

- `claude-code-lite`

## 2. Suggested Repository Description

### Short Description

A local-first, hackable AI coding agent CLI reference implementation with TUI, REPL, headless chat, tool loops, session management, and standalone binary builds.

### Chinese Short Description

一个本地优先、可扩展的 AI 编程 agent CLI 参考实现，包含 TUI、REPL、headless chat、tool loop、session 管理和独立可执行文件构建。

## 3. Suggested Topics

- `ai-agent`
- `coding-agent`
- `cli`
- `terminal-ui`
- `llm`
- `tool-calling`
- `local-first`
- `bun`
- `typescript`
- `developer-tools`

## 4. Suggested README Top Section

Recommended:

- project background
- quick start
- quick examples
- TUI preview image

Current preview asset:

- `assets/tui-preview.svg`

## 5. Suggested First Release

### Tag

- `v0.1.0`

### Title

- `v0.1.0 · Initial public reference release`

### Release Notes

```md
## Claude Code-lite v0.1.0

Initial public release of a local-first AI coding agent CLI reference implementation.

### Included

- TUI, REPL, and headless chat entrypoints
- OpenAI-compatible and Anthropic provider support
- Streaming assistant output
- Local tool loop with file, shell, web, and agent-style tools
- Session transcript storage and metadata index
- Session inspect, export, cleanup, and resume commands
- Session-scoped permission memory
- Bun-based standalone executable build
- Architecture and runtime documentation

### Notes

- This project is a reference implementation, not a full product
- It is inspired by ideas learned from studying leaked Claude Code CLI code, but it is not a republished source dump
- Standalone binaries are platform-specific and should be built per target platform
```

## 6. Suggested GitHub Homepage Layout

1. preview image near the top
2. project background
3. goals and current capabilities
4. quick start
5. documentation links
6. release / binary notes

## 7. Minimal Release Checks

```bash
bun run build
bun run typecheck
npm pack --dry-run
bun run build:exe
./dist/claude-code-lite --help
```
