# Claude Code-lite 下一步优化建议

[English](./next-steps.en.md)

这份文档面向准备把 `claude-code-lite` 发布到 GitHub、并作为 AI 编程 agent 参考项目的维护者。

当前版本已经具备发布基础：

- 可安装、可打包、可运行
- 支持 TUI、REPL、headless chat
- 支持 OpenAI-compatible / Anthropic provider
- 支持流式输出、tool loop、session 恢复、导出、清理
- 具备最小权限确认和 session 级权限记忆

但如果目标是“给别人拿来学、拿来改、拿来扩展”，下一步建议按下面顺序推进。

## 1. 第一优先级：把参考价值做扎实

### 1.1 补架构文档

当前已补：

- `claude-code-lite/docs/architecture.md`
- `claude-code-lite/docs/runtime-flow.md`

这些文档已经覆盖：

- Mermaid 总体架构图
- query/tool/session 时序图
- TUI/REPL/headless 三入口关系图
- Tool 协议、Permission、Session、LLM provider 的职责说明

### 1.2 补核心接口说明

建议把这些接口单独写进文档：

- `query()`
- `canUseTool()`
- `SessionEngine`
- `Tool` 协议
- `LlmProvider`

原因：

别人通常不是照搬 UI，而是会改 runtime 和 tool system。把这些接口讲清楚，参考价值会明显提高。

当前已补：

- `claude-code-lite/docs/core-interfaces.md`

## 2. 第二优先级：把运行时做稳

### 2.1 统一错误模型

当前错误来源较散：

- LLM 请求失败
- tool 执行失败
- permission deny
- interrupt
- transcript/session IO 错误

建议新增统一错误类型层，例如：

- `AgentError`
- `ToolExecutionError`
- `PermissionDeniedError`
- `SessionStorageError`
- `InterruptedError`

原因：

现在 CLI 已经可用，但错误分类还不够结构化。后面做 TUI 状态、导出、遥测、失败恢复时，统一错误模型会省很多力气。

### 2.2 给 tool result 做预算控制

虽然现在 export/transcript 已经做了裁剪，但 runtime 内部还缺一层真正的 result budget。

建议：

- 对 `tool_result` 设置最大长度
- 超出预算时写入磁盘文件
- 回给模型的是摘要 + 文件路径

原因：

这一步是从“demo agent”走向“长期运行 agent”的关键。否则大文件、大网页、大命令输出会持续污染上下文。

### 2.3 把 interrupt 再做细

当前已经支持 turn 级中断，但还可以更细：

- 区分 `cancel current LLM request`
- 区分 `cancel active tool`
- 区分 `cancel whole turn`

原因：

如果后面接更多 MCP、browser、background task，没有更细粒度中断会开始难用。

## 3. 第三优先级：把扩展能力做出来

### 3.1 真正的 provider interface 稳定化

当前 provider 抽象已经有了，但还可以再往接口化推进：

- 统一 request/response model
- 统一 stream event model
- 统一 tool call block model
- provider capability flags

例如：

- `supportsStreaming`
- `supportsToolCalling`
- `supportsSystemPrompt`
- `supportsJsonMode`

原因：

这会让别人更容易接第三方 provider，而不需要理解每家 API 细节。

### 3.2 补 MCP 最小版本

当前作为参考项目，最值得补的不是完整 MCP，而是最小版本：

- 连接本地 stdio MCP server
- 列出 tools
- 调用一个工具

原因：

对于想做 agent 的开发者，MCP 是一个极高价值的扩展点。哪怕只做最小能力，也能让这个仓库的参考价值提升一截。

### 3.3 把 AgentTool 从占位实现推到真正 subagent

建议最小范围：

- 子 session
- 子 transcript
- 限定 allowed tools
- 同步返回

先不要急着做：

- worktree
- background tasks
- remote executor

原因：

对参考项目来说，“最小可解释 subagent” 比“复杂但半成品的 subagent”更有价值。

## 4. 第四优先级：把 GitHub 对外体验做好

### 4.1 增加仓库级文档

建议新增：

- `CONTRIBUTING.md`
- `SECURITY.md`
- `CHANGELOG.md`

最少要回答：

- 怎么跑本地开发
- 怎么提 PR
- 哪些功能是 roadmap，哪些不打算做
- 如何处理 provider key

### 4.2 增加 issue / PR 模板

建议加：

- bug report
- feature request
- provider integration request
- tool integration request

原因：

如果你公开这个项目，最先收到的问题通常不是“架构讨论”，而是“这个为什么不能用”。模板能把噪音压下去。

### 4.3 加一个最小 demo GIF 或截图

建议展示：

- 启动 TUI
- 发一条 prompt
- 执行一个 tool
- 查看 transcript / inspect

原因：

对于参考项目，别人往往先看视觉反馈，再决定是否继续读源码。

## 5. 第五优先级：把可测试性补起来

当前最值得加的不是大而全的测试，而是三类高价值测试：

### 5.1 解析和命令测试

覆盖：

- `parseChatCommandOptions`
- `parseSessionsCommandOptions`
- `parseCleanupCommandOptions`
- `parseExportCommandOptions`

### 5.2 session metadata 测试

覆盖：

- title/summary 生成
- status/toolUseCount/errorCount 计算
- transcript 回填 metadata

### 5.3 provider adapter 测试

覆盖：

- OpenAI SSE 解析
- Anthropic SSE 解析
- tool call block 解析

原因：

这些测试投入小，但能显著降低后续重构风险。

## 6. 建议的发布节奏

如果你准备发 GitHub，我建议按这个节奏：

### v0.1.0

定位：

- 参考项目
- 最小可用 agent CLI
- 架构学习样例

对外描述重点：

- TUI + REPL + headless
- provider abstraction
- tool protocol
- session/transcript management

### v0.2.0

目标：

- 补架构文档
- 稳定错误模型
- 补基础测试
- 优化 session 观察面

### v0.3.0

目标：

- 最小 MCP
- 最小 subagent
- tool result budget

## 7. 不建议现在就做的事

这些方向以后可以做，但不建议作为当前公开版本的阻塞项：

- 完整 Claude Code 级 compact
- 多层 background task 系统
- remote bridge / IDE bridge
- 复杂权限 classifier
- 完整 plugin/skill marketplace

原因：

这些东西工程量大，而且会迅速把项目从“高可读参考实现”推向“高复杂产品雏形”。对 GitHub 参考项目来说，这不是当前最优解。

## 8. 推荐你发布时怎么定位这个仓库

最合适的定位不是：

- “Claude Code 开源替代品”

更合适的定位是：

- “A minimal AI coding agent CLI runtime for learning and extension”
- “A reference implementation of a local-first coding agent CLI”
- “A small, hackable runtime inspired by Claude Code”

这样定位更稳，也更利于吸引真正想研究 agent runtime 的开发者。

## 9. 当前版本的发布前检查清单

- `bun run build`
- `bun run typecheck`
- `npm pack --dry-run`
- `node ./bin/claude-code-lite.js --help`
- `node ./bin/claude-code-lite.js sessions`
- `node ./bin/claude-code-lite.js inspect latest`
- `node ./bin/claude-code-lite.js export-session latest --format markdown --output /tmp/session.md`

如果这些都通过，这个版本就已经足够作为 GitHub 参考项目发布。

## 10. 关于独立可执行文件

当前默认发布形态仍然是：

- `npm install -g .`
- `node ./bin/claude-code-lite.js`

如果你希望像 Claude Code CLI 那样提供“单文件可执行入口”，当前项目可以直接使用 Bun 的 `--compile`：

```bash
bun build --compile --outfile ./dist/claude-code-lite ./app/main.ts
```

这类产物的特点：

- 不再依赖 Node.js
- 但会内嵌 Bun runtime
- 产物是平台相关的，需要分别为 macOS / Linux / Windows 构建

这非常适合给 GitHub Releases 放预编译二进制。
