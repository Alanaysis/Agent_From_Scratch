# 自进化（Self-Evolving）能力设计计划

## 一、Hermes 式自进化的核心机制

Hermes Agent 的自进化闭环包含四个阶段：

```
Execute（执行）→ Evaluate（评估）→ Abstract（抽象）→ Refine（精炼）→ 回到 Execute
```

| 阶段 | 做什么 | 关键产出 |
|------|--------|---------|
| Execute | 使用工具完成任务 | 对话记录 + 工具调用轨迹 |
| Evaluate | 分析任务完成质量 | 显式反馈（用户确认）+ 隐式信号（是否追问、是否重试） |
| Abstract | 将成功经验转为 Skill 文档 | SKILL.md（Markdown 格式的可复用技能） |
| Refine | 后续使用中持续优化 Skill | 更精炼的 Skill + 更少的工具调用轮次 |

**核心洞察**：这不是简单的 RAG 检索，而是真正的技能进化——Agent 会自主重写行为模式，无需人工干预。

## 二、当前项目基础设施评估

### 已具备 ✅

| 基础设施 | 自演化价值 |
|---------|-----------|
| 完整对话持久化（transcript.ts） | 反思和学习的原始数据 |
| 会话元数据追踪（sessionIndex.ts） | 行为质量指标（errorCount、toolUseCount） |
| 定时任务框架（cron.ts） | 自动化自我检查和优化 |
| 技能动态注入（loader.ts + query.ts） | 通过 system prompt 动态改变行为 |
| 参数化技能（frontmatter.ts） | 可配置的行为模板 |
| 子 Agent 系统（agentTool.ts + runAgent.ts） | 可以用 Agent 来"反思"和"学习" |
| Team 系统（teamTool.ts + teamOrchestrator.ts） | 多 Agent 协作完成复杂演化任务 |
| 消息压缩（usage.ts） | 长对话的上下文管理 |

### 关键缺口 ❌

1. **无跨会话记忆**：AppState 纯内存，重启即丢失
2. **无运行时技能创建**：技能是静态 .md 文件，只能启动时加载
3. **无反馈闭环**：sessionIndex 的 errorCount/toolUseCount 从未被读取用于改进
4. **无反思机制**：Agent 无法回顾自己的 transcript 来提取经验
5. **Cron 未集成**：有完整 CRUD 但未接入主循环
6. **无版本管理**：技能没有版本号，无法追踪演化历史
7. **工具注册静态**：registry.ts 硬编码，无法动态注册

## 三、设计方案

### 总体架构：四模块闭环

```
┌──────────────────────────────────────────────────────────────┐
│                    Self-Evolution Engine                      │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐ │
│  │ Execute  │───→│ Evaluate │───→│ Abstract │───→│ Refine │ │
│  │ (执行)   │    │ (评估)   │    │ (抽象)   │    │ (精炼) │ │
│  └──────────┘    └──────────┘    └──────────┘    └────────┘ │
│       ↑                                              │       │
│       └──────────────────────────────────────────────┘       │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                   持久化层                                │ │
│  │  Knowledge.md  │  Skills/  │  Memory.md  │  Evolution/  │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 模块一：Knowledge Store（知识存储）

**目标**：建立跨会话的持久化知识库

新增 `storage/knowledge.ts`：

```typescript
type KnowledgeEntry = {
  id: string;
  category: "fact" | "preference" | "pattern" | "anti_pattern";
  content: string;
  source: "user_explicit" | "user_implicit" | "agent_reflection" | "skill_extraction";
  confidence: number;       // 0-1，信心度
  usageCount: number;       // 被引用次数
  lastUsed: string;         // ISO 时间戳
  createdAt: string;
  tags: string[];           // 可搜索标签
};

type KnowledgeStore = {
  entries: KnowledgeEntry[];
  version: number;
};
```

存储路径：`.irg/knowledge.json`

**关键设计**：
- 3575 字符上限（与 Hermes 一致），强制筛选真正重要的信息
- `anti_pattern` 类型专门记录"不要这样做"的经验
- `confidence` + `usageCount` 实现衰减机制：长期不用的知识自动降权
- 每次会话启动时自动加载到 system prompt

### 模块二：Skill Evolution（技能进化）

**目标**：让 Agent 能自动创建、修改、优化技能

#### 2.1 运行时技能管理

新增 `skills/skillManager.ts`：

```typescript
type EvolvableSkill = LoadedSkill & {
  version: number;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  successCount: number;
  failCount: number;
  lastUsed: string;
  parentSkillId?: string;   // 继承来源
  evolutionHistory: SkillEvolutionRecord[];
};

type SkillEvolutionRecord = {
  version: number;
  timestamp: string;
  changeType: "created" | "refined" | "patched" | "merged" | "deprecated";
  description: string;      // 改了什么
  trigger: "auto" | "user" | "cron";
  before?: string;          // 变更前的内容摘要
  after?: string;           // 变更后的内容摘要
};
```

关键 API：
- `createSkill(name, content, trigger)` — 运行时创建新技能
- `patchSkill(name, patch)` — 增量修改技能（非全量重写，更安全）
- `deprecateSkill(name, reason)` — 标记技能为过时
- `reloadSkills()` — 热重载技能目录
- `getSkillStats()` — 获取技能使用统计

#### 2.2 技能存储

新增目录 `.irg/skills/`（用户级技能，区别于 `skills/bundled/` 的内置技能）：

```
.irg/
  skills/
    code-review-expert.md      # Agent 自动创建的技能
    debug-patterns.md          # 从失败经验中提取的反模式
    project-conventions.md     # 项目特定的约定
```

加载优先级：用户技能 > 内置技能

### 模块三：Reflection Engine（反思引擎）

**目标**：让 Agent 能回顾自己的行为并提取经验

#### 3.1 反思触发器

```typescript
type ReflectionTrigger =
  | { type: "task_completed"; sessionInfo: SessionInfo }
  | { type: "task_failed"; sessionInfo: SessionInfo; error: string }
  | { type: "repeated_errors"; errorPattern: string; count: number }
  | { type: "cron_schedule"; schedule: string }
  | { type: "user_request"; prompt: string };
```

触发时机：
- 每次会话结束后（隐式反馈）
- 连续 3 次相同错误时（反模式检测）
- 用户显式请求（"反思一下你刚才的表现"）
- Cron 定时任务（夜间自我审查）

#### 3.2 反思 Agent

利用已有的 `runAgent()` 机制，创建一个专用的 `reflect` 类型 Agent：

```typescript
// 在 agentRegistry.ts 中新增
"reflect": {
  name: "reflect",
  description: "A reflection agent that analyzes past interactions and extracts insights",
  systemPrompt: [
    "You are a reflection agent. Your job is to analyze past interactions and extract actionable insights.",
    "For each interaction, identify:",
    "1. What went well (success patterns to reinforce)",
    "2. What went wrong (anti-patterns to avoid)",
    "3. What could be improved (optimization opportunities)",
    "4. Whether a new skill should be created or an existing one updated",
    "Output your findings in a structured format.",
  ],
  allowedTools: ["Read", "FileTree", "SearchFiles"],
  isReadOnly: true,
  maxTurns: 4,
},
```

#### 3.3 反思流程

```
会话结束
  │
  ▼
收集会话指标（errorCount, toolUseCount, status）
  │
  ▼
判断是否需要反思？
  ├── errorCount > 0 → 触发反思
  ├── toolUseCount > 10 → 触发反思（可能效率低）
  ├── 用户追问/重试 → 触发反思
  └── 否 → 跳过
  │
  ▼
启动 reflect Agent
  │
  ├── 分析 transcript 内容
  ├── 提取成功/失败模式
  ├── 生成 KnowledgeEntry
  └── 建议 Skill 创建/修改
  │
  ▼
写入 Knowledge Store + Skill 文件
```

### 模块四：Evolution Orchestrator（进化编排器）

**目标**：协调反思、学习、优化的完整闭环

新增 `runtime/evolution.ts`：

```typescript
type EvolutionConfig = {
  enabled: boolean;
  reflectionOnComplete: boolean;     // 任务完成后自动反思
  reflectionOnError: boolean;       // 出错时自动反思
  reflectionCronSchedule?: string;  // 定期反思的 cron 表达式
  maxKnowledgeEntries: number;      // 知识库上限（默认 100）
  knowledgeCharLimit: number;       // 单条知识字符上限（默认 500）
  skillAutoCreate: boolean;         // 允许自动创建技能
  skillAutoRefine: boolean;         // 允许自动优化技能
  skillRefineThreshold: number;     // 技能使用多少次后触发优化（默认 10）
};

type EvolutionState = {
  totalReflections: number;
  skillsCreated: number;
  skillsRefined: number;
  knowledgeEntries: number;
  lastReflectionAt?: string;
};
```

核心方法：
- `evolveAfterSession(sessionInfo, messages)` — 会话结束后的进化入口
- `evolveOnCron(schedule)` — 定时进化入口
- `evolveOnUserRequest(prompt)` — 用户触发的进化

## 四、自演化三定律（安全约束）

借鉴学术界的 Self-Evolving 三定律，作为硬约束：

| 定律 | 内容 | 实现方式 |
|------|------|---------|
| **Endure** | 任何修改不得破坏安全与稳定 | 新技能必须经过验证才能激活；知识写入需要 confidence 阈值；anti_pattern 优先级高于 pattern |
| **Excel** | 性能只能升不能降 | 技能优化后必须通过回归测试（对比优化前后的 toolUseCount 和 errorCount） |
| **Evolve** | 满足前两条时，必须能自主优化 | 反思引擎自动运行，技能自动创建和精炼 |

## 五、实现路径（4 个阶段）

### 阶段一：Knowledge Store + Memory.md（跨会话记忆）

**文件变更**：
- 新增 `storage/knowledge.ts` — 知识存储 CRUD
- 新增 `storage/memory.ts` — Memory.md 管理（常驻记忆，3575 字符上限）
- 修改 `runtime/query.ts` — 启动时加载 Knowledge + Memory 到 system prompt
- 修改 `runtime/session.ts` — 会话结束时触发知识提取

**核心逻辑**：
```
会话结束 → 扫描 messages → 提取用户偏好/项目事实 → 写入 Knowledge Store → 
压缩为 Memory.md（≤3575 字符）→ 下次启动时自动加载
```

### 阶段二：运行时技能管理（Skill CRUD）

**文件变更**：
- 新增 `skills/skillManager.ts` — 技能 CRUD + 版本管理
- 修改 `skills/loader.ts` — 支持从 `.irg/skills/` 加载用户技能
- 修改 `runtime/query.ts` — 技能热重载支持
- 新增 `tools/agent/reflectAgent.ts` — 反思 Agent 注册

**核心逻辑**：
```
reflect Agent 分析 transcript → 提取可复用模式 → 
调用 skillManager.createSkill() → 写入 .irg/skills/xxx.md → 
下次 detectRelevantSkills() 自动匹配
```

### 阶段三：反思引擎（Reflection Engine）

**文件变更**：
- 新增 `runtime/reflection.ts` — 反思触发器 + 反思流程
- 修改 `runtime/session.ts` — 会话结束时调用 reflection 引擎
- 修改 `runtime/evolution.ts` — 进化编排器
- 集成 Cron 系统

**核心逻辑**：
```
会话结束 → 评估指标 → 判断是否反思 → 
启动 reflect Agent → 分析 transcript → 
输出 {knowledge, skillSuggestions, antiPatterns} → 
写入 Knowledge Store + Skill 文件
```

### 阶段四：进化编排器（完整闭环）

**文件变更**：
- 新增 `runtime/evolution.ts` — 完整的进化编排器
- 修改 `storage/cron.ts` — 集成进化定时任务
- 新增 `runtime/evolutionConfig.ts` — 进化配置管理
- 新增 TUI 命令 `/evolve` — 手动触发进化

**核心逻辑**：
```
Cron 定时触发 → 读取所有 session 的 errorCount → 
识别高频错误模式 → 启动 reflect Agent 批量分析 → 
优化已有 Skill → 验证优化效果 → 更新 Skill 版本
```

## 六、关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 知识存储格式 | JSON 文件 | 简单可靠，无需额外依赖，与项目风格一致 |
| 技能存储格式 | Markdown + YAML frontmatter | 与现有技能系统完全兼容 |
| 反思实现方式 | 复用 runAgent() + reflect 类型 | 零新代码路径，利用已有的子 Agent 基础设施 |
| 记忆上限 | 3575 字符（与 Hermes 一致） | 强制筛选真正重要的信息，避免上下文膨胀 |
| 技能修改方式 | Patch（增量修改） | 比全量重写更安全、token 消耗更少 |
| 安全约束 | 三定律硬约束 | 防止自进化破坏系统稳定性 |
| 进化触发 | 混合（事件驱动 + 定时） | 兼顾实时性和深度分析 |

## 七、风险与注意事项

1. **Token 成本**：反思 Agent 每次运行都会消耗 token，需要限制反思频率
2. **知识噪声**：低质量知识会污染 system prompt，需要严格的 confidence 阈值
3. **技能冲突**：自动创建的技能可能与内置技能冲突，需要优先级机制
4. **安全边界**：反思 Agent 只能读取，不能修改文件（isReadOnly: true）
5. **递归防护**：反思 Agent 不能触发另一个反思（防止无限循环）
6. **冷启动**：新用户没有历史数据，进化系统需要足够的初始样本
