# Claude Code-lite Core Interfaces

[English](./core-interfaces.en.md)

这份文档专门解释当前版本最关键的 5 个接口：

- `query()`
- `canUseTool()`
- `SessionEngine`
- `Tool`
- `LlmProvider`

目标不是重复源码，而是回答：

1. 这个接口在 runtime 里负责什么
2. 它的输入输出是什么
3. 什么时候应该改它，什么时候不该改

## 1. 接口关系图

```mermaid
flowchart TD
    Shell[TUI / REPL / Headless] --> Query[query()]
    Query --> Provider[runLlmTurn / LlmProvider]
    Query --> Permission[canUseTool()]
    Query --> Tool[Tool.call()]
    Shell --> Session[SessionEngine]
    Query --> Session
```

## 2. `query()`

文件：

- [runtime/query.ts](../runtime/query.ts)

### 2.1 角色

`query()` 是单个 turn 的主入口。

它负责：

- 读取当前历史消息
- 决定走真实 LLM 还是 fallback planner
- 组装 tool definitions
- 接收 assistant 文本和 tool calls
- 执行 permission gate
- 执行工具
- 产出新的 `assistant` / `tool_result` 消息

### 2.2 当前签名

```ts
export type QueryParams = {
  prompt: string;
  messages: Message[];
  systemPrompt: string[];
  toolUseContext: ToolUseContext;
  canUseTool: CanUseToolFn;
  maxTurns?: number;
  onAssistantTextDelta?: (text: string) => void;
  onPermissionRequest?: (request: {
    toolName: string;
    input: unknown;
    message: string;
  }) => Promise<boolean>;
};
```

### 2.3 输入语义

- `prompt`
  当前用户输入
- `messages`
  当前会话历史
- `systemPrompt`
  额外系统提示词数组
- `toolUseContext`
  当前 turn 的工具执行上下文
- `canUseTool`
  权限决策函数
- `onAssistantTextDelta`
  流式文本增量回调
- `onPermissionRequest`
  交互层用来处理 `ask` 的入口

### 2.4 输出语义

`query()` 当前是一个异步生成器风格的消息流入口。

它产出的不是“最终答案对象”，而是一串 `Message`：

- `assistant`
- `tool_result`

这样做的好处是：

- TUI 可以边生成边渲染
- REPL 可以边打印边执行
- headless 可以做流式 stdout

### 2.5 什么时候改 `query()`

应该改它的场景：

- 你要引入新的 turn 状态
- 你要加 result budget
- 你要改 tool loop
- 你要加 subagent / MCP 入口

不应该随便改它的场景：

- 只是新增一个普通工具
- 只是改某个 provider 细节
- 只是改某个 session 展示行为

判断标准很简单：

如果改动影响“单轮执行状态机”，才应该进 `query()`。

## 3. `canUseTool()`

文件：

- [permissions/engine.ts](../permissions/engine.ts)

### 3.1 角色

`canUseTool()` 是统一权限决策入口。

它不负责 UI 提示，而负责给 runtime 返回三态之一：

- `allow`
- `deny`
- `ask`

### 3.2 当前签名

```ts
export const canUseTool: CanUseToolFn = async <Input>(
  tool: Tool<Input, unknown>,
  input: Input,
  context: ToolUseContext,
  parentMessage: AssistantMessage,
  toolUseId: string,
): Promise<PermissionDecision<Input>>
```

### 3.3 输入语义

- `tool`
  当前要执行的工具
- `input`
  工具输入
- `context`
  当前工具上下文，包含 session app state
- `parentMessage`
  发起这次 tool_use 的 assistant message
- `toolUseId`
  当前 tool call id

### 3.4 输出语义

返回：

```ts
type PermissionDecision<Input> =
  | { behavior: "allow"; updatedInput?: Input }
  | { behavior: "deny"; message: string }
  | { behavior: "ask"; message: string; updatedInput?: Input };
```

重点：

- runtime 只关心行为，不关心具体交互 UI
- 交互层收到 `ask` 后再决定怎么向用户确认

### 3.5 当前决策顺序

1. `validateInput`
2. permission mode bypass
3. deny rules
4. allow rules
5. ask rules
6. tool-specific `checkPermissions`
7. read-only 直接 allow
8. 默认 ask

### 3.6 什么时候改 `canUseTool()`

应该改它的场景：

- 你要改 session 记忆规则
- 你要引入 project-level policy
- 你要加 auto-approve / classifier / sandbox policy

不应该随便改它的场景：

- 只是想给某个单独工具加更严格校验

那种情况更应该改工具自己的 `validateInput` 或 `checkPermissions`。

## 4. `SessionEngine`

文件：

- [runtime/session.ts](../runtime/session.ts)

### 4.1 角色

`SessionEngine` 是会话状态和持久化之间的桥。

它负责：

- 维护内存里的 message history
- 把新消息 append 到 transcript
- 更新 session metadata index

### 4.2 当前签名

```ts
export class SessionEngine {
  get sessionId(): string
  get cwd(): string
  getMessages(): Message[]
  appendMessage(message: Message): void
  hydrateMessages(messages: Message[]): void
  recordMessages(messages: Message[]): Promise<void>
  getTranscriptPath(): string
  getUsage(): Usage
}
```

### 4.3 `recordMessages()` 的重要性

这是真正的核心方法。

它做了两件事：

1. `appendTranscript(...)`
2. `updateSessionInfo(...)`

也就是说：

- transcript 是原始历史
- session info 是可索引元数据

这两个写入在当前实现里是同步串行的。

### 4.4 什么时候改 `SessionEngine`

应该改它的场景：

- 你要换 transcript 格式
- 你要加 usage 持久化
- 你要做 checkpoint / snapshot
- 你要加 session-level locks

不应该随便改它的场景：

- 只是改 session 列表展示

那种情况通常应该改 `storage/sessionIndex.ts` 或 CLI formatter。

## 5. `Tool`

文件：

- [tools/Tool.ts](../tools/Tool.ts)

### 5.1 角色

`Tool` 是当前项目最重要的扩展边界之一。

它不是一个普通 handler，而是一个带语义的能力对象。

### 5.2 当前结构

```ts
export type Tool<Input, Output> = {
  name: string
  inputSchema: unknown
  outputSchema?: unknown

  description(input: Input, context: ToolDescribeContext): Promise<string>

  call(
    args: Input,
    context: ToolUseContext,
    canUseTool: CanUseToolFn,
    parentMessage: AssistantMessage,
    onProgress?: (progress: unknown) => void,
  ): Promise<ToolResult<Output>>

  isReadOnly(input: Input): boolean
  isConcurrencySafe(input: Input): boolean
  isDestructive?(input: Input): boolean

  validateInput?(input: Input, context: ToolUseContext): Promise<ValidationResult>
  checkPermissions?(input: Input, context: ToolUseContext): Promise<PermissionDecision<Input>>
  preparePermissionMatcher?(input: Input): Promise<(pattern: string) => boolean>
  toClassifierInput?(input: Input): unknown
}
```

### 5.3 为什么这个协议够用

这套设计已经覆盖了工具的 4 类核心问题：

1. 工具怎么描述给模型
2. 工具怎么真正执行
3. 工具是否安全
4. 工具是否只读 / 可并发

所以你后面要加新工具，通常只需要实现这个协议，不必动 query runtime。

### 5.4 什么时候改 `Tool` 协议

应该改它的场景：

- 你要引入统一 progress model
- 你要引入 result budget / artifact output
- 你要支持更复杂的 permission matcher

不应该轻易改它的场景：

- 只是新增一个普通工具字段

如果一个需求只影响某一个工具，不要先扩协议。

## 6. `LlmProvider`

文件：

- [runtime/llm.ts](../runtime/llm.ts)

### 6.1 角色

`LlmProvider` 把具体供应商 API 压成统一 turn 接口。

当前项目里它还是内部接口，但它已经是 provider abstraction 的核心。

### 6.2 当前内部结构

```ts
type LlmProvider = {
  runTurn(params: LlmTurnParams, config: LlmConfig): Promise<LlmTurnResponse>;
};
```

外围导出的核心类型是：

```ts
export type LlmConfig = {
  provider: LlmProviderName;
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt?: string;
  anthropicVersion?: string;
};

export type LlmTurnResponse = {
  text: string;
  toolCalls: Array<{
    id: string;
    name: string;
    input: unknown;
  }>;
};
```

### 6.3 当前 provider 层的职责

- 从 env 读取配置
- 把内部 `Message[]` 转成 provider 请求格式
- 发起 HTTP 请求
- 解析 SSE
- 把 provider 返回统一成 `LlmTurnResponse`

### 6.4 为什么 `LlmTurnResponse` 要尽量小

当前它只保留两类信息：

- `text`
- `toolCalls`

这是对的。

因为 `query()` 真正需要的也就这两类。如果把 provider-specific 细节往上漏，整个 runtime 很快会耦合死。

### 6.5 什么时候改 `LlmProvider`

应该改它的场景：

- 接新 provider
- 加 capability flags
- 统一 stream event model
- 加 JSON mode / response format

不应该改它的场景：

- 只是想让 TUI 多显示一点状态

那种改动应该停留在 interaction shell。

## 7. 最常见的扩展路径

如果你是二次开发者，最常见的三条改造路径是：

### 7.1 新增工具

改动点：

- `tools/` 下新增实现
- `tools/registry.ts` 注册

通常不需要改：

- `query()`
- `SessionEngine`
- provider 层

### 7.2 接新模型供应商

改动点：

- `runtime/llm.ts`

通常不需要改：

- TUI / REPL / headless
- `Tool` 协议
- `SessionEngine`

### 7.3 加更复杂的权限策略

改动点：

- `permissions/engine.ts`
- permission state / rule model

有时也会影响：

- TUI/REPL 的确认交互

## 8. 哪些接口现在最稳定

相对稳定：

- `Tool`
- `SessionEngine`
- `canUseTool()`

相对还会继续变：

- `query()`
- `LlmProvider`

原因：

前者已经具备“最小完整性”，后者还会随着 MCP、subagent、budget、error model 演进。

## 9. 推荐阅读顺序

如果你是准备直接改代码的人，建议按这个顺序读：

1. [tools/Tool.ts](../tools/Tool.ts)
2. [permissions/engine.ts](../permissions/engine.ts)
3. [runtime/session.ts](../runtime/session.ts)
4. [runtime/llm.ts](../runtime/llm.ts)
5. [runtime/query.ts](../runtime/query.ts)

原因：

先看边界，再看状态机。  
如果一上来先读 `query()`，很容易陷进流程细节，而忽略真正稳定的扩展接口。
