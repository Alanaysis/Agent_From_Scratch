# Contributing

[English](./CONTRIBUTING.en.md)

感谢你对 `claude-code-lite` 的关注。

这个项目的定位不是“完整产品”，而是：

- 本地优先的 AI 编程 agent CLI 参考实现
- 可读、可改、可扩展的最小 runtime
- 面向想研究 agent runtime / tool loop / TUI CLI 的开发者

## 贡献范围

欢迎的贡献方向：

- runtime 稳定性
- 文档完善
- provider 抽象改进
- tool 协议和工具实现
- session / transcript 管理
- 测试补充
- 最小 MCP / 最小 subagent

当前不建议直接推进的大方向：

- 完整 Claude Code 级 compact
- 大而全插件系统
- 复杂 remote / bridge 体系
- 重产品化但低可读性的功能堆叠

## 本地开发

```bash
cd claude-code-lite
npm install
bun run build
bun run typecheck
node ./bin/claude-code-lite.js --help
```

独立可执行文件构建：

```bash
bun run build:exe
./dist/claude-code-lite --help
```

## 提交前检查

至少跑这几条：

```bash
bun run build
bun run typecheck
node ./bin/claude-code-lite.js --help
node ./bin/claude-code-lite.js sessions
```

如果你改了会话导出、清理、恢复相关逻辑，建议再跑：

```bash
node ./bin/claude-code-lite.js inspect latest
node ./bin/claude-code-lite.js export-session latest --format markdown --output /tmp/session.md
node ./bin/claude-code-lite.js cleanup-sessions --status needs_attention --dry-run --older-than 0
```

## 代码风格

- 优先保持当前分层：`app / runtime / tools / permissions / storage`
- 不要把 CLI 展示逻辑塞进 runtime
- 不要把 provider 细节泄漏到 TUI / REPL
- 新能力优先落在稳定接口边界上
- 如果只是新增一个普通工具，尽量不要先扩 `Tool` 协议

## Pull Request 预期

一个好的 PR 最少要回答：

- 解决了什么问题
- 为什么改动应该落在这一层
- 是否影响 runtime / provider / tool 协议
- 如何手工验证

如果 PR 改动较大，建议同步更新：

- `README.md`
- `docs/architecture.md`
- `docs/runtime-flow.md`
- `docs/core-interfaces.md`

## Provider Key

不要在代码、测试、issue、PR 里提交真实 API key。

运行时需要的变量看：

- `CCL_LLM_PROVIDER`
- `CCL_LLM_API_KEY`
- `CCL_LLM_MODEL`
- `CCL_LLM_BASE_URL`
- `CCL_LLM_SYSTEM_PROMPT`
- `CCL_ANTHROPIC_VERSION`

## 讨论原则

如果一个改动会显著提高复杂度，请优先论证：

- 是否真的提高了参考价值
- 是否能维持当前可读性
- 是否可以先做更小的版本
