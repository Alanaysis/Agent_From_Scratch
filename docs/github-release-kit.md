# GitHub 发布素材

[English](./github-release-kit.en.md)

这份文档用于帮助你把 `claude-code-lite` 作为 GitHub 仓库发布时，快速填好仓库描述、topics 和首个 release。

## 1. 仓库名称建议

- `claude-code-lite`

## 2. 仓库简介建议

### 短描述

一个本地优先、可扩展的 AI 编程 agent CLI 参考实现，包含 TUI、REPL、headless chat、tool loop、session 管理和独立可执行文件构建。

### 英文短描述

A local-first, hackable AI coding agent CLI reference implementation with TUI, REPL, headless chat, tool loops, session management, and standalone binary builds.

## 3. Topics 建议

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

## 4. README 顶部展示建议

建议保留：

- 项目背景
- Quick Start
- Quick Examples
- TUI 预览图

当前预览图资源：

- `assets/tui-preview.svg`

## 5. 首个 Release 建议

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

## 6. 仓库首页建议

如果你准备发到 GitHub，首页结构建议是：

1. README 顶部预览图
2. 项目背景
3. 项目目标与当前能力
4. Quick Start
5. 文档入口
6. Release / binary 说明

## 7. 发布前最少检查

```bash
bun run build
bun run typecheck
npm pack --dry-run
bun run build:exe
./dist/claude-code-lite --help
```
