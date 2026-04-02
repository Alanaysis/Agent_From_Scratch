# Security Policy

[English](./SECURITY.en.md)

`claude-code-lite` 是一个本地优先的 AI agent CLI 参考实现。  
它具备文件读写、shell 执行、网页抓取和会话恢复能力，因此安全边界主要集中在：

- tool permission
- shell command execution
- transcript / session storage
- provider API key 管理

## 支持范围

当前安全修复优先覆盖：

- 主分支上的最新版本
- 当前 README 中明确列出的本地能力

不承诺覆盖：

- 你自己扩展的第三方工具
- 你接入的自定义 provider / 自定义 MCP server
- 你 fork 后新增的远程执行逻辑

## 报告方式

如果你发现的是安全问题，不要公开开 issue 贴细节复现。

建议最少说明：

- 问题类型
- 影响范围
- 触发条件
- 复现步骤
- 可能的影响

如果只是普通 bug，请走正常 bug report。

## 当前已知安全边界

### 1. 权限确认不是沙箱

当前 `allow / deny / ask` 是运行时权限模型，不是系统级沙箱。  
如果用户批准了高风险工具，工具仍然可以执行对应动作。

### 2. shell 能力默认具备高风险

`Shell` 工具本质上就是本地命令执行入口。  
当前实现已经有确认逻辑，但这并不等于完全安全。

### 3. transcript 会落盘

会话和工具结果会落到：

- `.claude-code-lite/transcripts/`
- `.claude-code-lite/sessions/`

如果工具结果里包含敏感内容，这些内容也可能被持久化。

### 4. provider key 由环境变量提供

当前默认通过环境变量注入：

- `CCL_LLM_API_KEY`

不要把这些变量写进仓库、截图、issue 或导出文件。

## 使用建议

- 对高风险工具保持 `ask`
- 不要在不可信目录里盲目运行 shell 动作
- 定期清理 `.claude-code-lite/`
- 导出 transcript 前先检查是否包含敏感内容
- 不要把真实 provider key 写进测试样例
