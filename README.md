# IRG - Intelligent Robot Guide

A lightweight, modular AI agent framework with Electron GUI, designed for local-first interaction with system tools, files, and web resources.

## Features

- **Electron GUI** - Modern dark-themed interface with real-time streaming responses
- **Tool Loop** - File operations, shell commands, web search, subagents
- **Session Management** - Persistent conversations with transcript storage
- **Permission System** - Allow/deny/ask model with session memory
- **LLM Integration** - OpenAI-compatible API support with configurable providers

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build:electron

# Run GUI
npm run dev:electron:gui
```

## Configuration

Edit `~/.irg/config.json` or use the Settings panel in the GUI:

```json
{
  "provider": "openai",
  "apiKey": "your-api-key",
  "model": "gpt-4o-mini",
  "baseUrl": "https://api.openai.com/v1"
}
```

## Architecture

```
app/          - Entry points (REPL, TUI, Headless, GUI)
runtime/      - Core query engine, LLM integration, session management
tools/        - File, shell, web, agent capabilities
permissions/  - Security rules and permission verification
storage/      - Session transcripts, indexes, knowledge base
skills/       - High-level task abstractions
gui/          - Electron frontend with React components
```

## Tech Stack

- **Runtime**: Node.js, TypeScript
- **GUI**: Electron, React, Zustand, Lucide icons
- **LLM**: OpenAI Chat Completions API (streaming SSE)
- **Build**: esbuild, Next.js (for GUI bundling)

## License

MIT