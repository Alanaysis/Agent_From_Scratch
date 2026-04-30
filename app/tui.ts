import readline from "readline";
import { electron, stdin as input, stdout as output } from "process";
import { executeCliCommand, formatHelp } from "./headless";
import { tokenizeCommandLine } from "../shared/cli";
import { createInitialAppState, type AppState } from "../runtime/state";
import { SessionEngine } from "../runtime/session";
import { canUseTool, rememberPermissionRule } from "../permissions/engine";
import { query, executeToolCall, executeWorkMap, type QueryParams } from "../runtime/query";
import { createId } from "../shared/ids";
import type { Message, AssistantMessage, AssistantToolUseBlock } from "../runtime/messages";
import { getTools } from "../tools/registry";
import { findToolByName, type ToolUseContext } from "../tools/Tool";
import { listSessions } from "../storage/sessionIndex";
import { readTranscriptMessages } from "../storage/transcript";
import pc from "picocolors";
import isDark from "is-dark";
import { loadSkills, getLoadedSkills, detectRelevantSkills, type LoadedSkill } from "../skills/loader";
import type { ParamConfig } from "../skills/frontmatter";
import {
  parseSkillToWorkMap,
  WorkMapExecutor,
  type WorkMap,
  type WorkMapStep as WorkMapStepType,
  type WorkMapPhase,
} from "../runtime/workmap";

export type TuiOptions = {
  cwd: string;
  autoApprove?: boolean;
};

// 命令帮助信息列表，移到顶层以便在autoCompleteSlashCommand函数中访问
let helpMessagesAll = [
  "  /help",
  "  /tools",
  "  /skills",
  "  /workmap",
  "  /sessions",
  "  /inspect <id>",
  "  /export-session <id>",
  "  /rm-session <id>",
  "  /cleanup-sessions --keep N [--dry-run]",
  "  /expand [n|all]",
  "  /collapse [n|all]",
  "  /filter [all|failed|tools]",
  "  /resume latest|failed",
  "  /new",
  "  /clear",
  "  /quit",
];

// 全局存储的技能列表，用于补全
let loadedSkillsForCompletion: LoadedSkill[] = [];

type EntryKind = "user" | "assistant" | "tool" | "result" | "system" | "error";

type ConversationEntry = {
  kind: EntryKind;
  text: string;
  collapsible?: boolean;
  expanded?: boolean;
  collapseKey?: number;
  summary?: string;
};

type SpecModalState = {
  title: string;
  skillId: string;
  params: ParamConfig[];
  currentParamIndex: number;
  currentValue: string;
  collectedValues: Record<string, any>;
  phase: "collecting" | "confirming";
  resolve: (spec: Record<string, any>) => void;
};

type ModalState = {
  title: string;
  message: string;
  toolName?: string;
  inputValue?: unknown;
  resolve: (decision: "allow-once" | "allow-session" | "deny") => void;
} | SpecModalState;

type RuntimeState = {
  session: SessionEngine;
  toolContext: ToolUseContext;
};

type ActivityCard = {
  phase: "idle" | "planning" | "approval" | "running" | "done" | "failed";
  toolName?: string;
  detail?: string;
  lastResult?: string;
};

type ActivityStep = {
  seq: number;
  at: string;
  durationMs?: number;
  label: string;
  summary: string;
  kind: "tool" | "permission" | "prompt" | "session" | "error";
  status: "info" | "done" | "failed";
};

type TimelineFilter = "all" | "failed" | "tools";

interface SlashCommand {
  name: string;
  description: string;
  example: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { name: "help", description: "显示帮助信息", example: "/help" },
  { name: "tools", description: "显示可用工具", example: "/tools" },
  { name: "skills", description: "显示已加载的技能", example: "/skills" },
  { name: "workmap", description: "WorkMap 工作图管理", example: "/workmap [load|pause|resume|reset|clear] [skillName]" },
  { name: "sessions", description: "显示会话列表", example: "/sessions" },
  { name: "inspect", description: "检查会话详情", example: "/inspect <id>" },
  { name: "export-session", description: "导出会话记录", example: "/export-session <id> [--format markdown|json] [--output path]" },
  { name: "rm-session", description: "删除会话", example: "/rm-session <id>" },
  { name: "cleanup-sessions", description: "清理旧会话", example: "/cleanup-sessions --keep N | --older-than DAYS [--status ...] [--dry-run]" },
  { name: "expand", description: "展开结果块", example: "/expand [n|all]" },
  { name: "collapse", description: "折叠结果块", example: "/collapse [n|all]" },
  { name: "filter", description: "筛选显示", example: "/filter [all|failed|tools]" },
  { name: "resume", description: "恢复会话", example: "/resume [id|latest|failed]" },
  { name: "new", description: "创建新会话", example: "/new" },
  { name: "clear", description: "清空当前会话", example: "/clear" },
  { name: "quit", description: "退出 TUI", example: "/quit" },
  { name: "exit", description: "退出 TUI", example: "/exit" },
];

type TuiState = {
  entries: ConversationEntry[];
  streamingAssistantText: string;
  inputBuffer: string;
  status: string;
  busy: boolean;
  modal: ModalState | null;
  scrollOffset: number;
  toolSteps: ActivityStep[];
  currentActivity: ActivityCard | null;
  currentSessionId: string;
  activityStartedAt: number | null;
  nextCollapseKey: number;
  nextStepSeq: number;
  timelineFilter: TimelineFilter;
  isSearching: boolean;
  searchMatches: string[];
  selectedMatchIndex: number;
  theme: "light" | "dark";
  history: string[];
  historyIndex: number;
  workMap: WorkMap | null;
  workMapExecutor: WorkMapExecutor | null;
  selectedWorkMapStep: string | null;  // 当前选中的步骤ID
  cursorPosition: number;
};

function getPermissionMode(
  state: TuiState,
  runtimeRef: { current: RuntimeState },
): string {
  return runtimeRef.current.toolContext.getAppState().permissionContext.mode;
}

function wrapText(text: string, width: number): string[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const rawLines = normalized.split("\n");
  const wrapped: string[] = [];

  for (const rawLine of rawLines) {
    if (!rawLine) {
      wrapped.push("");
      continue;
    }

    let line = rawLine;
    while (line.length > width) {
      // 尝试在单词边界处换行
      let splitIndex = width;
      if (line.charAt(width) !== ' ' && width > 0) {
        // 查找最近的空格
        const spaceIndex = line.lastIndexOf(' ', width);
        if (spaceIndex > 0) {
          splitIndex = spaceIndex;
        }
      }
      wrapped.push(line.slice(0, splitIndex).trimEnd());
      line = line.slice(splitIndex).trimStart();

      // 如果找不到空格或行的剩余部分仍然太长，强制截断
      if (line.length > width && line.indexOf(' ') === -1) {
        wrapped.push(line.slice(0, width));
        line = line.slice(width);
      }
    }
    if (line) {
      wrapped.push(line);
    }
  }

  return wrapped;
}

function trimText(text: string, width: number): string {
  const plain = text.replace(/\x1b\[[0-9;]*m/g, "");
  if (plain.length <= width) {
    return text + " ".repeat(Math.max(0, width - plain.length));
  }
  return `${plain.slice(0, Math.max(0, width - 1))}…`;
}

function trimTextPlain(text: string, width: number): string {
  if (text.length <= width) {
    return text.padEnd(width, " ");
  }
  return `${text.slice(0, Math.max(0, width - 1))}…`;
}



function formatUnknown(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function summarizeText(text: string, maxLength = 48): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized || "(empty)";
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function shouldCollapse(text: string): boolean {
  return text.includes("\n") || text.length > 160;
}

function makeConversationEntries(
  state: TuiState,
  message: Message,
): ConversationEntry[] {
  if (message.type === "user") {
    return [{ kind: "user", text: message.content }];
  }

  if (message.type === "tool_result") {
    const text = formatUnknown(message.content);
    const collapsible = shouldCollapse(text);
    return [
      {
        kind: message.isError ? "error" : "result",
        text,
        collapsible,
        expanded: !collapsible,
        collapseKey: collapsible ? state.nextCollapseKey++ : undefined,
        summary: collapsible ? summarizeText(text) : undefined,
      },
    ];
  }

  return message.content.map((block) => {
    if (block.type === "text") {
      return { kind: "assistant" as const, text: block.text };
    }

    return {
      kind: "tool" as const,
      text: `${block.name} ${formatUnknown(block.input)}`,
    };
  });
}

function createRuntime(
  cwd: string,
  appStateRef: { current: AppState },
  sessionId?: string,
): RuntimeState {
  const session = new SessionEngine({
    id: sessionId ?? createId("session"),
    cwd,
  });
  const toolContext: ToolUseContext = {
    cwd,
    abortController: new AbortController(),
    messages: session.getMessages(),
    getAppState: () => appStateRef.current,
    setAppState: (updater) => {
      appStateRef.current = updater(appStateRef.current);
    },
    agentId: createId("agent"),
  };
  return { session, toolContext };
}

function addToolStep(state: TuiState, step: string): void {
  state.toolSteps.push({
    seq: state.nextStepSeq++,
    at: new Date().toTimeString().slice(0, 8),
    label: step,
    summary: summarizeText(step, 28),
    kind: "session",
    status: "info",
  });
  state.toolSteps = state.toolSteps.slice(-12);
}

function setCurrentActivity(
  state: TuiState,
  activity: ActivityCard | null,
): void {
  state.currentActivity = activity;
}

function addActivityStep(
  state: TuiState,
  label: string,
  kind: ActivityStep["kind"],
  status: ActivityStep["status"],
  durationMs?: number,
): void {
  state.toolSteps.push({
    seq: state.nextStepSeq++,
    at: new Date().toTimeString().slice(0, 8),
    durationMs,
    label,
    summary: summarizeText(label, 28),
    kind,
    status,
  });
  state.toolSteps = state.toolSteps.slice(-12);
}

function colorize(text: string, color: string): string {
  return `${color}${text}\x1b[0m`;
}

function getPhaseBadge(card: ActivityCard | null): string {
  const phase = card?.phase ?? "idle";
  switch (phase) {
    case "idle":
      return colorize("○ idle", "\x1b[90m");
    case "planning":
      return colorize("◌ planning", "\x1b[36m");
    case "approval":
      return colorize("◆ approval", "\x1b[33m");
    case "running":
      return colorize("▶ running", "\x1b[34m");
    case "done":
      return colorize("✓ done", "\x1b[32m");
    case "failed":
      return colorize("✕ failed", "\x1b[31m");
  }
}

function formatDuration(durationMs?: number): string {
  if (durationMs === undefined) {
    return "-";
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function formatStep(step: ActivityStep): string {
  const icon =
    step.status === "done"
      ? colorize("✓", "\x1b[32m")
      : step.status === "failed"
        ? colorize("✕", "\x1b[31m")
        : colorize("•", "\x1b[36m");
  const duration =
    step.durationMs !== undefined ? ` ${formatDuration(step.durationMs)}` : "";
  return `${icon} #${step.seq} ${step.at}${duration} ${step.summary}`;
}

function cycleTimelineFilter(filter: TimelineFilter): TimelineFilter {
  switch (filter) {
    case "all":
      return "failed";
    case "failed":
      return "tools";
    case "tools":
      return "all";
  }
}

function getFilteredSteps(state: TuiState): ActivityStep[] {
  switch (state.timelineFilter) {
    case "failed":
      return state.toolSteps.filter((step) => step.status === "failed");
    case "tools":
      return state.toolSteps.filter((step) => step.kind === "tool");
    case "all":
      return state.toolSteps;
  }
}

// WorkMap rendering functions
function getStepStatusIcon(status: string): string {
  switch (status) {
    case "completed": return pc.green("✓");
    case "failed": return pc.red("✕");
    case "running": return pc.yellow("▶");
    case "skipped": return pc.gray("→");
    default: return pc.gray("○");
  }
}

function getStepStatusColor(status: string): string {
  switch (status) {
    case "completed": return "\x1b[32m"; // green
    case "failed": return "\x1b[31m";    // red
    case "running": return "\x1b[33m";   // yellow
    case "skipped": return "\x1b[90m";   // gray
    default: return "\x1b[90m";          // gray
  }
}

function renderWorkMap(state: TuiState, width: number): string[] {
  if (!state.workMap) return [];
  
  const lines: string[] = [];
  const workMap = state.workMap;
  
  // Compact header
  const statusText = workMap.isPaused ? " [⏸]" : (workMap.error ? " [❌]" : "");
  lines.push(pc.bold(pc.cyan(`[WorkMap] ${workMap.name}${statusText}`)));
  
  // Compact steps
  let stepLine = "";
  for (const step of workMap.steps) {
    const icon = getStepStatusIcon(step.status);
    stepLine += `${icon} `;
  }
  
  if (stepLine.trim()) {
    lines.push(pc.gray(trimText(stepLine, width - 2)));
  }
  
  return lines;
}

function updateFoldState(
  state: TuiState,
  target: "all" | number,
  expanded: boolean,
): number {
  let affected = 0;
  for (const entry of state.entries) {
    if (!entry.collapsible || entry.collapseKey === undefined) {
      continue;
    }
    if (target !== "all" && entry.collapseKey !== target) {
      continue;
    }
    entry.expanded = expanded;
    affected += 1;
  }
  return affected;
}

function buildSidebar(
  state: TuiState,
  width: number,
  height: number,
): string[] {
  const filteredSteps = getFilteredSteps(state);
  const rows = [
    `  id: ${state.currentSessionId}`,
    `  busy: ${state.busy ? "yes" : "no"}`,
    `  scroll: ${state.scrollOffset}`,
    `  filter: ${state.timelineFilter}`,
    "",
    "Now Running",
    `  phase: ${getPhaseBadge(state.currentActivity)}`,
    `  tool: ${state.currentActivity?.toolName ?? "-"}`,
    `  detail: ${state.currentActivity?.detail ?? "-"}`,
    `  last: ${state.currentActivity?.lastResult ?? "-"}`,
    "",
    "Recent Completed",
    ...filteredSteps
      .slice(-Math.max(4, height - 12))
      .map((step) => `  ${formatStep(step)}`),
    "",
    "Keys",
    "  Enter submit",
    "  Up/Down scroll",
    "  PgUp/PgDn page",
    "  Ctrl+E expand all",
    "  Ctrl+G collapse all",
    "  Ctrl+F cycle filter",
    "  Esc clear input",
    "  Ctrl+C quit",
    "",
    "Commands",
    "  /help /tools /sessions",
    "  /inspect <id> /export-session <id>",
    "  /rm-session <id>",
    "  /cleanup-sessions --keep N [--dry-run]",
    "  /expand [n|all]",
    "  /collapse [n|all]",
    "  /filter [all|failed|tools]",
    "  /resume latest|failed",
    "  /new /clear /quit",
  ];

  return rows.slice(0, height).map((line) => trimText(line, width));
}

function withPanelBorder(
  title: string,
  lines: string[],
  width: number,
  height: number,
): string[] {
  const innerWidth = Math.max(8, width - 2);
  const bodyRows = Math.max(0, height - 2);
  const normalized = [
    `┌${trimTextPlain(` ${title} `, innerWidth).replace(/ /g, "─")}┐`,
    ...Array.from({ length: bodyRows }).map((_, index) => {
      const line = lines[index] ?? "";
      return `│${trimText(line, innerWidth)}│`;
    }),
    `└${"─".repeat(innerWidth)}┘`,
  ];
  return normalized.slice(0, height);
}

function withSinglePanelBorder(
  title: string,
  lines: string[],
  width: number,
  height: number,
): string[] {
  const innerWidth = Math.max(8, width - 2);
  const bodyRows = Math.max(0, height - 2);
  const normalized = [
    `┌${trimTextPlain(` ${title} `, innerWidth).replace(/ /g, "─")}┐`,
    ...Array.from({ length: bodyRows }).map((_, index) => {
      const line = lines[index] ?? "";
      return `│ ${trimText(line, innerWidth - 2)} │`;
    }),
    `└${"─".repeat(innerWidth)}┘`,
  ];
  return normalized.slice(0, height);
}

function withSinglePanelBorderColored(
  title: string,
  lines: string[],
  width: number,
  height: number,
  borderColor: string,
): string[] {
  const innerWidth = Math.max(8, width - 2);
  const bodyRows = Math.max(0, height - 2);

  const normalized = [
    `${borderColor}\x1b[1m┌${trimTextPlain(` ${title} `, innerWidth).replace(/ /g, "─")}┐\x1b[0m`,
    ...Array.from({ length: bodyRows }).map((_, index) => {
      const line = lines[index] ?? "";
      return `${borderColor}\x1b[0m│ ${trimText(line, innerWidth - 2)} │`;
    }),
    `${borderColor}\x1b[1m└${"─".repeat(innerWidth)}┘\x1b[0m`,
  ];
  return normalized.slice(0, height);
}

function formatConversationLine(entry: ConversationEntry): string {
  if (entry.collapsible && entry.expanded === false) {
    return `[#${entry.collapseKey}] ${entry.summary ?? "collapsed result"} (collapsed)`;
  }
  return entry.text;
}

function applyModalOverlay(
  lines: string[],
  modal: ModalState,
  width: number,
  height: number,
): string[] {
  const boxWidth = Math.min(width - 6, Math.max(40, Math.floor(width * 0.7)));
  const innerWidth = boxWidth - 4;
  
  // 去除 ANSI 代码
  function stripAnsi(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, "");
  }
  
  // 简单的文本填充（只处理纯文本
  function padTextPlain(text: string, targetWidth: number): string {
    let result = text;
    let currentWidth = 0;
    for (const char of text) {
      currentWidth++;
    }
    while (currentWidth < targetWidth) {
      result += " ";
      currentWidth++;
    }
    return result;
  }

  // 使用原始的 Unicode 边框字符
  const YELLOW = "\x1b[33m";
  const RESET = "\x1b[0m";
  const BOLD = "\x1b[1m";
  const CYAN = "\x1b[36m";

  const borderHorizontal = "─".repeat(boxWidth - 2);
  
  let boxLines: string[];
  
  // 检查是否是 Spec modal
  if ("phase" in modal) {
    // Spec modal 渲染
    if (modal.phase === "collecting") {
      const param = modal.params[modal.currentParamIndex];
      const progressText = `${modal.currentParamIndex + 1}/${modal.params.length}`;
      
      let typeHint = "";
      if (param.type === "enum" && param.options) {
        typeHint = ` [${param.options.join("|")}]`;
      } else if (param.type === "number") {
        typeHint = " [number]";
      }
      
      const contentLines = [
        `${padTextPlain(progressText, innerWidth)}`,
        "",
        `${param.description}`,
        `${CYAN}${param.name}${RESET}${typeHint}`,
        "",
        `Default: ${YELLOW}${param.default}${RESET}`,
        "",
        `> ${modal.currentValue}█`,
      ];
      
      boxLines = [
        `${BOLD}${YELLOW}┌${borderHorizontal}┐${RESET}`,
        `${BOLD}${YELLOW}│${RESET} ${padTextPlain(modal.title, innerWidth)} ${BOLD}${YELLOW}│${RESET}`,
        `${YELLOW}├${borderHorizontal}┤${RESET}`,
        ...contentLines.map((line) => `${YELLOW}│${RESET} ${padTextPlain(line, innerWidth)} ${YELLOW}│${RESET}`),
        `${YELLOW}├${borderHorizontal}┤${RESET}`,
        `${YELLOW}│${RESET} ${padTextPlain("[Enter] confirm   [Esc] use defaults", innerWidth)} ${YELLOW}│${RESET}`,
        `${YELLOW}└${borderHorizontal}┘${RESET}`,
      ];
    } else {
      // 确认阶段
      const specLines = Object.entries(modal.collectedValues).map(
        ([key, value]) => `${key}: ${CYAN}${value}${RESET}`
      );
      
      const contentLines = [
        "Final Configuration:",
        "",
        ...specLines,
      ];
      
      boxLines = [
        `${BOLD}${YELLOW}┌${borderHorizontal}┐${RESET}`,
        `${BOLD}${YELLOW}│${RESET} ${padTextPlain(modal.title, innerWidth)} ${BOLD}${YELLOW}│${RESET}`,
        `${YELLOW}├${borderHorizontal}┤${RESET}`,
        ...contentLines.map((line) => `${YELLOW}│${RESET} ${padTextPlain(line, innerWidth)} ${YELLOW}│${RESET}`),
        `${YELLOW}├${borderHorizontal}┤${RESET}`,
        `${YELLOW}│${RESET} ${padTextPlain("[y/Enter] execute   [n/Esc] edit   [↑/↓] prev/next", innerWidth)} ${YELLOW}│${RESET}`,
        `${YELLOW}└${borderHorizontal}┘${RESET}`,
      ];
    }
  } else {
    // 原有的 Permission modal
    const contentLines = wrapText(modal.message, innerWidth);
    
    boxLines = [
      `${BOLD}${YELLOW}┌${borderHorizontal}┐${RESET}`,
      `${BOLD}${YELLOW}│${RESET} ${padTextPlain(modal.title, innerWidth)} ${BOLD}${YELLOW}│${RESET}`,
      `${YELLOW}├${borderHorizontal}┤${RESET}`,
      ...contentLines.map((line) => `${YELLOW}│${RESET} ${padTextPlain(line, innerWidth)} ${YELLOW}│${RESET}`),
      `${YELLOW}├${borderHorizontal}┤${RESET}`,
      `${YELLOW}│${RESET} ${padTextPlain("[y] allow   [a] session   [n] cancel", innerWidth)} ${YELLOW}│${RESET}`,
      `${YELLOW}└${borderHorizontal}┘${RESET}`,
    ];
  }

  const startY = Math.max(1, Math.floor((height - boxLines.length) / 2));
  const startX = Math.max(0, Math.floor((width - boxWidth) / 2));
  const next = [...lines];

  // 确保有足够行数
  while (next.length < height) {
    next.push(" ".repeat(width));
  }

  // 渲染模态框 - 更简单可靠的方法
  for (let i = 0; i < boxLines.length; i += 1) {
    const targetIndex = startY + i;
    if (targetIndex >= next.length) {
      break;
    }
    
    // 获取原始行
    const original = next[targetIndex].padEnd(width, " ");
    
    // 直接构建整行：左边空白 + 模态框内容 + 右边空白
    const overlay = boxLines[i];
    const leftMargin = " ".repeat(startX);
    const rightMargin = " ".repeat(Math.max(0, width - startX - boxWidth));
    
    next[targetIndex] = leftMargin + overlay + rightMargin;
  }

  return next;
}

function renderScreen(
  state: TuiState,
  runtimeRef: { current: RuntimeState },
): void {
  const width = Math.max(60, output.columns ?? 80);
  const height = Math.max(20, output.rows ?? 24);

  // 移除侧边栏，使用单栏布局
  const mainWidth = width - 4; // 留出左右边框空间
  const contentHeight = Math.max(8, height - 10);
  const mode = getPermissionMode(state, runtimeRef);


  function setCenteredTerminalTitle(title: string, totalWidth = 10) {
    // 计算需要填充的空格
    const titleLength = [...title].length; // 支持 Emoji 正确计算长度
    const spaces = Math.max(0, totalWidth - titleLength);
    const leftPad = " ".repeat(Math.min(Math.floor(spaces / 2), totalWidth > titleLength ? spaces : 0));

    // 输出到终端标签
    process.stdout.write(`\x1b]0;${leftPad}${title}\x07`);
  }
  setCenteredTerminalTitle("🚀 Siok Cli");

  const header = [
    `${pc.bold(pc.magenta(`Mode: ${mode}`) + `  ·  ` + pc.blue(`Session: ${state.currentSessionId}`))}`,
    "",
  ];
  
  // Render WorkMap if active
  const workMapLines = renderWorkMap(state, mainWidth);

  const messageLines = state.entries.flatMap((entry) => {
    // 为不同消息类型添加颜色
    let text = entry.text;
    if (entry.collapsible && entry.expanded === false) {
      text = `[#${entry.collapseKey}] ${entry.summary ?? "collapsed result"} (collapsed)`;
    }
    let coloredText = text;
    switch (entry.kind) {
      case "user":
        coloredText = `${state.theme === 'dark' ? pc.bgCyan(pc.black('Siok')) + pc.cyan(` ${text}`) : pc.bgCyan(pc.white('Siok')) + pc.cyan(` ${text}`)}`;
        break;
      case "assistant":
        coloredText = `${state.theme === 'dark' ? pc.bgBlack(pc.white('SLI')) + pc.black(` ${text}`) : pc.bgWhite(pc.black('SLI')) + pc.white(` ${text}`)}`;
        break;
      case "tool":
        coloredText = `${state.theme === 'dark' ? pc.bgYellow(pc.black('Tool')) + pc.yellow(` ${text}`) : pc.bgYellow(pc.white('Tool')) + pc.yellow(` ${text}`)}`;
        break;
      case "result":
        coloredText = `${state.theme === 'dark' ? pc.bgBlack(pc.white('Out')) + pc.black(` ${text}`) : pc.bgWhite(pc.black('Out')) + pc.white(` ${text}`)}`;
        break;
      case "error":
        coloredText = `${state.theme === 'dark' ? pc.bgRed(pc.black('Err')) + pc.red(` ${text}`) : pc.bgRed(pc.white('Err')) + pc.red(` ${text}`)}`;
        break;
      case "system":
        coloredText = `${state.theme === 'dark' ? pc.bgBlack(pc.white('Sys')) + pc.black(` ${text}`) : pc.bgWhite(pc.black('Sys')) + pc.white(` ${text}`)}`;
        break;
    }
    return wrapText(coloredText, Math.max(20, mainWidth - 4));
  });

  if (state.streamingAssistantText.trim()) {
    const streamingText = `${state.streamingAssistantText}▌`;
    messageLines.push(
      ...wrapText(
        `${state.theme === 'dark' ? pc.bgBlack(pc.white('SLI')) + pc.black(` ${streamingText}`) : pc.bgWhite(pc.black('SLI')) + pc.white(` ${streamingText}`)}`,
        Math.max(20, mainWidth - 4),
      ),
    );
  }

  const maxScroll = Math.max(0, messageLines.length - contentHeight);
  if (state.scrollOffset > maxScroll) {
    state.scrollOffset = maxScroll;
  }
  const start = Math.max(
    0,
    messageLines.length - contentHeight - state.scrollOffset,
  );
  const visibleMessages = messageLines.slice(start + 2, start + contentHeight);

  let helpMessages: string[] = [];
  if (state.isSearching && state.searchMatches.length > 0) {
    for (let i = state.selectedMatchIndex - 2; i < state.selectedMatchIndex + 3; i++) {
      const actualIndex = ((i % state.searchMatches.length) + state.searchMatches.length) % state.searchMatches.length;
      if (actualIndex === state.selectedMatchIndex) {
        helpMessages.push(`${state.theme === 'dark' ? pc.bgCyan(pc.black(state.searchMatches[actualIndex])) : pc.bgCyan(pc.white(state.searchMatches[actualIndex]))}`);
      }
      else
        helpMessages.push(state.searchMatches[actualIndex]);
    }
  }
  // 极简风格，没有边框
  let lines = [
    ...header,
    ...workMapLines, // Add WorkMap visualization
    ...visibleMessages,
    "",
    `${state.theme === 'dark' ? pc.gray("─".repeat(width)) : pc.gray("─".repeat(width))}`,
    state.status.includes("Error") || state.status.includes("failed")
      ? `${state.theme === 'dark' ? pc.red(`Status: ${state.status}`) : pc.redBright(`Status: ${state.status}`)}`
      : state.busy
        ? `${state.theme === 'dark' ? pc.yellow(`Status: ${state.status}`) : pc.yellowBright(`Status: ${state.status}`)}`
        : `${state.theme === 'dark' ? pc.green(`Status: ${state.status}`) : pc.greenBright(`Status: ${state.status}`)}`,
    `${pc.gray(`Keys: Enter submit · Up/Down backtrace/forward · PgUp/PgDn page · Left/Right move cursor · Ctrl+E expand · Ctrl+G collapse · Ctrl+F filter · Esc clear · Ctrl+C quit`)}`,
    state.modal
      ? `${state.theme === 'dark' ? pc.yellow(`Modal active`) : pc.yellowBright(`Modal active`)}`
      : (() => {
          const prefix = state.inputBuffer.slice(0, state.cursorPosition);
          const cursorChar = state.inputBuffer[state.cursorPosition] || ' ';
          const afterCursor = state.inputBuffer.slice(state.cursorPosition + 1);
          const prompt = state.theme === 'dark'
            ? pc.bgCyan(pc.black('Siok>'))
            : pc.bgCyan(pc.white('Siok>'));
          const cursorHighlight = state.theme === 'dark'
            ? pc.bgWhite(pc.black(cursorChar))
            : pc.bgBlack(pc.white(cursorChar));
          return `${prompt} ${pc.cyan(prefix)}${cursorHighlight}${pc.cyan(afterCursor)}`;
        })(),
    // 渲染搜索匹配的命令，并高亮当前选中的命令
    ...helpMessages.length > 0 ? helpMessages : ""
  ];

  // 先应用模态框（如果有），然后再截断
  if (state.modal) {
    lines = applyModalOverlay(lines, state.modal, width, height);
  }
  
  lines = lines.slice(0, height);

  output.write("\x1b[2J\x1b[H");
  output.write(lines.join("\n"));
}

async function restoreSession(
  cwd: string,
  appStateRef: { current: AppState },
  state: TuiState,
  runtimeRef: { current: RuntimeState },
  sessionId: string,
): Promise<void> {
  const messages = await readTranscriptMessages(cwd, sessionId);
  const runtime = createRuntime(cwd, appStateRef, sessionId);
  runtime.session.hydrateMessages(messages);
  runtimeRef.current = runtime;
  state.entries = messages.flatMap((message) =>
    makeConversationEntries(state, message),
  );
  state.currentSessionId = sessionId;
  state.scrollOffset = 0;
  state.status = `Resumed ${sessionId}`;
  addToolStep(state, `resumed ${sessionId}`);
}

async function runSlashCommand(
  line: string,
  options: TuiOptions,
  state: TuiState,
  runtimeRef: { current: RuntimeState },
  appStateRef: { current: AppState },
  requestPermission: (request: { toolName: string; input: unknown; message: string }) => Promise<boolean>,
  requestSpec: (request: { skillId: string; params: ParamConfig[] }) => Promise<Record<string, any>>,
): Promise<void> {
  const commandLine = line.slice(1).trim();
  if (!commandLine) {
    state.entries.push({
      kind: "system",
      text: "可用命令：/help /tools /skills /sessions [--limit N] [--status ready|needs_attention] /inspect <id> /export-session <id> [--format markdown|json] [--output path] /transcript <id> /rm-session <id> /cleanup-sessions --keep N [--dry-run] /expand [n|all] /collapse [n|all] /filter [all|failed|tools] /resume [id|latest|failed] /new /clear /quit",
    });
    return;
  }

  if (commandLine === "clear") {
    state.entries = [];
    state.scrollOffset = 0;
    return;
  }

  if (commandLine === "new") {
    runtimeRef.current = createRuntime(options.cwd, appStateRef);
    state.currentSessionId = runtimeRef.current.session.sessionId;
    state.entries = [
      {
        kind: "system",
        text: "已创建新会话。",
      },
    ];
    state.scrollOffset = 0;
    addToolStep(state, `new session ${state.currentSessionId}`);
    return;
  }

  if (commandLine === "help") {
    state.entries.push({
      kind: "system",
      text: [
        formatHelp(),
        "",
        "TUI commands:",
        "  /skills",
        "  /sessions [--limit N] [--status ready|needs_attention]",
        "  /inspect <id>",
        "  /export-session <id> [--format markdown|json] [--output path]",
        "  /rm-session <id>",
        "  /cleanup-sessions --keep N | --older-than DAYS [--status ...] [--dry-run]",
        "  /expand [n|all]",
        "  /collapse [n|all]",
        "  /filter [all|failed|tools]",
        "  /resume [id|latest|failed]",
        "  /new",
        "  /clear",
        "  /quit",
      ].join("\n"),
    });
    return;
  }
  
  if (commandLine === "skills") {
    const skills = getLoadedSkills();
    if (skills.length === 0) {
      state.entries.push({
        kind: "system",
        text: "当前没有加载任何技能。",
      });
    } else {
      const skillsText = skills.map(skill => {
        const triggerText = skill.trigger.length > 0 
          ? ` (触发词: ${skill.trigger.join(", ")})` 
          : "";
        return `  • ${skill.name}${triggerText}`;
      }).join("\n");
      
      state.entries.push({
        kind: "system",
        text: `已加载 ${skills.length} 个技能:\n${skillsText}`,
      });
    }
    return;
  }
  
  // WorkMap commands
  if (commandLine.startsWith("workmap")) {
    const parts = commandLine.split(/\s+/);
    const subCommand = parts[1]; // load, pause, resume, reset, clear
    const skillName = parts.slice(2).join(" ");
    
    if (subCommand === "load" || (!state.workMap && (!subCommand || subCommand === "help"))) {
      const skills = getLoadedSkills();
      if (skills.length === 0) {
        state.entries.push({ kind: "system", text: "没有加载任何技能" });
        return;
      }
      
      // Find skill by name if provided
      let selectedSkill = skills[0];
      if (skillName) {
        const match = skills.find(s => 
          s.name.toLowerCase().includes(skillName.toLowerCase()) ||
          s.trigger.some(t => t.toLowerCase().includes(skillName.toLowerCase()))
        );
        if (match) selectedSkill = match;
      }
      
      // Try to parse skill to workmap and execute it using executeWorkMap
      try {
        const workMap = parseSkillToWorkMap(selectedSkill);
        state.workMap = workMap;
        state.status = `WorkMap 已加载: ${workMap.name}`;
        state.entries.push({
          kind: "system",
          text: `加载工作图: ${workMap.name} (${workMap.phases.length} 阶段, ${workMap.steps.length} 步骤)`,
        });
        renderScreen(state, runtimeRef);
        
        // 使用 executeWorkMap 函数来执行
        for await (const message of executeWorkMap(workMap, {
          prompt: '',
          messages: runtimeRef.current.session.getMessages(),
          systemPrompt: [],
          toolUseContext: runtimeRef.current.toolContext,
          canUseTool,
          onPermissionRequest: requestPermission,
          onSpecRequest: requestSpec,
          onWorkMapUpdate: (workMapUpdate: any) => {
            if (workMapUpdate) {
              state.workMap = workMapUpdate;
              renderScreen(state, runtimeRef);
            }
          }
        })) {
          await runtimeRef.current.session.recordMessages([message]);
          state.entries.push(...makeConversationEntries(state, message));
          renderScreen(state, runtimeRef);
        }
        
      } catch (e) {
        state.status = `执行失败: ${e}`;
      }
      return;
    }
    
    if (!state.workMap) {
      state.entries.push({
        kind: "system",
        text: "没有活动的 WorkMap。使用 /workmap load [skillName] 加载。",
      });
      return;
    }
    
    switch (subCommand) {
      case "pause":
        state.workMap.isPaused = true;
        state.status = "WorkMap 已暂停";
        break;
      case "resume":
        state.workMap.isPaused = false;
        state.status = "WorkMap 已恢复";
        if (state.workMapExecutor) {
          await state.workMapExecutor.handleCommand({ type: "resume" });
        }
        break;
      case "reset":
        state.workMap.steps.forEach(s => {
          s.status = "pending";
          s.error = undefined;
          s.result = undefined;
          s.startedAt = undefined;
          s.completedAt = undefined;
        });
        state.workMap.isPaused = false;
        state.workMap.error = undefined;
        state.workMap.currentStepId = undefined;
        state.status = "WorkMap 已重置";
        if (state.workMapExecutor) {
          await state.workMapExecutor.handleCommand({ type: "reset" });
        }
        break;
      case "clear":
      case "close":
        state.workMap = null;
        state.workMapExecutor = null;
        state.selectedWorkMapStep = null;
        state.status = "WorkMap 已关闭";
        break;
      default:
        state.entries.push({
          kind: "system",
          text: [
            "WorkMap 命令:",
            "  /workmap load [skillName] - 加载技能的工作图",
            "  /workmap pause            - 暂停执行",
            "  /workmap resume           - 恢复执行",
            "  /workmap reset            - 重置所有步骤",
            "  /workmap clear            - 关闭工作图",
          ].join("\n"),
        });
    }
    return;
  }

  if (commandLine.startsWith("expand")) {
    const [, rawTarget] = commandLine.split(/\s+/, 2);
    const target =
      !rawTarget || rawTarget === "all" ? "all" : Number(rawTarget);
    const count = updateFoldState(
      state,
      target === "all" || Number.isNaN(target) ? "all" : target,
      true,
    );
    state.status = `Expanded ${count} result block(s)`;
    return;
  }

  if (commandLine.startsWith("collapse")) {
    const [, rawTarget] = commandLine.split(/\s+/, 2);
    const target =
      !rawTarget || rawTarget === "all" ? "all" : Number(rawTarget);
    const count = updateFoldState(
      state,
      target === "all" || Number.isNaN(target) ? "all" : target,
      false,
    );
    state.status = `Collapsed ${count} result block(s)`;
    return;
  }

  if (commandLine.startsWith("filter")) {
    const [, rawTarget] = commandLine.split(/\s+/, 2);
    if (
      rawTarget !== "all" &&
      rawTarget !== "failed" &&
      rawTarget !== "tools"
    ) {
      state.entries.push({
        kind: "error",
        text: "filter 只支持 all、failed、tools。",
      });
      return;
    }
    state.timelineFilter = rawTarget;
    state.status = `Timeline filter: ${rawTarget}`;
    return;
  }

  if (commandLine.startsWith("resume")) {
    const [, rawTarget] = commandLine.split(/\s+/, 2);
    const sessions = await listSessions(options.cwd);
    const target =
      !rawTarget || rawTarget === "latest"
        ? sessions[0]?.id
        : rawTarget === "failed"
          ? sessions.find((session) => session.status === "needs_attention")?.id
          : rawTarget;
    if (!target) {
      state.entries.push({
        kind: "error",
        text: "没有可恢复的会话。",
      });
      return;
    }
    await restoreSession(options.cwd, appStateRef, state, runtimeRef, target);
    return;
  }

  const result = await executeCliCommand(
    options.cwd,
    tokenizeCommandLine(commandLine),
    options.autoApprove ?? false,
  );

  if (result.kind === "meta") {
    state.entries.push({ kind: "system", text: result.output });
    return;
  }

  if (result.kind === "utility") {
    state.entries.push({
      kind: "system",
      text: formatUnknown(result.output),
    });
    return;
  }

  state.entries.push({
    kind: "system",
    text: `直接执行工具 ${result.tool} 完成。\n${formatUnknown(result.output)}`,
  });
  addToolStep(state, `slash tool ${result.tool}`);
}



function autoCompleteSlashCommand(input: string): string[] | null {
  const trimmed = input.trim();
  const normalized = trimmed.toLowerCase();
  if (!normalized.startsWith("/")) {
    return null;
  }
  
  // 处理 workmap 命令的特殊补全
  if (normalized.startsWith("/workmap")) {
    const parts = trimmed.split(/\s+/);
    const commandPart = parts[0];
    const subCommand = parts[1];
    const argPart = parts.slice(2).join(' ');
    
    if (!subCommand) {
      // 没有子命令，显示所有可用选项
      return [
        "  /workmap load [skillName]",
        "  /workmap pause",
        "  /workmap resume",
        "  /workmap reset",
        "  /workmap clear",
      ];
    }
    
    if (subCommand === "load") {
      // load 子命令，补全技能名称
      const skills = loadedSkillsForCompletion;
      if (skills.length === 0) {
        return ["  /workmap load"];
      }
      
      const skillMatches = skills
        .filter(s => {
          const searchTerm = argPart.toLowerCase();
          return (
            s.name.toLowerCase().includes(searchTerm) ||
            s.frontmatter.trigger?.some((t: string) => 
              t.toLowerCase().includes(searchTerm)
            ) ||
            searchTerm === ""
          );
        })
        .map(s => `  /workmap load ${s.name}`);
      
      return skillMatches.length > 0 ? skillMatches : null;
    }
    
    // 其他子命令
    return [
      "  /workmap load [skillName]",
      "  /workmap pause",
      "  /workmap resume",
      "  /workmap reset",
      "  /workmap clear",
    ].filter(msg => msg.toLowerCase().includes(normalized));
  }
  
  // 其他命令的常规补全
  const command = normalized.slice(1);
  const matches = helpMessagesAll.filter(msg =>
    msg.toLowerCase().includes(command)
  );
  return matches.length > 0 ? matches : null;
}

async function getTerminalTheme(): Promise<'dark' | 'light' | 'unknown'> {
  // 1. 优先：系统级深色模式检测（最准）
  try {
    const systemDark = await isDark();
    if (systemDark) return 'dark';
  } catch (e) { /* 忽略系统检测失败 */ }

  // 2. 次选：终端环境变量判断（COLORFGBG 格式：前景;背景）
  const colorFgBg = process.env.COLORFGBG;
  if (colorFgBg) {
    const [fg, bg] = colorFgBg.split(';');
    // 背景色数字 > 7 通常是亮色（白/浅灰），<7 是暗色（黑/深灰）
    if (bg && !isNaN(Number(bg))) {
      return Number(bg) > 7 ? 'light' : 'dark';
    }
  }

  // 3. 兜底：常见终端默认判断
  const term = process.env.TERM || '';
  const termProgram = process.env.TERM_PROGRAM || '';
  if (
    term.includes('256color') ||
    termProgram.includes('iTerm') ||
    termProgram.includes('WindowsTerminal') ||
    termProgram.includes('vscode')
  ) {
    // 现代终端默认多为暗色，可按你的场景调整
    return 'dark';
  }

  return 'unknown';
}

export async function startTui(options: TuiOptions): Promise<void> {
  if (!input.isTTY || !output.isTTY) {
    throw new Error("TUI 模式需要在交互式终端中运行。");
  }

  const appStateRef = { current: createInitialAppState() };
  const runtimeRef = { current: createRuntime(options.cwd, appStateRef) };

  const sysTheme = await getTerminalTheme();

  const state: TuiState = {
    entries: [
      {
        kind: "system",
        text: "输入自然语言让我执行本地动作，或输入 /help 查看命令。",
      },
    ],
    inputBuffer: "",
    streamingAssistantText: "",
    status: "Ready",
    busy: false,
    modal: null,
    scrollOffset: 0,
    toolSteps: [],
    currentActivity: {
      phase: "idle",
      detail: "waiting for prompt",
    },
    currentSessionId: runtimeRef.current.session.sessionId,
    activityStartedAt: null,
    nextCollapseKey: 1,
    nextStepSeq: 1,
    timelineFilter: "all",
    isSearching: false,
    searchMatches: [],
    selectedMatchIndex: -1,
    theme: sysTheme === 'dark' ? 'light' : 'dark',
    history: [],
    historyIndex: -1,
    workMap: null,
    workMapExecutor: null,
    selectedWorkMapStep: null,
    cursorPosition: 0,
  };

  const availableSessions = await listSessions(options.cwd);
  if (availableSessions.length > 0) {
    state.entries.push({
      kind: "system",
      text: `发现最近会话 ${availableSessions[0].id}。输入 /resume latest 可恢复；若要回到异常会话，使用 /resume failed。`,
    });
  }

  // 加载技能
  const skills = await loadSkills();
  loadedSkillsForCompletion = skills;
  if (skills.length > 0) {
    state.entries.push({
      kind: "system",
      text: `已加载 ${skills.length} 个技能: ${skills.map(s => s.name).join(", ")}`,
    });
  }

  let exiting = false;

  const cleanup = () => {
    output.write("\x1b[?1049l\x1b[?25h");
    input.removeListener("keypress", onKeypress);
    output.removeListener("resize", onResize);
    if (input.isTTY) {
      input.setRawMode(false);
    }
  };

  const onResize = () => {
    renderScreen(state, runtimeRef);
  };

  const validateParamValue = (param: ParamConfig, value: string): { valid: boolean; error?: string } => {
    // 如果用户没有输入，使用默认值
    if (!value.trim()) {
      return { valid: true };
    }

    switch (param.type) {
      case "string":
        return { valid: true };

      case "number":
        const num = Number(value);
        if (isNaN(num)) {
          return { valid: false, error: "请输入有效的数字" };
        }
        return { valid: true };

      case "enum":
        if (param.options && !param.options.includes(value)) {
          return { valid: false, error: `请从以下选项中选择: ${param.options.join(", ")}` };
        }
        return { valid: true };
    }

    return { valid: true };
  };

  const requestSpec = async (request: {
    skillId: string;
    params: ParamConfig[];
  }): Promise<Record<string, any>> => {
    state.status = `Configuring: ${request.skillId}`;
    setCurrentActivity(state, {
      phase: "approval",
      detail: "collecting parameters",
    });
    addActivityStep(
      state,
      `configure ${request.skillId}`,
      "permission",
      "info",
    );
    renderScreen(state, runtimeRef);

    return new Promise<Record<string, any>>((resolve) => {
      state.modal = {
        title: `Configure · ${request.skillId}`,
        skillId: request.skillId,
        params: request.params,
        currentParamIndex: 0,
        currentValue: String(request.params[0].default),
        collectedValues: {},
        phase: "collecting",
        resolve: (spec: Record<string, any>) => {
          state.modal = null;
          state.status = `Configured ${request.skillId}`;
          setCurrentActivity(state, {
            phase: "done",
            detail: "parameters collected",
            lastResult: "configured",
          });
          addActivityStep(
            state,
            `configured ${request.skillId}`,
            "permission",
            "done",
          );
          resolve(spec);
        },
      };
      renderScreen(state, runtimeRef);
    });
  };

  const requestPermission = async (request: {
    toolName: string;
    input: unknown;
    message: string;
  }): Promise<boolean> => {
    if (options.autoApprove) {
      setCurrentActivity(state, {
        phase: "approval",
        toolName: request.toolName,
        detail: "auto-approved",
        lastResult: "approved",
      });
      addActivityStep(
        state,
        `auto-approved ${request.toolName}`,
        "permission",
        "done",
      );
      return true;
    }

    state.status = `Waiting for permission: ${request.toolName}`;
    setCurrentActivity(state, {
      phase: "approval",
      toolName: request.toolName,
      detail: request.message,
    });
    addActivityStep(
      state,
      `permission ${request.toolName}`,
      "permission",
      "info",
    );
    renderScreen(state, runtimeRef);
    return new Promise<boolean>((resolve) => {
      state.modal = {
        title: `Permission · ${request.toolName}`,
        message: request.message,
        toolName: request.toolName,
        inputValue: request.input,
        resolve: (decision: "allow-once" | "allow-session" | "deny") => {
          state.modal = null;
          const allowed = decision !== "deny";
          if (decision === "allow-session") {
            const tool = findToolByName(getTools(), request.toolName);
            if (tool) {
              rememberPermissionRule(
                runtimeRef.current.toolContext,
                tool as never,
                request.input as never,
              );
            }
          }
          state.status = allowed
            ? `Approved ${request.toolName}`
            : `Rejected ${request.toolName}`;
          setCurrentActivity(state, {
            phase: allowed ? "done" : "failed",
            toolName: request.toolName,
            detail: allowed ? "permission granted" : "permission denied",
            lastResult: allowed ? "approved" : "rejected",
          });
          addActivityStep(
            state,
            `${allowed ? "approved" : "rejected"} ${request.toolName}`,
            "permission",
            allowed ? "done" : "failed",
          );
          resolve(allowed);
        },
      };
      renderScreen(state, runtimeRef);
    });
  };

  const submitPrompt = async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || exiting) {
      return;
    }

    if (trimmed === "/quit" || trimmed === "/exit") {
      exiting = true;
      return;
    }

    state.busy = true;
    state.status = "Processing";
    state.streamingAssistantText = "";
    state.activityStartedAt = Date.now();
    runtimeRef.current.toolContext.abortController = new AbortController();
    setCurrentActivity(
      state,
      trimmed.startsWith("/")
        ? {
          phase: "planning",
          detail: "running slash command",
        }
        : {
          phase: "planning",
          detail: "planning response",
        },
    );
    state.entries.push({
      kind: trimmed.startsWith("/") ? "system" : "user",
      text: trimmed,
    });
    state.scrollOffset = 0;
    if (!trimmed.startsWith("/")) {
      addActivityStep(
        state,
        `prompt ${trimmed.slice(0, 32)}`,
        "prompt",
        "info",
      );
    }
    renderScreen(state, runtimeRef);

    try {
      if (trimmed.startsWith("/")) {
        await runSlashCommand(trimmed, options, state, runtimeRef, appStateRef, requestPermission, requestSpec);
        // 重置搜索状态
        state.isSearching = false;
        state.searchMatches = [];
        state.selectedMatchIndex = -1;
        renderScreen(state, runtimeRef);
      } else {
        const userMessage: Message = {
          id: createId("user"),
          type: "user",
          content: trimmed,
        };
        await runtimeRef.current.session.recordMessages([userMessage]);

        for await (const message of query({
          prompt: trimmed,
          messages: runtimeRef.current.session.getMessages(),
          systemPrompt: [],
          toolUseContext: runtimeRef.current.toolContext,
          canUseTool,
          onAssistantTextDelta: (text) => {
            state.streamingAssistantText = text;
            renderScreen(state, runtimeRef);
          },
          onPermissionRequest: requestPermission,
          onSpecRequest: requestSpec,
          onWorkMapUpdate: (workMap: WorkMap | null) => {
            state.workMap = workMap;
            renderScreen(state, runtimeRef);
          },
        })) {
          if (
            message.type === "assistant" &&
            message.content.some((block) => block.type === "text")
          ) {
            state.streamingAssistantText = "";
          }
          await runtimeRef.current.session.recordMessages([message]);
          // 记录当前滚动位置是否在底部
          const wasAtBottom = state.scrollOffset === 0;

          state.entries.push(...makeConversationEntries(state, message));
          if (message.type === "assistant") {
            const toolUse = message.content.find(
              (block) => block.type === "tool_use",
            );
            if (toolUse && toolUse.type === "tool_use") {
              setCurrentActivity(state, {
                phase: "running",
                toolName: toolUse.name,
                detail: "tool executing",
              });
              addActivityStep(state, `run ${toolUse.name}`, "tool", "info");
            }
          }
          if (message.type === "tool_result") {
            const previousToolName = state.currentActivity?.toolName;
            const durationMs =
              state.activityStartedAt === null
                ? undefined
                : Date.now() - state.activityStartedAt;
            setCurrentActivity(state, {
              phase: message.isError ? "failed" : "done",
              toolName: previousToolName,
              detail: message.isError
                ? "tool returned error"
                : "tool completed",
              lastResult: message.isError ? "error" : "ok",
            });
            addActivityStep(
              state,
              `${message.isError ? "error" : "done"} ${previousToolName ?? (message.toolUseId?.slice(0, 10) ?? "unknown-tool")}`,
              message.isError ? "error" : "tool",
              message.isError ? "failed" : "done",
              durationMs,
            );
          }

          // 只有当用户之前在底部时，才自动滚动到底部
          if (wasAtBottom) {
            state.scrollOffset = 0;
          }
          renderScreen(state, runtimeRef);
        }
      }

      state.status = `Ready · transcript: ${runtimeRef.current.session.getTranscriptPath()}`;
      state.currentSessionId = runtimeRef.current.session.sessionId;
      state.activityStartedAt = null;
      state.streamingAssistantText = "";
      if (state.currentActivity?.phase !== "failed") {
        setCurrentActivity(state, {
          phase: "idle",
          toolName: state.currentActivity?.toolName,
          detail: "waiting for prompt",
          lastResult: state.currentActivity?.lastResult ?? "ok",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const interrupted =
        runtimeRef.current.toolContext.abortController.signal.aborted;
      state.entries.push({
        kind: interrupted ? "system" : "error",
        text: interrupted ? "当前 turn 已中断。" : message,
      });
      state.status = interrupted ? "Interrupted" : "Error";
      state.streamingAssistantText = "";
      state.isSearching = false;
      state.searchMatches = [];
      state.selectedMatchIndex = -1;
      const durationMs =
        state.activityStartedAt === null
          ? undefined
          : Date.now() - state.activityStartedAt;
      setCurrentActivity(state, {
        phase: "failed",
        detail: interrupted ? "interrupted by user" : message,
        lastResult: interrupted ? "interrupted" : "error",
      });
      addActivityStep(
        state,
        interrupted
          ? "interrupted current turn"
          : `error ${message.slice(0, 24)}`,
        interrupted ? "session" : "error",
        "failed",
        durationMs,
      );
    } finally {
      state.busy = false;
      state.activityStartedAt = null;
      state.streamingAssistantText = "";
      renderScreen(state, runtimeRef);
    }
  };

  const onKeypress = (str: string, key: readline.Key) => {
    if (exiting) {
      return;
    }

    if (state.modal) {
      // 检查是否是 Spec modal
      if ("phase" in state.modal) {
        const modal = state.modal;
        if (modal.phase === "collecting") {
          if (key.name === "return" || key.name === "enter") {
            // 验证当前值
            const param = modal.params[modal.currentParamIndex];
            const validation = validateParamValue(param, modal.currentValue);
            if (!validation.valid) {
              state.status = validation.error || "Invalid value";
              renderScreen(state, runtimeRef);
              return;
            }

            // 保存当前值
            const finalValue = modal.currentValue.trim() ? modal.currentValue : String(param.default);
            let typedValue: any = finalValue;
            if (param.type === "number") {
              typedValue = Number(finalValue);
            }
            modal.collectedValues[param.name] = typedValue;

            // 移动到下一个参数或确认阶段
            if (modal.currentParamIndex < modal.params.length - 1) {
              modal.currentParamIndex++;
              modal.currentValue = String(modal.params[modal.currentParamIndex].default);
            } else {
              modal.phase = "confirming";
            }
          } else if (key.name === "backspace") {
            modal.currentValue = modal.currentValue.slice(0, -1);
          } else if (key.name === "escape") {
            // ESC 取消收集，使用全部默认值
            const defaultSpec: Record<string, any> = {};
            for (const p of modal.params) {
              defaultSpec[p.name] = p.default;
            }
            modal.resolve(defaultSpec);
          } else if (str && str.length > 0 && !key.ctrl && !key.meta) {
            modal.currentValue += str;
          }
        } else if (modal.phase === "confirming") {
          if (key.name === "y" || key.name === "return" || key.name === "enter") {
            // 确认执行
            modal.resolve(modal.collectedValues);
          } else if (key.name === "n" || key.name === "escape") {
            // 回到收集阶段，重新开始
            modal.phase = "collecting";
            modal.currentParamIndex = 0;
            modal.currentValue = String(modal.params[0].default);
            modal.collectedValues = {};
          } else if (key.name === "arrowup" || key.name === "arrowdown") {
            // 上下箭头回到前一个/后一个参数
            const direction = key.name === "arrowup" ? -1 : 1;
            modal.currentParamIndex = Math.max(0, Math.min(modal.params.length - 1, modal.currentParamIndex + direction));
            modal.currentValue = String(modal.params[modal.currentParamIndex].default);
            modal.phase = "collecting";
          }
        }
        renderScreen(state, runtimeRef);
        return;
      } else {
        // 原有的 Permission modal
        if (key.name === "y") {
          state.modal.resolve("allow-once");
        } else if (key.name === "a") {
          state.modal.resolve("allow-session");
        } else if (key.name === "n" || key.name === "escape") {
          state.modal.resolve("deny");
        }
        renderScreen(state, runtimeRef);
        return;
      }
    }

    // 检查是否是斜杠字符（readline可能不会将斜杠识别为key.name === "slash"）
    if (str === "/" && state.busy === false) {
      // 处理斜杠字符输入
      state.inputBuffer += "/";
      state.isSearching = true;

      // 显示所有可用命令作为提示
      state.status = "正在匹配命令";
      const matches = autoCompleteSlashCommand(state.inputBuffer);
      if (matches) {
        state.searchMatches = matches;
        state.selectedMatchIndex = 0;
      } else {
        state.searchMatches = [];
        state.selectedMatchIndex = -1;
      }
      renderScreen(state, runtimeRef);
      return;
    }

    if (key.ctrl && key.name === "c") {
      if (state.busy) {
        runtimeRef.current.toolContext.abortController.abort(
          new Error("User interrupted current turn"),
        );
        state.status = "Interrupting current turn";
        renderScreen(state, runtimeRef);
        return;
      }
      exiting = true;
      return;
    }

    if (key.ctrl && key.name === "e") {
      const count = updateFoldState(state, "all", true);
      state.status = `Expanded ${count} result block(s)`;
      renderScreen(state, runtimeRef);
      return;
    }

    if (key.ctrl && key.name === "g") {
      const count = updateFoldState(state, "all", false);
      state.status = `Collapsed ${count} result block(s)`;
      renderScreen(state, runtimeRef);
      return;
    }

    if (key.ctrl && key.name === "f") {
      state.timelineFilter = cycleTimelineFilter(state.timelineFilter);
      state.status = `Timeline filter: ${state.timelineFilter}`;
      renderScreen(state, runtimeRef);
      return;
    }

    if (key.ctrl && key.name === "l") {
      output.write("\x1b[2J\x1b[H");
      renderScreen(state, runtimeRef);
      return;
    }

    if (state.busy) {
      return;
    }

    if (key.name === "return") {
      const current = state.inputBuffer;

      // Reset cursor and search state
      state.isSearching = false;
      state.searchMatches = [];
      state.selectedMatchIndex = -1;
      state.cursorPosition = 0;

      state.inputBuffer = "";
      void submitPrompt(current);
      // 记录当前输入到历史记录
      state.history.push(current);
      state.historyIndex = state.history.length;
      return;
    }

    if (key.name === "backspace") {
      if (state.cursorPosition > 0) {
        // Delete character before cursor
        const chars = Array.from(state.inputBuffer);
        chars.splice(state.cursorPosition - 1, 1);
        state.inputBuffer = chars.join("");
        state.cursorPosition -= 1;
      }

      // 如果删除后不再以斜杠开头，退出搜索状态
      if (state.inputBuffer.length > 0 && !state.inputBuffer.startsWith("/")) {
        state.isSearching = false;
        state.searchMatches = [];
        state.selectedMatchIndex = -1;
        state.status = "Ready";
      } else if (state.inputBuffer.length === 0) {
        state.isSearching = false;
        state.searchMatches = [];
        state.selectedMatchIndex = -1;
        state.status = "Ready";
      } else if (state.inputBuffer.startsWith("/")) {
        // 更新搜索匹配
        const matches = autoCompleteSlashCommand(state.inputBuffer);
        if (matches) {
          state.searchMatches = matches;
          state.selectedMatchIndex = 0;
          state.status = `正在匹配命令`;
        } else {
          state.searchMatches = [];
          state.selectedMatchIndex = -1;
          state.status = "无匹配命令";
        }
      }

      renderScreen(state, runtimeRef);
      return;
    }

    if (key.name === "escape") {
      state.inputBuffer = "";
      state.isSearching = false;
      state.searchMatches = [];
      state.selectedMatchIndex = -1;
      state.status = "Ready";
      renderScreen(state, runtimeRef);
      return;
    }

    if (state.isSearching && state.searchMatches.length > 0) {
      // 在搜索模式下，使用箭头键导航搜索结果
      if (key.name === "up") {
        // 实现循环列表：向上到顶时跳到底部
        state.selectedMatchIndex =
          state.selectedMatchIndex - 1 < 0
            ? state.searchMatches.length - 1
            : state.selectedMatchIndex - 1;
        renderScreen(state, runtimeRef);
        return;
      }

      if (key.name === "down") {
        // 实现循环列表：向下到底时跳到顶部
        state.selectedMatchIndex =
          state.selectedMatchIndex + 1 >= state.searchMatches.length
            ? 0
            : state.selectedMatchIndex + 1;
        renderScreen(state, runtimeRef);
        return;
      }
    } else {
      // 非搜索模式下，使用箭头键选择最近输入的消息
      if (key.name === "up") {
        state.historyIndex = Math.max(0, state.historyIndex - 1);
        state.inputBuffer = state.history[state.historyIndex];
        renderScreen(state, runtimeRef);
        return;
      }

      if (key.name === "down") {
        state.historyIndex = state.historyIndex == state.history.length ? state.historyIndex : state.historyIndex + 1;
        state.inputBuffer = state.historyIndex < state.history.length ? state.history[state.historyIndex] : "";
        // Reset cursor to end when navigating history
        state.cursorPosition = state.inputBuffer.length;
        renderScreen(state, runtimeRef);
        return;
      }

      if (key.name === "left") {
        state.cursorPosition = Math.max(0, state.cursorPosition - 1);
        renderScreen(state, runtimeRef);
        return;
      }

      if (key.name === "right") {
        state.cursorPosition = Math.min(state.inputBuffer.length, state.cursorPosition + 1);
        renderScreen(state, runtimeRef);
        return;
      }
    }

    if (key.name === "pageup") {
      state.scrollOffset += 8;
      renderScreen(state, runtimeRef);
      return;
    }

    if (key.name === "pagedown") {
      state.scrollOffset = Math.max(0, state.scrollOffset - 8);
      renderScreen(state, runtimeRef);
      return;
    }

    if (key.name === "tab" && state.isSearching && state.searchMatches.length > 0) {
      // 使用Tab键自动补全选中的命令
      const selected = state.searchMatches[state.selectedMatchIndex];
      if (selected) {
        // 提取命令部分（去掉前面的空格和斜杠）
        const command = selected.trim().slice(1);
        state.inputBuffer = `/${command.split(" ")[0]}`;

        // 补全后退出搜索状态
        state.isSearching = false;
        state.searchMatches = [];
        state.selectedMatchIndex = -1;
        state.status = "Ready";
      }
      renderScreen(state, runtimeRef);
      return;
    }

    if (!str || key.ctrl || key.meta) {
      return;
    }

    state.inputBuffer = state.inputBuffer.slice(0, state.cursorPosition) + str + state.inputBuffer.slice(state.cursorPosition);
    state.cursorPosition += str.length;

    // 只要输入以斜杠开头，就更新搜索结果
    if (state.inputBuffer.startsWith("/")) {
      state.isSearching = true;
      const matches = autoCompleteSlashCommand(state.inputBuffer);
      if (matches) {
        state.searchMatches = matches;
        state.selectedMatchIndex = 0;
        state.status = "正在匹配命令";
      } else {
        state.searchMatches = [];
        state.selectedMatchIndex = -1;
        state.status = "无匹配命令";
      }
    } else {
      // 如果输入不再以斜杠开头，退出搜索状态
      state.isSearching = false;
      state.searchMatches = [];
      state.selectedMatchIndex = -1;
      state.status = "Ready";
    }

    renderScreen(state, runtimeRef);
  };

  output.write("\x1b[?1049h\x1b[?25l");
  readline.emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  input.on("keypress", onKeypress);
  output.on("resize", onResize);
  renderScreen(state, runtimeRef);

  while (!exiting) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  cleanup();
}
