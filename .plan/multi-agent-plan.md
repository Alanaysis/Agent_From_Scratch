# 多 Agent 交互功能实现计划

## 一、现状分析

### 当前项目状态
本项目 `irg` 已有 Agent 实现的**骨架和扩展点**，但核心运行时尚未真正实现：

| 能力 | 状态 | 说明 |
|------|------|------|
| AgentTool 定义 | ✅ 已实现 | `Tool<AgentInput, AgentOutput>` 协议完整 |
| 子 Agent 上下文隔离 | ✅ 已实现 | `createSubagentContext()` 支持 agentId、agentType、messages、abortController 的独立/共享 |
| runAgent() | ❌ 桩函数 | 仅返回模拟文本，不调用 LLM |
| 并发调度 | ❌ 未实现 | 无并发执行器，工具串行执行 |
| Agent 间通信 | ❌ 未实现 | 仅通过 ToolResult 单向返回 |
| 结果压缩/合成 | ❌ 未实现 | 无上下文压缩机制 |
| Agent 注册表 | ❌ 未实现 | 无预定义 Agent 类型/角色 |
| Agent Teams | ❌ 未实现 | 无跨会话协作能力 |

### 关键文件
- [agentTool.ts](file:///home/siok/Agent_From_Scratch/tools/agent/agentTool.ts) — Agent 工具定义
- [runAgent.ts](file:///home/siok/Agent_From_Scratch/tools/agent/runAgent.ts) — 当前桩函数
- [subagentContext.ts](file:///home/siok/Agent_From_Scratch/tools/agent/subagentContext.ts) — 子 Agent 上下文创建
- [query.ts](file:///home/siok/Agent_From_Scratch/runtime/query.ts) — 核心查询循环
- [orchestration.ts](file:///home/siok/Agent_From_Scratch/tools/orchestration.ts) — 批量执行占位
- [Tool.ts](file:///home/siok/Agent_From_Scratch/tools/Tool.ts) — 工具协议定义

---

## 二、业界成熟实现方式研究

### 2.1 Claude Code 的三层架构（最直接的参考）

Claude Code 采用**分层多 Agent 架构**，这是当前最成熟的 CLI Agent 多交互实现：

**第一层：主对话（Main Session）**
- 用户直接交互的窗口
- 主 Agent 负责任务分解和调度

**第二层：Sub-agents（子智能体）**
- 由主对话按需创建的专家实例
- 每个子智能体有独立的 context window
- 预设的工具权限范围
- 完成任务后把结果返回给主对话
- **通信是单向的**：主对话分发任务 → 子智能体上报结果
- 子智能体之间不能直接通信
- **子智能体不能再创建子智能体**（防止递归爆炸）

**第三层：Agent Teams（团队模式）**
- Team Lead + Teammates 结构
- 成员之间可以双向通信
- 共享任务列表
- 适合需要协作推理的复杂场景

**内置 Subagent 类型**：
| 类型 | 模型 | 工具权限 | 用途 |
|------|------|---------|------|
| Explore | Haiku（快速） | 只读 | 文件发现、代码搜索 |
| Plan | 继承主对话 | 只读 | 规划研究 |
| General-purpose | 继承主对话 | 全部 | 复杂多步骤任务 |
| Bash | 继承 | Shell | 命令执行 |

**核心设计原则**：
1. **上下文隔离**：子 Agent 的工作细节不污染主 Agent 的上下文
2. **结果压缩**：子 Agent 只返回关键发现，不返回整个中间过程
3. **并发执行**：多个子 Agent 可并行工作
4. **权限继承+限制**：子 Agent 继承父级权限，但可进一步收窄
5. **防止递归**：子 Agent 不能创建新的子 Agent

### 2.2 六大编排模式（AWS Greg Coquillo）

| 模式 | 核心思想 | 适用场景 |
|------|---------|---------|
| 链式工作流 | 线性拆解，前一步输出→后一步输入 | 流程明确的标准化任务 |
| 路由式工作流 | 动态分类，分流到专属处理路径 | 入口多样但可分类 |
| 评估优化式 | 生成→评估→优化闭环 | 高质量输出要求 |
| 并行式 | 无依赖子任务并行执行 | 独立子模块、时效敏感 |
| 规划式 | 动态任务分解→资源匹配→执行监控 | 多步骤多角色协作 |
| 协作式 | 多角色 Agent 通过协议通信协作 | 需要多维度专业能力 |

### 2.3 主流框架对比

| 框架 | 哲学 | 核心抽象 | 适用场景 |
|------|------|---------|---------|
| LangGraph | 状态图 | StateGraph + Node + Edge | 复杂有状态工作流，精确控制 |
| CrewAI | 角色团队 | Agent + Crew + Task | 快速原型，直觉式定义 |
| AutoGen | 多 Agent 对话 | ConversableAgent + GroupChat | 需要协商推理的场景 |

### 2.4 九大最佳实践（arXiv:2512.08769）

1. **Tool Calls 优先于 MCP** — 优先使用直接工具调用
2. **直接函数调用优先于 Tool Calls** — 能用函数就不用工具协议
3. **避免给 Agent 过多工具** — 单一职责
4. **单一职责 Agent** — 一个 Agent 一个稳定职责
5. **外部化 Prompt 管理** — 运行时加载
6. **负责任 AI** — 安全对齐
7. **工作流与 MCP Server 分离** — 清晰边界
8. **容器化部署** — 可扩展
9. **KISS 原则** — 保持简单

---

## 三、推荐实现方案

基于项目现状和业界实践，推荐采用 **Claude Code 式分层架构**，分三个阶段渐进实现：

### 阶段一：最小 Subagent Runtime（核心突破）

**目标**：让 `runAgent()` 真正调用 LLM，实现主 Agent → 子 Agent 的任务委派

#### 1.1 实现 `runAgent()` 真实运行时

改造 [runAgent.ts](file:///home/siok/Agent_From_Scratch/tools/agent/runAgent.ts)：

```typescript
// 核心思路：子 Agent 拥有独立的 query() 循环
export async function runAgent(params: RunAgentParams): Promise<string> {
  const subagentContext = createSubagentContext(params.parentContext, {
    agentType: params.subagentType,
  });

  // 构建子 Agent 的独立消息历史
  const messages: Message[] = [
    { id: createId("user"), type: "user", content: params.prompt }
  ];

  // 子 Agent 运行自己的 query 循环
  const resultMessages: Message[] = [];
  for await (const message of query({
    prompt: params.prompt,
    messages,
    systemPrompt: buildSubagentSystemPrompt(params.subagentType),
    toolUseContext: subagentContext,
    canUseTool: params.canUseTool,
    maxTurns: params.maxTurns ?? 8,
  })) {
    resultMessages.push(message);
  }

  // 结果压缩：只返回最终文本结果
  return compressSubagentResult(resultMessages);
}
```

关键设计决策：
- 子 Agent 复用 `query()` 函数，拥有独立的 LLM 循环
- 子 Agent 的消息历史独立于父 Agent
- 子 Agent 完成后，只返回压缩后的结果文本给父 Agent
- **子 Agent 不能再创建子 Agent**（通过 system prompt 约束 + 工具列表过滤）

#### 1.2 Agent 注册表

新增 [tools/agent/registry.ts](file:///home/siok/Agent_From_Scratch/tools/agent/registry.ts)：

```typescript
export type AgentDefinition = {
  name: string;
  description: string;
  systemPrompt: string[];
  allowedTools: string[] | "*";   // 允许使用的工具列表，"*" 表示全部
  model?: string;                  // 可指定不同模型
  maxTurns?: number;
  isReadOnly?: boolean;
};

export const BUILTIN_AGENTS: Record<string, AgentDefinition> = {
  "general-purpose": {
    name: "general-purpose",
    description: "A general-purpose agent for complex multi-step tasks",
    systemPrompt: ["You are a sub-agent..."],
    allowedTools: "*",
  },
  "explore": {
    name: "explore",
    description: "A fast, read-only agent for searching and analyzing codebases",
    systemPrompt: ["You are an exploration agent..."],
    allowedTools: ["Read", "FileTree", "SearchFiles", "WebFetch", "WebSearch"],
    isReadOnly: true,
  },
  "plan": {
    name: "plan",
    description: "A research agent for gathering context during planning",
    systemPrompt: ["You are a planning research agent..."],
    allowedTools: ["Read", "FileTree", "SearchFiles"],
    isReadOnly: true,
  },
};
```

#### 1.3 工具过滤机制

在子 Agent 的 `query()` 调用中，根据 Agent 定义过滤可用工具：

```typescript
function getFilteredTools(agentDef: AgentDefinition): Tools {
  const allTools = getTools();
  if (agentDef.allowedTools === "*") {
    // 排除 Agent 工具自身，防止递归
    return allTools.filter(t => t.name !== "Agent");
  }
  return allTools.filter(t => agentDef.allowedTools.includes(t.name));
}
```

#### 1.4 结果压缩

新增 [tools/agent/resultCompressor.ts](file:///home/siok/Agent_From_Scratch/tools/agent/resultCompressor.ts)：

```typescript
export function compressSubagentResult(messages: Message[]): string {
  // 提取最终的 assistant 文本作为结果
  // 过滤掉中间的工具调用细节
  // 保留关键发现和结论
  const assistantTexts = messages
    .filter(m => m.type === "assistant")
    .flatMap(m => m.content)
    .filter(b => b.type === "text")
    .map(b => b.text);

  return assistantTexts.join("\n") || "Subagent completed with no text output.";
}
```

### 阶段二：并发执行与调度

**目标**：支持多个子 Agent 并行执行，提升效率

#### 2.1 并发执行器

改造 [orchestration.ts](file:///home/siok/Agent_From_Scratch/tools/orchestration.ts)：

```typescript
export async function* runToolsConcurrently(
  toolUses: ToolUseBlock[],
  assistantMessages: AssistantMessage[],
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
  maxConcurrency: number = 3,
): AsyncGenerator<Message, void> {
  // 使用 Promise + semaphore 模式
  // 并发安全的工具可以并行执行
  // 非并发安全的工具串行执行
  const safe = toolUses.filter(tu => {
    const tool = findToolByName(getTools(), tu.name);
    return tool?.isConcurrencySafe(tu.input) ?? false;
  });
  const unsafe = toolUses.filter(tu => !safe.includes(tu));

  // 并发执行安全工具
  const safeResults = await Promise.all(
    safe.map(tu => executeSingleTool(tu, ...))
  );

  // 串行执行非安全工具
  for (const tu of unsafe) {
    yield* executeSingleTool(tu, ...);
  }
}
```

#### 2.2 修改 queryWithLlm 支持并发

在 [query.ts](file:///home/siok/Agent_From_Scratch/runtime/query.ts) 的 `queryWithLlm()` 中：

```typescript
// 当前：串行执行所有 tool calls
for (const toolCall of toolCalls) {
  for await (const message of executeToolCall(...)) { ... }
}

// 改为：并发执行并发安全的 tool calls
const { concurrent, sequential } = partitionByConcurrency(toolCalls);
const concurrentResults = await Promise.all(
  concurrent.map(tc => collectAsyncGen(executeToolCall(..., tc)))
);
for (const msg of concurrentResults.flat()) { yield msg; }
for (const tc of sequential) {
  for await (const msg of executeToolCall(..., tc)) { yield msg; }
}
```

### 阶段三：Agent Teams（协作模式）

**目标**：支持跨 Agent 双向通信和协作推理

#### 3.1 Team 定义

新增 [tools/agent/team.ts](file:///home/siok/Agent_From_Scratch/tools/agent/team.ts)：

```typescript
export type TeamDefinition = {
  name: string;
  description: string;
  lead: AgentDefinition;
  members: AgentDefinition[];
  sharedState: Record<string, unknown>;  // 共享状态
  taskQueue: TaskItem[];                  // 共享任务队列
};

export type TaskItem = {
  id: string;
  description: string;
  assignee?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: string;
};
```

#### 3.2 Team 通信协议

```typescript
export type TeamMessage = {
  from: string;        // 发送者 agentId
  to: string | "all";  // 接收者
  type: "task_request" | "task_result" | "question" | "answer" | "status_update";
  content: string;
  timestamp: number;
};
```

#### 3.3 Team 编排器

```typescript
export class TeamOrchestrator {
  private messageBus: TeamMessage[] = [];
  private sharedState: Map<string, unknown>;

  async run(team: TeamDefinition, task: string): Promise<string> {
    // 1. Lead Agent 分解任务
    // 2. 分配子任务到成员
    // 3. 成员通过 messageBus 通信
    // 4. Lead Agent 汇总结果
  }
}
```

---

## 四、实现优先级与依赖关系

```
阶段一（最小 Subagent Runtime）
  ├── 1.1 runAgent() 真实实现     ← 最高优先级，核心突破
  ├── 1.2 Agent 注册表            ← 1.1 的前置
  ├── 1.3 工具过滤机制            ← 1.2 的前置
  └── 1.4 结果压缩               ← 1.1 的配套

阶段二（并发执行）
  ├── 2.1 并发执行器              ← 依赖阶段一完成
  └── 2.2 queryWithLlm 并发改造   ← 2.1 的前置

阶段三（Agent Teams）
  ├── 3.1 Team 定义               ← 依赖阶段二完成
  ├── 3.2 通信协议                ← 3.1 的配套
  └── 3.3 Team 编排器             ← 3.1 + 3.2 的前置
```

**建议实施顺序**：先完成阶段一，验证核心路径后再推进阶段二和三。

---

## 五、关键设计决策总结

| 决策点 | 推荐方案 | 理由 |
|--------|---------|------|
| 架构风格 | Claude Code 式分层架构 | 与项目现有结构最契合，渐进式扩展 |
| 子 Agent 通信 | 单向（子→父返回结果） | 简单可靠，避免通信复杂度爆炸 |
| 递归防护 | 工具列表过滤 + system prompt 约束 | 双重保险，防止 Agent 无限嵌套 |
| 并发策略 | 并发安全工具并行 + 非安全工具串行 | 兼顾效率和安全 |
| 结果传递 | 压缩后的文本摘要 | 避免子 Agent 上下文污染父 Agent |
| Agent 定义 | 注册表 + YAML frontmatter | 与现有 Skills 系统一致 |
| Teams 通信 | MessageBus 模式 | 解耦发送者和接收者，支持广播 |

---

## 六、风险与注意事项

1. **Token 成本**：多 Agent 并发时 token 消耗线性增长，需要预算控制
2. **递归深度**：必须严格限制子 Agent 不能再创建子 Agent
3. **权限传播**：子 Agent 的权限应 ≤ 父 Agent（只收窄不放宽）
4. **错误隔离**：子 Agent 的错误不应导致父 Agent 崩溃
5. **上下文窗口**：子 Agent 的上下文需要独立管理，避免溢出
6. **并发安全**：文件写入等操作不能并发执行，需要串行化
