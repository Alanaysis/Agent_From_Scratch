# Agent_From_Scratch - Improvement Plan

## Goal
Make the project capable of the main functionality that a real Claude Code / Hermes Agent provides.

## Phase 1: Core Tooling (Highest Impact)

### 1.1 File Tree Tool (`ls`)
- New tool: `FileTree` - list directory contents with recursive option
- Supports `maxDepth`, `includeHidden`, `fileLimit` params
- Shows file sizes, permissions, types (file/dir/symlink)
- Replaces the need to use Shell for directory exploration

### 1.2 Search Files Tool (`find`/`grep`)
- New tool: `SearchFiles` - search files by glob pattern and/or content
- `glob` param: `*.ts`, `src/**/*.json`, etc.
- `pattern` param: regex for content search
- `limit` param: max results
- Returns file paths with match counts or actual matching lines

### 1.3 Image Upload & Analysis
- New tool: `ImageUpload` - accept base64 image, store in session
- New tool: `ImageAnalyze` - send image to LLM provider for vision
- Store uploaded images in `.claude-code-lite/images/`
- Support Claude and OpenAI vision APIs

### 1.4 Web Search Tool
- New tool: `WebSearch` - search the web (DuckDuckGo free API, or configurable provider)
- `query` param, `maxResults` param
- Returns titles, URLs, snippets
- More efficient than Playwright for text-based search

### 1.5 Image Generation
- New tool: `ImageGenerate` - generate images via API
- `prompt` param, `size` param, `model` param
- Support multiple backends (OpenAI DALL-E, Stability AI, etc.)
- Save to `.claude-code-lite/images/`

## Phase 2: Conversation Management

### 2.1 Context Compression
- Add token counting per message
- Implement sliding window or summarization-based compression
- Auto-trigger when approaching token limit
- Configurable `maxTokens` and `compressionThreshold`

### 2.2 Token Usage Tracking
- Track input/output tokens per turn
- Display usage summary at end of session
- Show approximate cost

### 2.3 Edit Diff Display
- Before applying edits, show a unified diff
- Let user confirm with the diff visible
- Optional: create backup of original file

### 2.4 File Write Protection
- Create backup before Write/Edit operations
- Store in `.claude-code-lite/backups/`
- Reference in tool output for easy recovery

## Phase 3: Advanced Features

### 3.1 Interactive Browser Automation
- Replace WebFetch with full browser control
- Navigate, click, type, screenshot
- Use Playwright properly with CDP protocol
- Support for CAPTCHAs, JS-rendered pages

### 3.2 Cron Job System
- Schedule recurring agent tasks
- `cron list`, `cron create`, `cron remove` CLI commands
- Store jobs in `.claude-code-lite/cron/`
- Simple cron expression format

### 3.3 Better Permissions Model
- Per-tool permission modes (allow/ask/deny)
- Save permission rules to `.claude-code-lite/permissions.json`
- Import/export permission configs
- Pattern matching for file paths and commands

### 3.4 Skill System Enhancement
- Persistent skill storage with frontmatter
- Skill discovery and installation
- Skill activation based on context (file types, project structure)
- Skill documentation with examples

## Phase 4: Platform Integration

### 4.1 Gateway / Messaging
- Telegram bot support
- Discord bot support
- Webhook-based integration
- Message threading and session mapping

### 4.2 MCP Server Support
- Expose agent as MCP server
- Allow other tools to call agent functions
- Standard MCP protocol for tool discovery

## Implementation Order

1. FileTree tool (quick win, high value)
2. SearchFiles tool (quick win, high value)
3. Image upload/analysis
4. WebSearch tool
5. Context compression (critical for long sessions)
6. Token tracking
7. Edit diff + backup
8. Image generation
9. Browser automation
10. Cron system
11. Permission enhancements
12. Skill system
13. Gateway/messaging
