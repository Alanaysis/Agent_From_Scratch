# Claude Code-lite

[English](./README.en.md)

![Claude Code-lite TUI Preview](./assets/tui-preview.svg)

一个面向学习、拆解和二次开发的最小 AI 编程 agent CLI。

它不是 Claude Code 的复刻，也不是一个完整产品，而是一个本地优先、结构清楚、可直接运行的参考实现，适合作为你自己的 agent CLI 起点。

## 项目背景

今天是 04/01，愚人节。早上一打开消息就看到有人说 Claude Code CLI 的代码泄露了，起初我以为只是个玩笑，结果一查发现居然是真的。于是我把代码包下载下来，认真读了一遍。

看完之后很直接的感受是：这里面确实有很多值得学习和借鉴的地方，尤其是本地 agent CLI 的 runtime、tool loop、权限模型、session 管理、TUI 交互这些部分。

但因为法律和道德上的原因，我不打算直接公开那份源码。所以我基于自己对这份代码的理解，单独写了这个 `claude-code-lite`。它不是源码搬运，而是一个最小可用的参考实现，目前已经实现了：

- 可安装、可打包、可运行的 CLI 结构
- TUI、REPL、headless chat 三种交互入口
- 基于 provider 抽象的真实 LLM 接入
- 基本可用的 tool protocol 和 tool loop
- 文件、shell、web、agent 等本地工具能力
- transcript、session index、恢复、导出、清理等会话管理
- 最小权限确认和 session 内权限记忆
- Bun 编译的独立可执行文件入口

希望这个项目能作为一个足够小、但结构清楚的 AI 编程 agent CLI 样例，方便大家一起交流、学习和继续扩展。

## 项目目标

- 提供一个本地优先的 AI 编程 agent CLI 参考实现
- 把值得学习的 runtime 设计拆成尽量清楚的层次
- 让开发者可以在一个小代码库里理解 tool loop、permissions、session、TUI 这些关键问题

## Dependencies

This project requires:

**Runtime:**
- Node.js >= 18

**Development & Build:**
- Bun (for building and running tests)
- TypeScript compiler

**Installation:**
```bash
npm install
```

This will install all dependencies listed in `package.json`.

## 适合谁

- 想研究 AI 编程 agent CLI runtime 的开发者
- 想做自己的本地 agent / coding assistant 的开发者
- 想看一个比完整产品小得多、但比 toy demo 更完整的参考实现的人

## 当前范围

这个项目已经补到了“最小可用”的程度，但仍然刻意保持在参考实现的复杂度，不追求完整产品能力。

包含：
- session/turn runtime 的基本边界
- Tool 协议
- permission allow/deny/ask 模型
- transcript 存储接口
- subagent context clone 接口
- skills frontmatter 的最小接口
- 一个可安装 CLI，可直接调用本地工具
- 一个基于环境变量的 OpenAI-compatible LLM 接入层

不包含：
- 完整 MCP
- 完整 compact / background tasks / bridge
- 复杂 plugin / marketplace / remote orchestration

## 快速开始

### 本地开发

```bash
cd claude-code-lite
npm install
bun run build
node ./bin/claude-code-lite.js --help
```

### 全局安装

```bash
npm install -g .
claude-code-lite --help
```

### 独立可执行文件

```bash
bun run build:exe
./dist/claude-code-lite --help
```

说明：

- 这个产物不再依赖 Node.js
- 它会内嵌 Bun runtime
- 产物是平台相关的，需要分别为不同系统构建

## Quick Examples

```bash
# 启动 TUI
claude-code-lite

# 启动持久 REPL
claude-code-lite repl

# 直接对话
claude-code-lite chat "read README.md"

# 查看会话
claude-code-lite sessions --limit 10

# 检查最近会话
claude-code-lite inspect latest

# 导出会话
claude-code-lite export-session latest --format markdown --output /tmp/session.md

# 构建独立可执行文件
bun run build:exe
```

## 目录说明

```text
claude-code-lite/
  app/
  runtime/
  tools/
  permissions/
  skills/
  storage/
  shared/
```

建议你从这些文件开始补实现：

1. `tools/Tool.ts`
2. `runtime/query.ts`
3. `permissions/engine.ts`
4. `tools/agent/subagentContext.ts`
5. `storage/transcript.ts`

## 文档入口

如果你是来读 runtime 设计和后续演进建议的，建议按这个顺序：

1. [docs/architecture.md](./docs/architecture.md)
   先看整体分层、模块职责和架构图。
2. [docs/runtime-flow.md](./docs/runtime-flow.md)
   再看 prompt -> query -> tool -> session 的运行时流程。
3. [docs/core-interfaces.md](./docs/core-interfaces.md)
   然后看最关键的扩展接口：`query()`、`canUseTool()`、`SessionEngine`、`Tool`、`LlmProvider`。
4. [docs/next-steps.md](./docs/next-steps.md)
   最后看这个参考项目接下来最值得补的方向。
5. [docs/github-release-kit.md](./docs/github-release-kit.md)
   如果你准备发布 GitHub 仓库和首个 release，看这份素材。

## 打包与分发

### npm 包

在 `claude-code-lite/` 目录下执行：

```bash
npm pack
```

然后别人可以直接安装生成的 `.tgz` 包：

```bash
npm install -g claude-code-lite-0.1.0.tgz
claude-code-lite tools
```

### 独立可执行文件

如果你希望分发不依赖 Node.js 的单文件入口：

```bash
bun run build:exe
./dist/claude-code-lite --help
```

## 仓库文件

如果你准备把这个项目作为 GitHub 参考仓库维护，当前已经包含这些基础文件：

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [.github/ISSUE_TEMPLATE/bug_report.md](./.github/ISSUE_TEMPLATE/bug_report.md)
- [.github/ISSUE_TEMPLATE/feature_request.md](./.github/ISSUE_TEMPLATE/feature_request.md)
- [.github/ISSUE_TEMPLATE/provider_integration.md](./.github/ISSUE_TEMPLATE/provider_integration.md)
- [.github/ISSUE_TEMPLATE/tool_integration.md](./.github/ISSUE_TEMPLATE/tool_integration.md)
- [.github/PULL_REQUEST_TEMPLATE.md](./.github/PULL_REQUEST_TEMPLATE.md)

## 当前可用命令

可以直接运行源码版本：

```bash
bun claude-code-lite/app/main.ts read README.md
bun claude-code-lite/app/main.ts write tmp.txt "hello world"
bun claude-code-lite/app/main.ts edit tmp.txt "hello" "hi"
bun claude-code-lite/app/main.ts shell "pwd"
bun claude-code-lite/app/main.ts fetch https://example.com
bun claude-code-lite/app/main.ts agent "review" "inspect this change" reviewer
bun claude-code-lite/app/main.ts repl
```

也可以运行构建后的安装版：

```bash
claude-code-lite
claude-code-lite tui
claude-code-lite tools
claude-code-lite sessions
claude-code-lite sessions --status needs_attention
claude-code-lite sessions --limit 10
claude-code-lite inspect <session-id>
claude-code-lite export-session <session-id> --format markdown --output /tmp/session.md
claude-code-lite transcript <session-id>
claude-code-lite rm-session <session-id>
claude-code-lite cleanup-sessions --keep 20
claude-code-lite cleanup-sessions --status needs_attention --dry-run
claude-code-lite chat --resume-failed "继续刚才失败的任务"
claude-code-lite chat "read README.md"
claude-code-lite chat --resume latest "继续刚才的任务"
claude-code-lite read README.md
claude-code-lite shell "pwd"
```

默认权限模式会对修改类工具要求确认。可以用 `--yes` 自动批准：

```bash
claude-code-lite --yes write tmp.txt "hello world"
```

`chat` 现在支持 headless 流式 stdout：

```bash
claude-code-lite --stream chat "帮我阅读 README 并总结"
claude-code-lite --no-stream chat "帮我阅读 README 并总结"
claude-code-lite --stream chat --resume latest "根据刚才结果继续编辑"
claude-code-lite --stream chat --resume-failed "继续刚才失败的任务"
```

每次执行会把 transcript 写到：

```text
.claude-code-lite/transcripts/<session-id>.jsonl
```

同时会维护 session 元数据索引：

```text
.claude-code-lite/sessions/<session-id>.json
```

里面会记录：

- `createdAt / updatedAt`
- `title`
- `messageCount`
- `firstPrompt / lastPrompt`
- `provider / model`

`sessions` 和 `transcript` 现在会输出面向终端阅读的格式，不再直接打印原始 JSON。

其中 `sessions` 会额外显示：

- `status`
- `toolUseCount / errorCount`
- `lastTool`
- `lastError`

也支持基础筛选：

```bash
claude-code-lite sessions --status needs_attention
claude-code-lite sessions --limit 10
```

默认排序会优先把 `needs_attention` 会话排在前面，便于先处理异常会话。

`transcript` 还支持紧凑视图：

```bash
claude-code-lite transcript <session-id> --compact
```

现在还支持更完整的 session 管理：

```bash
claude-code-lite inspect <session-id>
claude-code-lite export-session <session-id> --format markdown --output /tmp/session.md
claude-code-lite rm-session <session-id>
claude-code-lite cleanup-sessions --keep 20
claude-code-lite cleanup-sessions --older-than 30
claude-code-lite cleanup-sessions --status needs_attention --dry-run
```

- `inspect` 会聚合元数据、最近消息和最近错误
- `export-session` 会把 metadata + transcript 导出为 markdown 或 json
- `rm-session` 会删除单个 session 的 metadata 和 transcript
- `cleanup-sessions` 会按保留数量或天数清理旧会话
- `cleanup-sessions --dry-run` 只预演将会删除哪些 session，不会真的删除
- `cleanup-sessions --status needs_attention` 可只针对异常会话做清理
- `rm-session` 和 `cleanup-sessions` 在交互终端里会再次确认；非交互场景下需要 `--yes`

## LLM 接入

当前 `chat` 和 TUI 都已经支持真实 LLM，但需要你显式提供环境变量。

最小配置：

```bash
export CCL_LLM_PROVIDER=openai
export CCL_LLM_API_KEY=your_api_key
export CCL_LLM_MODEL=gpt-4o-mini
```

可选配置：

```bash
export CCL_LLM_BASE_URL=https://api.openai.com/v1
export CCL_LLM_SYSTEM_PROMPT="You are a precise coding assistant."
export CCL_ANTHROPIC_VERSION=2023-06-01
```

说明：

- `CCL_LLM_PROVIDER=openai` 时，走 OpenAI-compatible `chat/completions`
- `CCL_LLM_PROVIDER=anthropic` 时，走 Anthropic `messages`
- provider 抽象已经独立，不再把协议写死在 OpenAI-compatible
- 未配置 LLM 时，系统会回退到本地 planner，只支持 `read/run/fetch/write/edit` 这类显式提示格式
- 已配置 LLM 但调用失败时，也会自动回退到本地 planner
- `openai` provider 支持真正的流式文本输出，TUI 会边生成边刷新
- `anthropic` provider 现在也支持 SSE streaming
- headless `chat` 支持 `--stream`/`--no-stream` 控制 stdout 是否流式输出

## 发布结构

这个包现在包含标准 CLI 发布形态：

- `package.json`
- `bin/claude-code-lite.js`
- `app/main.js`
- `npm pack` / `npm install -g .` 可用

其中：

- 构建依赖 Bun
- 运行依赖 Node 18+
- 安装后的终端命令名是 `claude-code-lite`

## TUI 交互

默认直接运行 `claude-code-lite` 会进入全屏 TUI。

当前 TUI 支持两类交互：

1. 自然语言触发本地动作
   - `read README.md`
   - `run pwd`
   - `fetch https://example.com`
   - `write notes.txt hello world`
   - `edit notes.txt hello => hi`

2. Slash 命令
   - `/help`
   - `/tools`
   - `/sessions [--limit N] [--status ready|needs_attention]`
   - `/inspect <session-id>`
   - `/export-session <session-id> [--format markdown|json] [--output path]`
   - `/transcript <session-id>`
   - `/rm-session <session-id>`
   - `/cleanup-sessions --keep N [--dry-run]`
   - `/filter <all|failed|tools>`
   - `/resume <session-id>`
   - `/resume latest`
   - `/resume failed`
   - `/new`
   - `/clear`
   - `/quit`

另外补了几项更接近 Claude Code CLI 的交互特征：

- 顶部显示 mode、session、busy、scroll 等运行状态
- 主体使用 `Conversation` / `Activity` 双栏布局
- `Activity` 区拆成 `Now Running` 和 `Recent Completed`
  `Now Running` 会显示 `phase / tool / detail / last`
  `phase` 对应 `idle / planning / approval / running / done / failed`
  `Recent Completed` 会显示序号、时间戳和耗时，并支持 `all / failed / tools` 过滤
- 长 `tool_result` 默认折叠，可用 `/expand [n|all]`、`/collapse [n|all]` 或 `Ctrl+E / Ctrl+G` 控制
- `Ctrl+F` 可循环切换右侧 timeline 过滤器
- `Up/Down/PageUp/PageDown` 可滚动消息区
- 权限确认会以弹窗覆盖层显示
- 可通过 `/resume latest` 或 `/resume failed` 快速恢复会话
- 也可以直接在 TUI 里执行 `/inspect`、`/export-session`、`/rm-session`、`/cleanup-sessions`

## REPL

`repl` 现在是持久会话模式，不再是每一行都新建一次执行上下文。

可用命令：

```bash
claude-code-lite repl
```

REPL 内支持：

- 连续多轮对话共用同一个 session
- assistant 文本流式输出
- 工具步骤输出为 `[tool:start] / [tool:done] / [tool:error]`
- `Ctrl+C` 中断当前 turn；空闲时退出 REPL
- `/new` 新建会话
- `/sessions` 查看已有会话
- `/sessions --status needs_attention` 只看异常会话
- `/sessions --limit 10` 只看最近 10 个会话
- `/inspect <sessionId>` 查看某个会话的详情
- `/export-session <sessionId>` 导出单个会话，便于归档或分享
- `/rm-session <sessionId>` 删除单个会话
- `/cleanup-sessions --keep N` 或 `--older-than DAYS` 清理旧会话
- `/cleanup-sessions --status needs_attention --dry-run` 预演异常会话清理
- `/resume latest`
- `/resume failed`
- `/resume <sessionId>`
- `/quit`

## 中断控制

当前 turn 级中断已经接到三种入口：

- TUI：处理中按 `Ctrl+C` 中断当前 turn；空闲时退出
- REPL：处理中按 `Ctrl+C` 中断当前 turn；空闲时退出
- Headless `chat`：运行中发 `SIGINT` 会中断当前 turn

## 会话内权限记忆

当工具需要确认时，现在支持“只允许这次”和“在本 session 内记住允许规则”两种模式。

- TUI：`y` 只允许这次，`a` 记住本 session，`n` 拒绝
- REPL：`[y] once / [a] session / [N]`
- Headless：`[y] once / [a] session / [N]`

当前记忆规则会按 `toolName + 目标模式` 记录在运行时 session 中，适用于：

- 文件路径
- shell 命令
- URL
- agent description

当前这套交互已经支持真实 LLM + tool loop；未配置或远端调用失败时，会自动回退到本地 planner。它的作用仍然是提供一个足够小、但结构上接近 Claude Code 风格的 agent CLI 起点。

## 推荐开发顺序

1. 先补 `Tool.ts` 和 `runtime/query.ts`
2. 再补 shell/read/edit 三个工具
3. 再补 permissions
4. 再补 transcript
5. 再补 subagent
