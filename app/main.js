import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// app/main.ts
import { cwd } from "process";
import { pathToFileURL } from "url";

// app/headless.ts
import { writeFile as writeFile3 } from "fs/promises";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

// runtime/state.ts
function createInitialAppState() {
  return {
    permissionContext: {
      mode: "default",
      allowRules: [],
      denyRules: [],
      askRules: []
    },
    messages: [],
    tasks: {}
  };
}

// storage/transcript.ts
import { appendFile, mkdir, rm } from "fs/promises";
import { join } from "path";
function getTranscriptPath(cwd, sessionId) {
  return join(cwd, ".claude-code-lite", "transcripts", `${sessionId}.jsonl`);
}
async function appendTranscript(cwd, sessionId, messages) {
  const filePath = getTranscriptPath(cwd, sessionId);
  await mkdir(join(cwd, ".claude-code-lite", "transcripts"), {
    recursive: true
  });
  const lines = messages.map((message) => JSON.stringify(message)).join(`
`);
  await appendFile(filePath, `${lines}
`, "utf8");
}
async function readTranscriptMessages(cwd, sessionId) {
  const { readFile } = await import("fs/promises");
  const filePath = getTranscriptPath(cwd, sessionId);
  const content = await readFile(filePath, "utf8");
  return content.split(`
`).map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
}
async function deleteTranscript(cwd, sessionId) {
  await rm(getTranscriptPath(cwd, sessionId), { force: true });
}

// storage/sessionIndex.ts
import { mkdir as mkdir2, readFile, readdir, rm as rm2, stat, writeFile } from "fs/promises";
import { join as join2 } from "path";
function getSessionsDir(cwd) {
  return join2(cwd, ".claude-code-lite", "sessions");
}
function getTranscriptsDir(cwd) {
  return join2(cwd, ".claude-code-lite", "transcripts");
}
function getSessionInfoPath(cwd, sessionId) {
  return join2(getSessionsDir(cwd), `${sessionId}.json`);
}
function getTranscriptPath2(cwd, sessionId) {
  return join2(getTranscriptsDir(cwd), `${sessionId}.jsonl`);
}
function getSessionInfoFilePath(cwd, sessionId) {
  return getSessionInfoPath(cwd, sessionId);
}
function summarizeText(text, maxLength = 80) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}
function extractUserPrompts(messages) {
  return messages.filter((message) => message.type === "user").map((message) => summarizeText(message.content, 120));
}
function deriveSessionTitle(messages, sessionId) {
  const firstUser = messages.find((message) => message.type === "user");
  if (firstUser) {
    return summarizeText(firstUser.content, 72);
  }
  return `session ${sessionId}`;
}
function deriveSessionSummary(messages, status, lastTool, errorCount) {
  const prompts = extractUserPrompts(messages);
  const latestPrompt = prompts[prompts.length - 1];
  const errorSuffix = errorCount && errorCount > 0 ? ` · ${errorCount} error${errorCount > 1 ? "s" : ""}` : "";
  const prefix = status === "needs_attention" ? `needs attention${errorSuffix}` : `ready${errorSuffix}`;
  if (lastTool && latestPrompt) {
    return summarizeText(`${prefix} · ${lastTool} · ${latestPrompt}`, 120);
  }
  if (lastTool) {
    return summarizeText(`${prefix} · ${lastTool}`, 120);
  }
  if (latestPrompt) {
    return summarizeText(`${prefix} · ${latestPrompt}`, 120);
  }
  return status ? prefix : undefined;
}
function getSessionStatus(messages) {
  let lastTool;
  let lastError;
  let toolUseCount = 0;
  let errorCount = 0;
  for (const message of messages) {
    if (message.type === "assistant") {
      for (const block of message.content) {
        if (block.type === "tool_use") {
          lastTool = block.name;
          toolUseCount += 1;
        }
      }
      continue;
    }
    if (message.type === "tool_result" && message.isError) {
      lastError = summarizeText(message.content, 160);
      errorCount += 1;
    }
  }
  return {
    status: lastError ? "needs_attention" : "ready",
    lastTool,
    lastError,
    toolUseCount,
    errorCount
  };
}
function getConfiguredProvider() {
  return process.env.CCL_LLM_PROVIDER?.trim() || undefined;
}
function getConfiguredModel() {
  return process.env.CCL_LLM_MODEL?.trim() || undefined;
}
async function readSessionInfo(cwd, sessionId) {
  try {
    const content = await readFile(getSessionInfoPath(cwd, sessionId), "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
async function updateSessionInfo(cwd, sessionId, messages) {
  const previous = await readSessionInfo(cwd, sessionId);
  const prompts = extractUserPrompts(messages);
  const now = new Date().toISOString();
  const sessionStatus = getSessionStatus(messages);
  const next = {
    id: sessionId,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    messageCount: messages.length,
    title: previous?.title || deriveSessionTitle(messages, sessionId),
    summary: deriveSessionSummary(messages, sessionStatus.status, sessionStatus.lastTool, sessionStatus.errorCount) || previous?.summary,
    firstPrompt: prompts[0],
    lastPrompt: prompts[prompts.length - 1],
    provider: getConfiguredProvider() || previous?.provider,
    model: getConfiguredModel() || previous?.model,
    ...sessionStatus
  };
  await mkdir2(getSessionsDir(cwd), { recursive: true });
  await writeFile(getSessionInfoPath(cwd, sessionId), `${JSON.stringify(next, null, 2)}
`, "utf8");
  return next;
}
async function listSessions(cwd) {
  const infos = new Map;
  try {
    const entries = await readdir(getSessionsDir(cwd));
    for (const entry of entries) {
      if (!entry.endsWith(".json")) {
        continue;
      }
      const sessionId = entry.replace(/\.json$/, "");
      const info = await readSessionInfo(cwd, sessionId);
      if (info) {
        infos.set(sessionId, info);
      }
    }
  } catch {}
  try {
    const entries = await readdir(getTranscriptsDir(cwd));
    for (const entry of entries) {
      if (!entry.endsWith(".jsonl")) {
        continue;
      }
      const sessionId = entry.replace(/\.jsonl$/, "");
      if (!infos.has(sessionId)) {
        infos.set(sessionId, { id: sessionId });
      }
      const current = infos.get(sessionId);
      if (current && !current.title && !current.updatedAt) {
        try {
          const content = await readFile(getTranscriptPath2(cwd, sessionId), "utf8");
          const messages = content.split(`
`).map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
          const prompts = extractUserPrompts(messages);
          const sessionStatus = getSessionStatus(messages);
          infos.set(sessionId, {
            ...current,
            title: deriveSessionTitle(messages, sessionId),
            summary: deriveSessionSummary(messages, sessionStatus.status, sessionStatus.lastTool, sessionStatus.errorCount),
            firstPrompt: prompts[0],
            lastPrompt: prompts[prompts.length - 1],
            messageCount: messages.length,
            updatedAt: (await stat(getTranscriptPath2(cwd, sessionId)).catch(() => null))?.mtime.toISOString() || current.updatedAt,
            ...sessionStatus
          });
        } catch {}
      }
    }
  } catch {}
  return [...infos.values()].sort((left, right) => {
    const leftRank = left.status === "needs_attention" ? 0 : 1;
    const rightRank = right.status === "needs_attention" ? 0 : 1;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    const leftTime = left.updatedAt || left.createdAt || "";
    const rightTime = right.updatedAt || right.createdAt || "";
    return rightTime.localeCompare(leftTime);
  });
}
async function deleteSessionInfo(cwd, sessionId) {
  await rm2(getSessionInfoPath(cwd, sessionId), { force: true });
}

// runtime/usage.ts
function emptyUsage() {
  return {
    inputTokens: 0,
    outputTokens: 0
  };
}

// runtime/session.ts
class SessionEngine {
  config;
  messages = [];
  usage = emptyUsage();
  constructor(config) {
    this.config = config;
  }
  get sessionId() {
    return this.config.id;
  }
  get cwd() {
    return this.config.cwd;
  }
  getMessages() {
    return [...this.messages];
  }
  appendMessage(message) {
    this.messages.push(message);
  }
  hydrateMessages(messages) {
    this.messages = [...messages];
  }
  async recordMessages(messages) {
    this.messages.push(...messages);
    await appendTranscript(this.cwd, this.sessionId, messages);
    await updateSessionInfo(this.cwd, this.sessionId, this.messages);
  }
  getTranscriptPath() {
    return getTranscriptPath(this.cwd, this.sessionId);
  }
  getUsage() {
    return { ...this.usage };
  }
}

// permissions/engine.ts
function getInputPattern(input) {
  if (typeof input !== "object" || input === null) {
    return;
  }
  if ("path" in input && typeof input.path === "string" && input.path.trim()) {
    return input.path.trim();
  }
  if ("command" in input && typeof input.command === "string" && input.command.trim()) {
    return input.command.trim();
  }
  if ("url" in input && typeof input.url === "string" && input.url.trim()) {
    return input.url.trim();
  }
  if ("description" in input && typeof input.description === "string" && input.description.trim()) {
    return input.description.trim();
  }
  return;
}
function matchesRule(rule, tool, input) {
  if (rule.toolName !== tool.name) {
    return false;
  }
  if (!rule.pattern) {
    return true;
  }
  return getInputPattern(input) === rule.pattern;
}
function rememberPermissionRule(context, tool, input) {
  const rule = {
    toolName: tool.name,
    pattern: getInputPattern(input)
  };
  context.setAppState((prev) => {
    const exists = prev.permissionContext.allowRules.some((existing) => existing.toolName === rule.toolName && existing.pattern === rule.pattern);
    if (exists) {
      return prev;
    }
    return {
      ...prev,
      permissionContext: {
        ...prev.permissionContext,
        allowRules: [...prev.permissionContext.allowRules, rule]
      }
    };
  });
  return rule;
}
var canUseTool = async (tool, input, context, _parentMessage, _toolUseId) => {
  const validation = await tool.validateInput?.(input, context);
  if (validation && !validation.result) {
    return {
      behavior: "deny",
      message: validation.message
    };
  }
  const permissionContext = context.getAppState().permissionContext;
  const mode = permissionContext.mode;
  if (mode === "bypassPermissions" || mode === "acceptEdits") {
    return {
      behavior: "allow",
      updatedInput: input
    };
  }
  if (permissionContext.denyRules.some((rule) => matchesRule(rule, tool, input))) {
    return {
      behavior: "deny",
      message: `Tool ${tool.name} is blocked by a session rule`
    };
  }
  if (permissionContext.allowRules.some((rule) => matchesRule(rule, tool, input))) {
    return {
      behavior: "allow",
      updatedInput: input
    };
  }
  if (permissionContext.askRules.some((rule) => matchesRule(rule, tool, input))) {
    return {
      behavior: "ask",
      message: `Tool ${tool.name} requires confirmation by a session rule`,
      updatedInput: input
    };
  }
  const toolDecision = await tool.checkPermissions?.(input, context);
  if (toolDecision) {
    return toolDecision;
  }
  if (tool.isReadOnly(input)) {
    return {
      behavior: "allow",
      updatedInput: input
    };
  }
  return {
    behavior: "ask",
    message: `Tool ${tool.name} requires confirmation`,
    updatedInput: input
  };
};

// tools/agent/runAgent.ts
async function runAgent(params) {
  const subagentType = params.subagentType ?? "general-purpose";
  return [
    `Subagent "${subagentType}" accepted the task.`,
    `Description: ${params.description}`,
    `Prompt length: ${params.prompt.length} characters`,
    "This educational runtime does not call a model yet; it only exercises the delegation path."
  ].join(`
`);
}

// shared/ids.ts
import { randomUUID } from "crypto";
function createId(prefix = "id") {
  return `${prefix}-${randomUUID()}`;
}

// tools/agent/subagentContext.ts
function createSubagentContext(parent, overrides) {
  return {
    ...parent,
    messages: overrides?.messages ?? parent.messages,
    agentId: overrides?.agentId ?? parent.agentId ?? createId("agent"),
    agentType: overrides?.agentType,
    abortController: overrides?.abortController ?? (overrides?.shareAbortController ? parent.abortController : new AbortController),
    setAppState: overrides?.shareSetAppState ? parent.setAppState : () => {}
  };
}

// tools/agent/agentTool.ts
var AgentTool = {
  name: "Agent",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Launch a subagent";
  },
  async call(args, context, _canUseTool, _parentMessage) {
    createSubagentContext(context, {
      agentType: args.subagentType
    });
    const result = await runAgent({
      description: args.description,
      prompt: args.prompt,
      subagentType: args.subagentType
    });
    return {
      data: {
        status: "completed",
        result
      }
    };
  },
  async validateInput(input) {
    if (!input.description.trim()) {
      return { result: false, message: "Description is required" };
    }
    if (!input.prompt.trim()) {
      return { result: false, message: "Prompt is required" };
    }
    return { result: true };
  },
  async checkPermissions(input, context) {
    if (context.getAppState().permissionContext.mode === "default") {
      return {
        behavior: "ask",
        message: `Agent launch requires confirmation for "${input.description}"`
      };
    }
    return {
      behavior: "allow",
      updatedInput: input
    };
  },
  isReadOnly() {
    return false;
  },
  isConcurrencySafe() {
    return false;
  }
};

// shared/fs.ts
import { mkdir as mkdir3, readFile as readFile2, writeFile as writeFile2 } from "fs/promises";
import { dirname, resolve } from "path";
function resolvePathFromCwd(cwd, inputPath) {
  return resolve(cwd, inputPath);
}
async function readTextFile(path) {
  return readFile2(path, "utf8");
}
async function writeTextFile(path, content) {
  await mkdir3(dirname(path), { recursive: true });
  await writeFile2(path, content, "utf8");
  return Buffer.byteLength(content, "utf8");
}

// tools/files/editTool.ts
var EditTool = {
  name: "Edit",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Edit a file in place";
  },
  async call(args, context, _canUseTool, _parentMessage) {
    const absolutePath = resolvePathFromCwd(context.cwd, args.path);
    const content = await readTextFile(absolutePath);
    if (!content.includes(args.oldString)) {
      throw new Error(`Could not find target string in ${args.path}`);
    }
    const updated = content.replace(args.oldString, args.newString);
    await writeTextFile(absolutePath, updated);
    return {
      data: {
        applied: true
      }
    };
  },
  async validateInput(input) {
    if (!input?.path || typeof input.path !== "string" || !input.path.trim()) {
      return { result: false, message: "Path is required" };
    }
    if (typeof input.oldString !== "string") {
      return { result: false, message: "oldString must be a string" };
    }
    if (typeof input.newString !== "string") {
      return { result: false, message: "newString must be a string" };
    }
    if (input.oldString === input.newString) {
      return { result: false, message: "oldString and newString must differ" };
    }
    return { result: true };
  },
  async checkPermissions(input, context) {
    if (context.getAppState().permissionContext.mode === "default") {
      return {
        behavior: "ask",
        message: `Edit requires confirmation for ${input.path}`
      };
    }
    return {
      behavior: "allow",
      updatedInput: input
    };
  },
  isReadOnly() {
    return false;
  },
  isConcurrencySafe() {
    return true;
  }
};

// tools/files/readTool.ts
var ReadTool = {
  name: "Read",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Read a file";
  },
  async call(args, context, _canUseTool, _parentMessage) {
    const absolutePath = resolvePathFromCwd(context.cwd, args.path);
    const content = await readTextFile(absolutePath);
    return {
      data: {
        content
      }
    };
  },
  async validateInput(input) {
    if (!input?.path || typeof input.path !== "string" || !input.path.trim()) {
      return { result: false, message: "Path is required" };
    }
    return { result: true };
  },
  async checkPermissions(input) {
    return {
      behavior: "allow",
      updatedInput: input
    };
  },
  isReadOnly() {
    return true;
  },
  isConcurrencySafe() {
    return true;
  }
};

// tools/files/writeTool.ts
var WriteTool = {
  name: "Write",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Write a file";
  },
  async call(args, context, _canUseTool, _parentMessage) {
    const absolutePath = resolvePathFromCwd(context.cwd, args.path);
    const bytesWritten = await writeTextFile(absolutePath, args.content);
    return {
      data: {
        bytesWritten
      }
    };
  },
  async validateInput(input) {
    if (!input?.path || typeof input.path !== "string" || !input.path.trim()) {
      return { result: false, message: "Path is required" };
    }
    if (typeof input.content !== "string") {
      return { result: false, message: "Content must be a string" };
    }
    return { result: true };
  },
  async checkPermissions(input, context) {
    if (context.getAppState().permissionContext.mode === "default") {
      return {
        behavior: "ask",
        message: `Write requires confirmation for ${input.path}`
      };
    }
    return {
      behavior: "allow",
      updatedInput: input
    };
  },
  isReadOnly() {
    return false;
  },
  isConcurrencySafe() {
    return true;
  }
};

// tools/shell/shellTool.ts
import { spawn } from "child_process";
var ShellTool = {
  name: "Shell",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Run a shell command";
  },
  async call(args, context, _canUseTool, _parentMessage) {
    const data = await new Promise((resolve2, reject) => {
      const child = spawn(args.command, {
        cwd: context.cwd,
        shell: true,
        signal: context.abortController.signal
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        resolve2({
          stdout,
          stderr,
          exitCode: code ?? 0
        });
      });
    });
    return {
      data
    };
  },
  async validateInput(input) {
    if (!input?.command || !String(input.command).trim()) {
      return { result: false, message: "Command is required" };
    }
    return { result: true };
  },
  async checkPermissions(input, context) {
    if (context.getAppState().permissionContext.mode === "default") {
      return {
        behavior: "ask",
        message: `Shell requires confirmation for "${input.command}"`
      };
    }
    return {
      behavior: "allow",
      updatedInput: input
    };
  },
  isReadOnly() {
    return false;
  },
  isConcurrencySafe() {
    return false;
  }
};

// tools/web/fetchTool.ts
var WebFetchTool = {
  name: "WebFetch",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Fetch and process a URL";
  },
  async call(args, _context, _canUseTool, _parentMessage) {
    const response = await fetch(args.url);
    const content = await response.text();
    const snippet = content.slice(0, 1200);
    const result = args.prompt.trim() ? `Prompt: ${args.prompt}

Fetched snippet:
${snippet}` : snippet;
    return {
      data: {
        result
      }
    };
  },
  async validateInput(input) {
    try {
      new URL(input.url);
    } catch {
      return { result: false, message: "A valid URL is required" };
    }
    return { result: true };
  },
  async checkPermissions(input) {
    return {
      behavior: "allow",
      updatedInput: input
    };
  },
  isReadOnly() {
    return true;
  },
  isConcurrencySafe() {
    return true;
  }
};

// tools/registry.ts
function getTools() {
  return [ReadTool, WriteTool, EditTool, ShellTool, WebFetchTool, AgentTool];
}

// tools/Tool.ts
function findToolByName(tools, name) {
  return tools.find((tool) => tool.name === name);
}

// runtime/llm.ts
function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
function getDefaultBaseUrl(provider) {
  return provider === "anthropic" ? "https://api.anthropic.com/v1" : "https://api.openai.com/v1";
}
function getLlmConfigFromEnv() {
  const apiKey = process.env.CCL_LLM_API_KEY?.trim();
  const model = process.env.CCL_LLM_MODEL?.trim();
  if (!apiKey || !model) {
    return null;
  }
  const provider = process.env.CCL_LLM_PROVIDER?.trim().toLowerCase() === "anthropic" ? "anthropic" : "openai";
  return {
    provider,
    apiKey,
    model,
    baseUrl: stripTrailingSlash(process.env.CCL_LLM_BASE_URL?.trim() || getDefaultBaseUrl(provider)),
    systemPrompt: process.env.CCL_LLM_SYSTEM_PROMPT?.trim(),
    anthropicVersion: process.env.CCL_ANTHROPIC_VERSION?.trim() || "2023-06-01"
  };
}
function extractOpenAiText(content) {
  if (typeof content === "string") {
    return content;
  }
  if (typeof content === "object" && content !== null && "text" in content && typeof content.text === "string") {
    return content.text;
  }
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === "undefined") {
        return "";
      }
      if (typeof part === "object" && part !== null && "text" in part && typeof part.text === "string") {
        return part.text;
      }
      return "";
    }).filter(Boolean).join(`
`);
  }
  return "";
}
function parseToolArguments(raw) {
  if (raw === null || raw === undefined) {
    return {};
  }
  const rawType = typeof raw;
  if (rawType !== "string") {
    try {
      return JSON.parse(String(raw));
    } catch {
      return {};
    }
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return { raw };
  }
}
function toOpenAiMessages(messages, systemPrompt, config) {
  const apiMessages = [];
  const allSystem = [...systemPrompt];
  if (config.systemPrompt) {
    allSystem.push(config.systemPrompt);
  }
  if (allSystem.length > 0) {
    apiMessages.push({
      role: "system",
      content: allSystem.join(`

`)
    });
  }
  for (const message of messages) {
    if (message.type === "user") {
      apiMessages.push({ role: "user", content: message.content });
      continue;
    }
    if (message.type === "tool_result") {
      apiMessages.push({
        role: "tool",
        tool_call_id: message.toolUseId,
        content: message.content
      });
      continue;
    }
    const textBlocks = message.content.filter((block) => block.type === "text").map((block) => block.text);
    const toolBlocks = message.content.filter((block) => block.type === "tool_use");
    apiMessages.push({
      role: "assistant",
      content: textBlocks.length > 0 ? textBlocks.join(`

`) : null,
      tool_calls: toolBlocks.length > 0 ? toolBlocks.map((block) => ({
        id: block.id,
        type: "function",
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input ?? {})
        }
      })) : undefined
    });
  }
  return apiMessages;
}
function toAnthropicMessages(messages) {
  const apiMessages = [];
  for (const message of messages) {
    if (message.type === "user") {
      apiMessages.push({
        role: "user",
        content: [{ type: "text", text: message.content }]
      });
      continue;
    }
    if (message.type === "tool_result") {
      apiMessages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: message.toolUseId,
            content: message.content,
            is_error: message.isError
          }
        ]
      });
      continue;
    }
    apiMessages.push({
      role: "assistant",
      content: message.content.map((block) => block.type === "text" ? { type: "text", text: block.text } : {
        type: "tool_use",
        id: block.id,
        name: block.name,
        input: block.input
      })
    });
  }
  return apiMessages;
}
async function readSseEvents(response, onEvent) {
  if (!response.body) {
    throw new Error("Streaming response body is missing");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder;
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(`

`);
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      let eventName = null;
      for (const line of frame.split(`
`)) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        if (trimmed.startsWith("event:")) {
          eventName = trimmed.slice(6).trim();
          continue;
        }
        if (!trimmed.startsWith("data:")) {
          continue;
        }
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") {
          continue;
        }
        onEvent(eventName, data);
      }
    }
  }
}
var openAiProvider = {
  async runTurn(params, config) {
    const toolCallsByIndex = new Map;
    let accumulatedText = "";
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        stream: true,
        messages: toOpenAiMessages(params.messages, params.systemPrompt, config),
        tools: params.tools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        }))
      })
    });
    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error?.message || `LLM request failed with status ${response.status}`);
    }
    await readSseEvents(response, (_event, data) => {
      const payload = JSON.parse(data);
      const delta = payload.choices?.[0]?.delta;
      if (!delta) {
        return;
      }
      if (delta.content !== undefined && delta.content !== null) {
        const textContent = extractOpenAiText(delta.content);
        if (textContent.length > 0) {
          accumulatedText += textContent;
          params.onTextDelta?.(accumulatedText);
        }
      }
      for (const partial of delta.tool_calls ?? []) {
        const existing = toolCallsByIndex.get(partial.index) ?? {
          id: "",
          name: "",
          arguments: ""
        };
        if (partial.id) {
          existing.id = partial.id;
        }
        if (partial.function?.name) {
          existing.name = partial.function.name;
        }
        if (partial.function?.arguments) {
          existing.arguments += partial.function.arguments;
        }
        toolCallsByIndex.set(partial.index, existing);
      }
    });
    return {
      text: accumulatedText.trim(),
      toolCalls: [...toolCallsByIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, toolCall]) => ({
        id: toolCall.id,
        name: toolCall.name,
        input: parseToolArguments(toolCall.arguments)
      }))
    };
  }
};
var anthropicProvider = {
  async runTurn(params, config) {
    const systemParts = [...params.systemPrompt];
    if (config.systemPrompt) {
      systemParts.push(config.systemPrompt);
    }
    const response = await fetch(`${config.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": config.anthropicVersion || "2023-06-01"
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 2048,
        stream: true,
        system: systemParts.join(`

`),
        messages: toAnthropicMessages(params.messages),
        tools: params.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters
        }))
      })
    });
    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error?.message || `LLM request failed with status ${response.status}`);
    }
    let accumulatedText = "";
    const toolCallsByIndex = new Map;
    await readSseEvents(response, (event, data) => {
      if (event === "error") {
        const payload2 = JSON.parse(data);
        throw new Error(payload2.error?.message || "Anthropic streaming error");
      }
      const payload = JSON.parse(data);
      if (event === "content_block_start" && payload.content_block) {
        if (payload.content_block.type === "tool_use") {
          toolCallsByIndex.set(payload.index ?? 0, {
            id: payload.content_block.id ?? "",
            name: payload.content_block.name ?? "",
            inputJson: payload.content_block.input ? JSON.stringify(payload.content_block.input) : "",
            input: payload.content_block.input
          });
          return;
        }
        if (payload.content_block.type === "text" && typeof payload.content_block.text === "string" && payload.content_block.text.length > 0) {
          accumulatedText += payload.content_block.text;
          params.onTextDelta?.(accumulatedText);
        }
        return;
      }
      if (event === "content_block_delta" && payload.delta) {
        if (payload.delta.type === "text_delta" && typeof payload.delta.text === "string") {
          accumulatedText += payload.delta.text;
          params.onTextDelta?.(accumulatedText);
          return;
        }
        if (payload.delta.type === "input_json_delta" && typeof payload.delta.partial_json === "string") {
          const existing = toolCallsByIndex.get(payload.index ?? 0) ?? {
            id: "",
            name: "",
            inputJson: ""
          };
          existing.inputJson += payload.delta.partial_json;
          toolCallsByIndex.set(payload.index ?? 0, existing);
        }
      }
    });
    return {
      text: accumulatedText.trim(),
      toolCalls: [...toolCallsByIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, toolCall]) => ({
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.input !== undefined ? toolCall.input : parseToolArguments(toolCall.inputJson)
      }))
    };
  }
};
function getProvider(config) {
  return config.provider === "anthropic" ? anthropicProvider : openAiProvider;
}
async function runLlmTurn(params) {
  const config = getLlmConfigFromEnv();
  if (!config) {
    throw new Error("LLM is not configured");
  }
  return getProvider(config).runTurn(params, config);
}

// runtime/query.ts
function truncate(value, maxLength = 500) {
  if (!value || value.length === 0) {
    return "";
  }
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}
...`;
}
function stringify(value) {
  return JSON.stringify(value, null, 2);
}
function createAssistantMessage(blocks) {
  return {
    id: createId("assistant"),
    type: "assistant",
    content: blocks
  };
}
function createAssistantTextMessage(text) {
  return createAssistantMessage([
    {
      type: "text",
      text
    }
  ]);
}
function createToolResultMessage(toolUseId, content, isError = false) {
  return {
    id: createId("tool-result"),
    type: "tool_result",
    toolUseId,
    content,
    isError
  };
}
function summarizeReadResult(result) {
  const content = typeof result === "object" && result !== null && "content" in result && typeof result.content === "string" ? result.content : stringify(result);
  return `我已经读取了目标内容。下面是预览：

${truncate(content, 1200)}`;
}
function summarizeShellResult(result) {
  if (typeof result === "object" && result !== null && "stdout" in result && "stderr" in result && "exitCode" in result) {
    const stdout = typeof result.stdout === "string" ? truncate(result.stdout, 800) : "";
    const stderr = typeof result.stderr === "string" ? truncate(result.stderr, 400) : "";
    const exitCode = typeof result.exitCode === "number" ? result.exitCode : "unknown";
    return [
      `命令已执行，退出码：${exitCode}。`,
      stdout ? `stdout:
${stdout}` : "",
      stderr ? `stderr:
${stderr}` : ""
    ].filter(Boolean).join(`

`);
  }
  return `命令已执行。

${truncate(stringify(result), 1200)}`;
}
function planPrompt(prompt) {
  const trimmed = prompt.trim();
  const readMatch = trimmed.match(/^(?:read|open|show|cat)\s+(.+)$/i) ?? trimmed.match(/^(?:读取|查看|打开)\s+(.+)$/);
  if (readMatch) {
    const path = readMatch[1].trim().replace(/^["']|["']$/g, "");
    return {
      kind: "tool",
      toolName: "Read",
      input: { path },
      intro: `我会先读取 \`${path}\`。`,
      summarizeResult: summarizeReadResult,
      summarizeError: (message) => `读取 \`${path}\` 失败：${message}`
    };
  }
  const shellMatch = trimmed.match(/^(?:run|exec|execute|shell|bash)\s+(.+)$/i) ?? trimmed.match(/^(?:执行|运行命令)\s+(.+)$/);
  if (shellMatch) {
    const command = shellMatch[1].trim();
    return {
      kind: "tool",
      toolName: "Shell",
      input: { command },
      intro: `我会执行命令：\`${command}\`。`,
      summarizeResult: summarizeShellResult,
      summarizeError: (message) => `命令执行失败：${message}`
    };
  }
  const fetchMatch = trimmed.match(/^(?:fetch|visit|open-url)\s+(https?:\/\/\S+)(?:\s+(.+))?$/i) ?? trimmed.match(/^(?:抓取|访问)\s+(https?:\/\/\S+)(?:\s+(.+))?$/);
  if (fetchMatch) {
    const url = fetchMatch[1];
    const fetchPrompt = fetchMatch[2]?.trim() ?? "";
    return {
      kind: "tool",
      toolName: "WebFetch",
      input: { url, prompt: fetchPrompt },
      intro: `我会抓取 ${url}。`,
      summarizeResult: (result) => `网页抓取完成。以下是结果预览：

${truncate(stringify(result), 1200)}`,
      summarizeError: (message) => `抓取 ${url} 失败：${message}`
    };
  }
  const writeMatch = trimmed.match(/^(?:write|create|save)\s+(\S+)\s+(.+)$/i) ?? trimmed.match(/^(?:写入|创建文件)\s+(\S+)\s+(.+)$/);
  if (writeMatch) {
    const path = writeMatch[1].trim();
    const content = writeMatch[2];
    return {
      kind: "tool",
      toolName: "Write",
      input: { path, content },
      intro: `我会把内容写入 \`${path}\`。`,
      summarizeResult: (result) => `写入完成：\`${path}\`。

${stringify(result)}`,
      summarizeError: (message) => `写入 \`${path}\` 失败：${message}`
    };
  }
  const editMatch = trimmed.match(/^(?:edit|replace)\s+(\S+)\s+(.+?)\s*(?:=>|->)\s*(.+)$/i) ?? trimmed.match(/^(?:编辑|替换)\s+(\S+)\s+(.+?)\s*(?:=>|->|为)\s*(.+)$/);
  if (editMatch) {
    const path = editMatch[1].trim();
    const oldString = editMatch[2];
    const newString = editMatch[3];
    return {
      kind: "tool",
      toolName: "Edit",
      input: { path, oldString, newString },
      intro: `我会编辑 \`${path}\`，替换指定内容。`,
      summarizeResult: () => `编辑完成：\`${path}\` 已更新。`,
      summarizeError: (message) => `编辑 \`${path}\` 失败：${message}`
    };
  }
  return {
    kind: "text",
    text: [
      "我现在支持一组本地 agent 动作，但当前没有可用的远程 LLM 配置。",
      "你可以设置这些环境变量来接入兼容 OpenAI Chat Completions 的模型：",
      "- `CCL_LLM_API_KEY`",
      "- `CCL_LLM_MODEL`",
      "- `CCL_LLM_BASE_URL` 可选，默认 `https://api.openai.com/v1`",
      "在未配置 LLM 时，也可以直接给我这些格式的提示：",
      "- `read README.md`",
      "- `run pwd`",
      "- `fetch https://example.com`",
      "- `write notes.txt hello world`",
      "- `edit notes.txt hello => hi`",
      "也可以输入 `/help` 查看 TUI 内建命令。"
    ].join(`
`)
  };
}
function getDefaultSystemPrompt() {
  return [
    "You are Claude Code-lite, a local CLI coding assistant.",
    "Use tools when the user asks you to inspect files, edit files, run shell commands, fetch URLs, or delegate to an agent.",
    "Prefer concise Chinese responses for user-facing text.",
    "When a tool is needed, emit tool calls instead of describing what you would do.",
    "After receiving tool results, continue until you can answer the user clearly."
  ];
}
function getToolDefinitions() {
  return [
    {
      name: "Read",
      description: "Read a text file from the current working directory.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative or absolute file path."
          }
        },
        required: ["path"],
        additionalProperties: false
      }
    },
    {
      name: "Write",
      description: "Write text content to a file, creating or overwriting it.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to write." },
          content: { type: "string", description: "Full file content." }
        },
        required: ["path", "content"],
        additionalProperties: false
      }
    },
    {
      name: "Edit",
      description: "Replace one string with another inside a file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to edit." },
          oldString: {
            type: "string",
            description: "Existing text to replace."
          },
          newString: { type: "string", description: "Replacement text." }
        },
        required: ["path", "oldString", "newString"],
        additionalProperties: false
      }
    },
    {
      name: "Shell",
      description: "Run a shell command in the current working directory.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute." }
        },
        required: ["command"],
        additionalProperties: false
      }
    },
    {
      name: "WebFetch",
      description: "Fetch a URL and return a processed text snippet.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "HTTP or HTTPS URL." },
          prompt: {
            type: "string",
            description: "Optional guidance describing what to extract from the page."
          }
        },
        required: ["url", "prompt"],
        additionalProperties: false
      }
    },
    {
      name: "Agent",
      description: "Launch a simple subagent for delegated work.",
      parameters: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "Short task description."
          },
          prompt: {
            type: "string",
            description: "Prompt to send to the subagent."
          },
          subagentType: {
            type: "string",
            description: "Optional subagent type or role name."
          }
        },
        required: ["description", "prompt"],
        additionalProperties: false
      }
    }
  ];
}
async function* executeToolCall(params, toolUseMessage, toolUseBlock) {
  const tool = findToolByName(getTools(), toolUseBlock.name);
  if (!tool) {
    yield createToolResultMessage(toolUseBlock.id, stringify({ error: `Unknown tool ${toolUseBlock.name}` }), true);
    return;
  }
  let effectiveInput = toolUseBlock.input;
  const permission = await params.canUseTool(tool, effectiveInput, params.toolUseContext, toolUseMessage, toolUseBlock.id);
  if (permission.behavior === "deny") {
    yield createToolResultMessage(toolUseBlock.id, stringify({ error: permission.message }), true);
    return;
  }
  if (permission.behavior === "ask") {
    const allowed = await params.onPermissionRequest?.({
      toolName: toolUseBlock.name,
      input: effectiveInput,
      message: permission.message
    });
    if (!allowed) {
      yield createToolResultMessage(toolUseBlock.id, stringify({ error: `User rejected ${toolUseBlock.name}` }), true);
      return;
    }
    if (permission.updatedInput) {
      effectiveInput = permission.updatedInput;
    }
  } else if (permission.updatedInput) {
    effectiveInput = permission.updatedInput;
  }
  try {
    const result = await tool.call(effectiveInput, params.toolUseContext, params.canUseTool, toolUseMessage);
    yield createToolResultMessage(toolUseBlock.id, stringify(result.data));
    if (result.extraMessages) {
      for (const extraMessage of result.extraMessages) {
        yield extraMessage;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    yield createToolResultMessage(toolUseBlock.id, stringify({ error: message }), true);
  }
}
async function* queryWithPlanner(params) {
  const planned = planPrompt(params.prompt);
  if (planned.kind === "text") {
    yield createAssistantTextMessage(planned.text);
    return;
  }
  const introMessage = createAssistantTextMessage(planned.intro);
  yield introMessage;
  const toolUseMessage = createAssistantMessage([
    {
      type: "tool_use",
      id: createId("tool-use"),
      name: planned.toolName,
      input: planned.input
    }
  ]);
  yield toolUseMessage;
  const toolUseBlock = toolUseMessage.content[0];
  if (toolUseBlock.type !== "tool_use") {
    yield createAssistantTextMessage("内部错误：tool_use block 缺失。");
    return;
  }
  let toolResultMessage = null;
  for await (const message of executeToolCall(params, toolUseMessage, toolUseBlock)) {
    toolResultMessage = message.type === "tool_result" ? message : toolResultMessage;
    yield message;
  }
  if (!toolResultMessage) {
    yield createAssistantTextMessage(`执行 ${planned.toolName} 时没有产生结果。`);
    return;
  }
  if (toolResultMessage.isError) {
    const content = JSON.parse(toolResultMessage.content);
    yield createAssistantTextMessage(planned.summarizeError(content.error ?? "Unknown error"));
    return;
  }
  const result = JSON.parse(toolResultMessage.content);
  yield createAssistantTextMessage(planned.summarizeResult(result));
}
async function* queryWithLlm(params) {
  const conversation = [...params.messages];
  const maxTurns = params.maxTurns ?? 8;
  const systemPrompt = [...getDefaultSystemPrompt(), ...params.systemPrompt];
  for (let turn = 0;turn < maxTurns; turn += 1) {
    const llmResponse = await runLlmTurn({
      messages: conversation,
      systemPrompt,
      tools: getToolDefinitions(),
      onTextDelta: params.onAssistantTextDelta
    });
    if (!llmResponse.text && llmResponse.toolCalls.length === 0) {
      yield createAssistantTextMessage("模型没有返回任何内容。");
      return;
    }
    const assistantBlocks = [];
    if (llmResponse.text) {
      assistantBlocks.push({
        type: "text",
        text: llmResponse.text
      });
    }
    for (const toolCall of llmResponse.toolCalls) {
      assistantBlocks.push({
        type: "tool_use",
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.input
      });
    }
    const assistantMessage = createAssistantMessage(assistantBlocks);
    conversation.push(assistantMessage);
    yield assistantMessage;
    const toolCalls = assistantBlocks.filter((block) => block.type === "tool_use");
    if (toolCalls.length === 0) {
      return;
    }
    for (const toolCall of toolCalls) {
      for await (const message of executeToolCall(params, assistantMessage, toolCall)) {
        conversation.push(message);
        yield message;
      }
    }
  }
  yield createAssistantTextMessage("达到最大工具轮次限制，已停止继续执行。");
}
async function* query(params) {
  if (!getLlmConfigFromEnv()) {
    yield* queryWithPlanner(params);
    return;
  }
  try {
    yield* queryWithLlm(params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    yield createAssistantTextMessage(`LLM 调用失败，已回退到本地 planner。

${message}`);
    yield* queryWithPlanner(params);
  }
}

// app/headless.ts
function parseTranscript(text) {
  return text.split(`
`).map((line) => line.trim()).filter(Boolean).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return line;
    }
  });
}
function formatSessionList(sessions, options) {
  if (sessions.length === 0) {
    return "No sessions found.";
  }
  const lines = sessions.map((session) => {
    const marker = session.status === "needs_attention" ? "!" : "-";
    const updated = session.updatedAt || session.createdAt || "-";
    const title = session.title || session.id;
    const model = session.provider || session.model ? ` · ${session.provider || "?"}/${session.model || "?"}` : "";
    const count = session.messageCount !== undefined ? ` · ${session.messageCount} msg` : "";
    const stats = session.toolUseCount !== undefined || session.errorCount !== undefined ? ` · tools:${session.toolUseCount ?? 0} · errors:${session.errorCount ?? 0}` : "";
    const status = session.status ? ` · ${session.status}` : "";
    const lastTool = session.lastTool ? `
    last tool: ${session.lastTool}` : "";
    const lastError = session.lastError ? `
    last error: ${session.lastError}` : "";
    const summary = session.summary ? `
    summary: ${session.summary}` : "";
    const prompt = session.lastPrompt ? `
    ${session.lastPrompt}` : "";
    return `${marker} ${session.id} · ${updated}${count}${stats}${model}${status}
    ${title}${summary}${prompt}${lastTool}${lastError}`;
  }).join(`
`);
  const filters = [
    options?.status ? `status=${options.status}` : "",
    options?.limit !== undefined ? `limit=${options.limit}` : ""
  ].filter(Boolean);
  return filters.length > 0 ? `[${filters.join(", ")}]
${lines}` : lines;
}
function formatSessionMetadata(session) {
  return [
    `session: ${session.id}`,
    `title: ${session.title || session.id}`,
    `summary: ${session.summary || "-"}`,
    `created: ${session.createdAt || "-"}`,
    `updated: ${session.updatedAt || "-"}`,
    `messages: ${session.messageCount ?? "-"}`,
    `tools/errors: ${session.toolUseCount ?? 0} / ${session.errorCount ?? 0}`,
    `provider/model: ${session.provider || "-"} / ${session.model || "-"}`,
    `status: ${session.status || "-"}`,
    `first prompt: ${session.firstPrompt || "-"}`,
    `last prompt: ${session.lastPrompt || "-"}`,
    `last tool: ${session.lastTool || "-"}`,
    `last error: ${session.lastError || "-"}`
  ].join(`
`);
}
function clipText(text, maxLength) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}
function formatExportMessageEntry(message) {
  if (message.type === "user") {
    return `user: ${clipText(message.content, 240)}`;
  }
  if (message.type === "tool_result") {
    const status = message.isError ? "tool_error" : "tool_result";
    return `${status}(${message.toolUseId}): ${summarizeUnknown(message.content, 400)}`;
  }
  return message.content.map((block) => block.type === "text" ? `assistant: ${clipText(block.text, 400)}` : `tool_use(${block.id}): ${block.name} ${summarizeToolInput(block.input)}`).join(" | ");
}
function formatInspectView(cwd, session, messages, recentCount = 8) {
  const recentMessages = messages.slice(-recentCount);
  const errors = messages.filter((message) => message.type === "tool_result" && Boolean(message.isError));
  const recentErrors = errors.slice(-3);
  return [
    "Session Inspect",
    "===============",
    formatSessionMetadata(session),
    "",
    "recent messages:",
    recentMessages.length > 0 ? formatTranscriptMessages(recentMessages, true) : "(none)",
    "",
    "recent errors:",
    recentErrors.length > 0 ? recentErrors.map((message, index) => `${index + 1}. ${summarizeUnknown(message.content, 200)}`).join(`
`) : "(none)",
    "",
    `metadata file: ${getSessionInfoFilePath(cwd, session.id)}`,
    `transcript file: ${getTranscriptPath(cwd, session.id)}`
  ].join(`
`);
}
function formatCleanupSummary(removed, skippedCount, dryRun = false) {
  if (removed.length === 0) {
    return skippedCount > 0 ? `No sessions removed. ${skippedCount} session(s) kept.` : "No sessions removed.";
  }
  return [
    `${dryRun ? "Would remove" : "Removed"} ${removed.length} session(s):`,
    ...removed.map((session) => {
      const updated = session.updatedAt || session.createdAt || "-";
      return `- ${session.id} · ${updated} · ${session.title || session.id}`;
    }),
    skippedCount > 0 ? `Kept ${skippedCount} session(s).` : ""
  ].filter(Boolean).join(`
`);
}
function formatMarkdownExport(session, messages) {
  return [
    `# Session ${session.id}`,
    "",
    "## Metadata",
    "",
    `- Title: ${session.title || session.id}`,
    `- Summary: ${session.summary || "-"}`,
    `- Created: ${session.createdAt || "-"}`,
    `- Updated: ${session.updatedAt || "-"}`,
    `- Messages: ${session.messageCount ?? messages.length}`,
    `- Tools/Errors: ${session.toolUseCount ?? 0} / ${session.errorCount ?? 0}`,
    `- Provider/Model: ${session.provider || "-"} / ${session.model || "-"}`,
    `- Status: ${session.status || "-"}`,
    `- First Prompt: ${session.firstPrompt || "-"}`,
    `- Last Prompt: ${session.lastPrompt || "-"}`,
    `- Last Tool: ${session.lastTool || "-"}`,
    `- Last Error: ${session.lastError || "-"}`,
    "",
    "## Transcript",
    "",
    ...messages.map((message, index) => `${index + 1}. ${formatExportMessageEntry(message)}`),
    ""
  ].join(`
`);
}
function formatJsonExport(session, messages) {
  return JSON.stringify({
    session,
    messages: messages.map((message) => ({
      ...message,
      ...message.type === "user" ? { content: clipText(message.content, 240) } : message.type === "tool_result" ? { content: summarizeUnknown(message.content, 400) } : {
        content: message.content.map((block) => block.type === "text" ? {
          ...block,
          text: clipText(block.text, 400)
        } : block)
      }
    }))
  }, null, 2);
}
function formatTranscriptEntry(message) {
  if (message.type === "user") {
    return `user: ${message.content}`;
  }
  if (message.type === "tool_result") {
    const status = message.isError ? "tool_error" : "tool_result";
    return `${status}(${message.toolUseId}): ${summarizeUnknown(message.content, 240)}`;
  }
  return message.content.map((block) => block.type === "text" ? `assistant: ${block.text}` : `tool_use(${block.id}): ${block.name} ${summarizeToolInput(block.input)}`).join(`
`);
}
function formatTranscriptMessages(messages, compact = false) {
  if (messages.length === 0) {
    return "Transcript is empty.";
  }
  if (compact) {
    return messages.map((message, index) => {
      if (message.type === "user") {
        return `${index + 1}. user: ${summarizeUnknown(message.content, 120)}`;
      }
      if (message.type === "tool_result") {
        const status = message.isError ? "tool_error" : "tool_result";
        return `${index + 1}. ${status}: ${summarizeUnknown(message.content, 120)}`;
      }
      const summary = message.content.map((block) => block.type === "text" ? summarizeUnknown(block.text, 120) : `${block.name} ${summarizeToolInput(block.input)}`).join(" | ");
      return `${index + 1}. assistant: ${summary}`;
    }).join(`
`);
  }
  return messages.map((message, index) => `${index + 1}. ${formatTranscriptEntry(message)}`).join(`

`);
}
function parseCommand(argv) {
  const [command, ...rest] = argv;
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      return {
        kind: "meta",
        output: formatHelp()
      };
    case "--version":
    case "-v":
      return {
        kind: "meta",
        output: "claude-code-lite 0.1.0"
      };
    case "tools":
      return {
        kind: "meta",
        output: `Available tools: ${getTools().map((tool) => tool.name).join(", ")}`
      };
    case "sessions":
      return {
        kind: "utility",
        utilityName: "sessions",
        args: rest
      };
    case "transcript":
      return {
        kind: "utility",
        utilityName: "transcript",
        args: rest
      };
    case "inspect":
      return {
        kind: "utility",
        utilityName: "inspect",
        args: rest
      };
    case "export-session":
      return {
        kind: "utility",
        utilityName: "export-session",
        args: rest
      };
    case "rm-session":
      return {
        kind: "utility",
        utilityName: "rm-session",
        args: rest
      };
    case "cleanup-sessions":
      return {
        kind: "utility",
        utilityName: "cleanup-sessions",
        args: rest
      };
    case "chat":
      return {
        kind: "utility",
        utilityName: "chat",
        args: rest
      };
    case "read":
      return {
        kind: "tool",
        toolName: "Read",
        toolInput: { path: rest[0] ?? "" }
      };
    case "write":
      return {
        kind: "tool",
        toolName: "Write",
        toolInput: {
          path: rest[0] ?? "",
          content: rest.slice(1).join(" ")
        }
      };
    case "edit":
      return {
        kind: "tool",
        toolName: "Edit",
        toolInput: {
          path: rest[0] ?? "",
          oldString: rest[1] ?? "",
          newString: rest.slice(2).join(" ")
        }
      };
    case "shell":
      return {
        kind: "tool",
        toolName: "Shell",
        toolInput: { command: rest.join(" ") }
      };
    case "fetch":
      return {
        kind: "tool",
        toolName: "WebFetch",
        toolInput: {
          url: rest[0] ?? "",
          prompt: rest.slice(1).join(" ")
        }
      };
    case "agent":
      return {
        kind: "tool",
        toolName: "Agent",
        toolInput: {
          description: rest[0] ?? "",
          prompt: rest[1] ?? "",
          subagentType: rest[2]
        }
      };
    case "tool":
      return {
        kind: "tool",
        toolName: rest[0] ?? "",
        toolInput: JSON.parse(rest.slice(1).join(" ") || "{}")
      };
    default:
      throw new Error(`Unknown command "${command}".

${formatHelp()}`);
  }
}
function formatHelp() {
  return [
    "Claude Code-lite CLI",
    "",
    "Commands:",
    "  help",
    "  --help, -h",
    "  --version, -v",
    "  tools",
    "  sessions [--limit N] [--status ready|needs_attention]",
    "  transcript <sessionId> [--compact]",
    "  inspect <sessionId>",
    "  export-session <sessionId> [--format markdown|json] [--output path]",
    "  rm-session <sessionId>",
    "  cleanup-sessions [--keep N] [--older-than DAYS] [--status ready|needs_attention] [--dry-run]",
    "  chat [--resume latest|<sessionId>|failed] <prompt...>",
    "  read <path>",
    "  write <path> <content>",
    "  edit <path> <oldString> <newString>",
    "  shell <command...>",
    "  fetch <url> [prompt]",
    "  agent <description> <prompt> [subagentType]",
    "  tool <ToolName> <json>",
    "",
    "Options:",
    "  --yes   Auto-approve mutating tools in default mode",
    "  --stream   Stream chat output to stdout",
    "  --no-stream   Disable streaming chat output",
    "",
    "LLM env:",
    "  CCL_LLM_PROVIDER   openai | anthropic, defaults to openai",
    "  CCL_LLM_API_KEY",
    "  CCL_LLM_MODEL",
    "  CCL_LLM_BASE_URL   Optional, defaults to https://api.openai.com/v1",
    "  CCL_LLM_SYSTEM_PROMPT   Optional extra system prompt",
    "  CCL_ANTHROPIC_VERSION   Optional, defaults to 2023-06-01"
  ].join(`
`);
}
function summarizeUnknown(value, maxLength = 120) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "";
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}
function summarizeToolInput(input2) {
  if (typeof input2 !== "object" || input2 === null) {
    return summarizeUnknown(input2, 60);
  }
  if ("path" in input2 && typeof input2.path === "string") {
    return input2.path;
  }
  if ("command" in input2 && typeof input2.command === "string") {
    return summarizeUnknown(input2.command, 60);
  }
  if ("url" in input2 && typeof input2.url === "string") {
    return input2.url;
  }
  if ("description" in input2 && typeof input2.description === "string") {
    return summarizeUnknown(input2.description, 60);
  }
  return summarizeUnknown(input2, 60);
}
function summarizeToolResult(message) {
  if (message.type !== "tool_result") {
    return "";
  }
  return summarizeUnknown(message.content, 80);
}
async function resolveSessionIdArg(cwd, rawSession) {
  if (!rawSession) {
    return;
  }
  if (rawSession === "latest") {
    const sessions = await listSessions(cwd);
    return sessions[0]?.id;
  }
  if (rawSession === "failed") {
    const sessions = await listSessions(cwd);
    return sessions.find((session) => session.status === "needs_attention")?.id;
  }
  return rawSession;
}
async function resolveSessionIdForChat(cwd, rawSession) {
  return resolveSessionIdArg(cwd, rawSession);
}
async function parseChatCommandOptions(cwd, args) {
  let sessionRef;
  const promptParts = [];
  for (let index = 0;index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--resume" || arg === "--session") {
      sessionRef = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--resume-failed") {
      sessionRef = "failed";
      continue;
    }
    promptParts.push(arg);
  }
  const prompt = promptParts.join(" ").trim();
  if (!prompt) {
    throw new Error("chat requires a prompt");
  }
  const sessionId = await resolveSessionIdForChat(cwd, sessionRef);
  if (sessionRef && !sessionId) {
    throw new Error("No resumable session found");
  }
  return {
    prompt,
    sessionId
  };
}
async function parseExportCommandOptions(cwd, args) {
  const rawSession = args[0];
  if (!rawSession) {
    throw new Error("export-session requires a sessionId");
  }
  let format = "markdown";
  let outputPath;
  for (let index = 1;index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--format") {
      const value = args[index + 1];
      if (value !== "markdown" && value !== "json") {
        throw new Error('export-session --format requires "markdown" or "json"');
      }
      format = value;
      index += 1;
      continue;
    }
    if (arg === "--output") {
      outputPath = args[index + 1];
      if (!outputPath) {
        throw new Error("export-session --output requires a path");
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown export-session option "${arg}"`);
  }
  const sessionId = await resolveSessionIdArg(cwd, rawSession);
  if (!sessionId) {
    throw new Error("No exportable session found");
  }
  return { sessionId, format, outputPath };
}
function buildSyntheticAssistant(toolName, toolInput) {
  return {
    id: createId("assistant"),
    type: "assistant",
    content: [
      {
        type: "tool_use",
        id: createId("tool-use"),
        name: toolName,
        input: toolInput
      }
    ]
  };
}
async function confirmOrThrow(message, autoApprove) {
  if (autoApprove)
    return;
  if (!input.isTTY || !output.isTTY) {
    throw new Error(`${message}. Re-run with --yes to auto-approve.`);
  }
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${message} [y/N] `);
    if (!/^y(es)?$/i.test(answer.trim())) {
      throw new Error("Operation cancelled by user");
    }
  } finally {
    rl.close();
  }
}
function parseCleanupCommandOptions(args) {
  let keep;
  let olderThanDays;
  let dryRun = false;
  let status;
  for (let index = 0;index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--keep") {
      const value = Number(args[index + 1]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("cleanup-sessions --keep requires a non-negative number");
      }
      keep = value;
      index += 1;
      continue;
    }
    if (arg === "--older-than") {
      const value = Number(args[index + 1]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("cleanup-sessions --older-than requires a non-negative number");
      }
      olderThanDays = value;
      index += 1;
      continue;
    }
    if (arg === "--status") {
      const value = args[index + 1];
      if (value !== "ready" && value !== "needs_attention") {
        throw new Error('cleanup-sessions --status requires "ready" or "needs_attention"');
      }
      status = value;
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    throw new Error(`Unknown cleanup-sessions option "${arg}"`);
  }
  if (keep === undefined && olderThanDays === undefined) {
    throw new Error("cleanup-sessions requires --keep N or --older-than DAYS");
  }
  return { keep, olderThanDays, dryRun, status };
}
function parseSessionsCommandOptions(args) {
  let limit;
  let status;
  for (let index = 0;index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--limit") {
      const value = Number(args[index + 1]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("sessions --limit requires a non-negative number");
      }
      limit = value;
      index += 1;
      continue;
    }
    if (arg === "--status") {
      const value = args[index + 1];
      if (value !== "ready" && value !== "needs_attention") {
        throw new Error('sessions --status requires "ready" or "needs_attention"');
      }
      status = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown sessions option "${arg}"`);
  }
  return { limit, status };
}
async function deleteSessionArtifacts(cwd, sessionId) {
  await Promise.all([
    deleteSessionInfo(cwd, sessionId),
    deleteTranscript(cwd, sessionId)
  ]);
}
async function confirmWithSessionRule(message, autoApprove, tool, inputValue, context) {
  if (autoApprove)
    return;
  if (!input.isTTY || !output.isTTY) {
    throw new Error(`${message}. Re-run with --yes to auto-approve.`);
  }
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${message} [y] once / [a] session / [N] `);
    const normalized = answer.trim().toLowerCase();
    if (normalized === "a" || normalized === "always") {
      rememberPermissionRule(context, tool, inputValue);
      return;
    }
    if (normalized === "y" || normalized === "yes") {
      return;
    }
    throw new Error("Operation cancelled by user");
  } finally {
    rl.close();
  }
}
function createToolContext(cwd, appStateRef, session, abortController) {
  return {
    cwd,
    abortController: abortController ?? new AbortController,
    messages: session.getMessages(),
    getAppState: () => appStateRef.current,
    setAppState: (updater) => {
      appStateRef.current = updater(appStateRef.current);
    }
  };
}
async function executeCliCommand(cwd, argv, autoApprove = false, hooks) {
  const parsed = parseCommand(argv);
  if (parsed.kind === "meta") {
    return parsed;
  }
  if (parsed.kind === "utility") {
    if (parsed.utilityName === "sessions") {
      const options = parseSessionsCommandOptions(parsed.args);
      let sessions = await listSessions(cwd);
      if (options.status) {
        sessions = sessions.filter((session3) => session3.status === options.status);
      }
      if (options.limit !== undefined) {
        sessions = sessions.slice(0, options.limit);
      }
      return {
        kind: "utility",
        utilityName: "sessions",
        output: formatSessionList(sessions, options)
      };
    }
    if (parsed.utilityName === "transcript") {
      const sessionId = parsed.args[0];
      if (!sessionId) {
        throw new Error("transcript requires a sessionId");
      }
      const compact = parsed.args.includes("--compact");
      return {
        kind: "utility",
        utilityName: "transcript",
        output: formatTranscriptMessages(parseTranscript(await readTextFile(getTranscriptPath(cwd, sessionId))), compact)
      };
    }
    if (parsed.utilityName === "inspect") {
      const sessionId = await resolveSessionIdArg(cwd, parsed.args[0]);
      if (!sessionId) {
        throw new Error("inspect requires a sessionId");
      }
      const messages = await readTranscriptMessages(cwd, sessionId).catch(() => []);
      const info = await readSessionInfo(cwd, sessionId) || (await listSessions(cwd)).find((session3) => session3.id === sessionId);
      if (!info) {
        throw new Error(`Session "${sessionId}" not found`);
      }
      return {
        kind: "utility",
        utilityName: "inspect",
        output: formatInspectView(cwd, info, messages)
      };
    }
    if (parsed.utilityName === "export-session") {
      const options = await parseExportCommandOptions(cwd, parsed.args);
      const messages = await readTranscriptMessages(cwd, options.sessionId).catch(() => []);
      const info = await readSessionInfo(cwd, options.sessionId) || (await listSessions(cwd)).find((session3) => session3.id === options.sessionId);
      if (!info) {
        throw new Error(`Session "${options.sessionId}" not found`);
      }
      const content = options.format === "json" ? formatJsonExport(info, messages) : formatMarkdownExport(info, messages);
      if (options.outputPath) {
        await writeFile3(options.outputPath, `${content}
`, "utf8");
      }
      return {
        kind: "utility",
        utilityName: "export-session",
        output: options.outputPath ? `Exported ${options.sessionId} to ${options.outputPath}` : content
      };
    }
    if (parsed.utilityName === "rm-session") {
      const sessionId = await resolveSessionIdArg(cwd, parsed.args[0]);
      if (!sessionId) {
        throw new Error("rm-session requires a sessionId");
      }
      await confirmOrThrow(`Delete session ${sessionId} and its transcript`, autoApprove);
      const info = await readSessionInfo(cwd, sessionId) || (await listSessions(cwd)).find((session3) => session3.id === sessionId) || { id: sessionId };
      await deleteSessionArtifacts(cwd, sessionId);
      return {
        kind: "utility",
        utilityName: "rm-session",
        output: `Removed session ${sessionId}${info.title ? ` · ${info.title}` : ""}`
      };
    }
    if (parsed.utilityName === "cleanup-sessions") {
      const options = parseCleanupCommandOptions(parsed.args);
      const sessions = await listSessions(cwd);
      const now = Date.now();
      const candidates = sessions.filter((session3, index) => {
        if (options.status && session3.status !== options.status) {
          return false;
        }
        const byKeep = options.keep !== undefined ? index >= options.keep : false;
        const timestamp = session3.updatedAt || session3.createdAt;
        const ageMs = timestamp ? now - Date.parse(timestamp) : 0;
        const byAge = options.olderThanDays !== undefined ? ageMs >= options.olderThanDays * 24 * 60 * 60 * 1000 : false;
        return byKeep || byAge;
      });
      if (candidates.length === 0) {
        return {
          kind: "utility",
          utilityName: "cleanup-sessions",
          output: formatCleanupSummary([], sessions.length, options.dryRun)
        };
      }
      if (!options.dryRun) {
        await confirmOrThrow(`Remove ${candidates.length} session(s) matching cleanup rule`, autoApprove);
        for (const candidate of candidates) {
          await deleteSessionArtifacts(cwd, candidate.id);
        }
      }
      return {
        kind: "utility",
        utilityName: "cleanup-sessions",
        output: formatCleanupSummary(candidates, Math.max(sessions.length - candidates.length, 0), options.dryRun)
      };
    }
    const chat = await parseChatCommandOptions(cwd, parsed.args);
    const session2 = new SessionEngine({
      id: chat.sessionId ?? createId("session"),
      cwd
    });
    if (chat.sessionId) {
      session2.hydrateMessages(await readTranscriptMessages(cwd, chat.sessionId));
    }
    const appStateRef2 = { current: createInitialAppState() };
    const context2 = createToolContext(cwd, appStateRef2, session2, hooks?.abortController);
    const userMessage = {
      id: createId("user"),
      type: "user",
      content: chat.prompt
    };
    await session2.recordMessages([userMessage]);
    const producedMessages = [];
    for await (const message of query({
      prompt: chat.prompt,
      messages: session2.getMessages(),
      systemPrompt: [],
      toolUseContext: context2,
      canUseTool,
      onAssistantTextDelta: hooks?.onAssistantTextDelta,
      onPermissionRequest: async (request) => {
        if (autoApprove) {
          return true;
        }
        const tool2 = findToolByName(getTools(), request.toolName);
        if (!tool2) {
          throw new Error(`Unknown tool "${request.toolName}"`);
        }
        await confirmWithSessionRule(request.message, autoApprove, tool2, request.input, context2);
        return true;
      }
    })) {
      producedMessages.push(message);
      hooks?.onMessage?.(message);
    }
    if (producedMessages.length > 0) {
      await session2.recordMessages(producedMessages);
    }
    return {
      kind: "utility",
      utilityName: "chat",
      output: {
        messages: producedMessages,
        transcriptPath: session2.getTranscriptPath()
      }
    };
  }
  const { toolName, toolInput } = parsed;
  const tool = findToolByName(getTools(), toolName);
  if (!tool) {
    throw new Error(`Unknown tool "${toolName}"`);
  }
  const session = new SessionEngine({
    id: createId("session"),
    cwd
  });
  const appStateRef = { current: createInitialAppState() };
  const context = createToolContext(cwd, appStateRef, session, hooks?.abortController);
  const assistantMessage = buildSyntheticAssistant(toolName, toolInput);
  const toolUseId = assistantMessage.content[0].id;
  await session.recordMessages([assistantMessage]);
  const permissionDecision = await canUseTool(tool, toolInput, context, assistantMessage, toolUseId);
  if (permissionDecision.behavior === "deny") {
    throw new Error(permissionDecision.message);
  }
  if (permissionDecision.behavior === "ask") {
    await confirmWithSessionRule(permissionDecision.message, autoApprove, tool, toolInput, context);
  }
  const effectiveInput = permissionDecision.behavior === "allow" && permissionDecision.updatedInput ? permissionDecision.updatedInput : toolInput;
  const result = await tool.call(effectiveInput, context, canUseTool, assistantMessage);
  await session.recordMessages([
    {
      id: createId("tool-result"),
      type: "tool_result",
      toolUseId,
      content: JSON.stringify(result.data, null, 2)
    },
    ...result.extraMessages ?? []
  ]);
  return {
    kind: "tool",
    tool: tool.name,
    input: effectiveInput,
    output: result.data,
    transcriptPath: session.getTranscriptPath()
  };
}
async function runHeadless(options) {
  const shouldStream = options.streamOutput ?? (options.args[0] === "chat" && output.isTTY);
  let lastAssistantText = "";
  const toolSummaries = new Map;
  const abortController = new AbortController;
  let interrupted = false;
  const onSigint = () => {
    interrupted = true;
    abortController.abort(new Error("User interrupted current turn"));
  };
  process.on("SIGINT", onSigint);
  try {
    const result = await executeCliCommand(options.cwd, options.args, options.autoApprove ?? false, shouldStream ? {
      abortController,
      onAssistantTextDelta: (text) => {
        const delta = text.slice(lastAssistantText.length);
        if (delta) {
          output.write(delta);
          lastAssistantText = text;
        }
      },
      onMessage: (message) => {
        if (message.type === "assistant") {
          const toolUses = message.content.filter((block) => block.type === "tool_use");
          if (toolUses.length > 0) {
            if (lastAssistantText) {
              output.write(`
`);
            }
            for (const toolUse of toolUses) {
              const summary = `${toolUse.name} ${summarizeToolInput(toolUse.input)}`.trim();
              toolSummaries.set(toolUse.id, summary);
              output.write(`[tool:start] ${summary}
`);
            }
            lastAssistantText = "";
          }
          return;
        }
        if (message.type === "tool_result" && message.isError) {
          const summary = toolSummaries.get(message.toolUseId) || message.toolUseId;
          output.write(`[tool:error] ${summary} · ${summarizeToolResult(message)}
`);
          toolSummaries.delete(message.toolUseId);
          return;
        }
        if (message.type === "tool_result") {
          const summary = toolSummaries.get(message.toolUseId) || message.toolUseId;
          output.write(`[tool:done] ${summary} · ${summarizeToolResult(message)}
`);
          toolSummaries.delete(message.toolUseId);
          return;
        }
      }
    } : { abortController });
    if (result.kind === "meta") {
      output.write(`${result.output}
`);
      return;
    }
    if (result.kind === "utility") {
      if (shouldStream && result.utilityName === "chat") {
        const transcriptPath = typeof result.output === "object" && result.output !== null && "transcriptPath" in result.output && typeof result.output.transcriptPath === "string" ? result.output.transcriptPath : undefined;
        if (lastAssistantText) {
          output.write(`
`);
        }
        if (interrupted) {
          output.write(`[interrupt] current turn aborted
`);
        }
        if (transcriptPath) {
          output.write(`[transcript] ${transcriptPath}
`);
        }
        return;
      }
      if (typeof result.output === "string") {
        output.write(`${result.output}
`);
      } else {
        output.write(`${JSON.stringify(result.output, null, 2)}
`);
      }
      return;
    }
    output.write(`${JSON.stringify(result, null, 2)}
`);
  } catch (error) {
    if (abortController.signal.aborted) {
      if (lastAssistantText) {
        output.write(`
`);
      }
      output.write(`[interrupt] current turn aborted
`);
      return;
    }
    throw error;
  } finally {
    process.off("SIGINT", onSigint);
  }
}

// app/repl.ts
import readline2 from "readline/promises";
var processStdin = process.stdin;
var processStdout = process.stdout;
function summarizeUnknown2(value, maxLength = 120) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "";
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}
function summarizeToolInput2(input2) {
  if (typeof input2 !== "object" || input2 === null) {
    return summarizeUnknown2(input2, 60);
  }
  if ("path" in input2 && typeof input2.path === "string") {
    return input2.path;
  }
  if ("command" in input2 && typeof input2.command === "string") {
    return summarizeUnknown2(input2.command, 60);
  }
  if ("url" in input2 && typeof input2.url === "string") {
    return input2.url;
  }
  if ("description" in input2 && typeof input2.description === "string") {
    return summarizeUnknown2(input2.description, 60);
  }
  return summarizeUnknown2(input2, 60);
}
function createContext(cwd, session, appStateRef, abortController) {
  return {
    cwd,
    abortController,
    messages: session.getMessages(),
    getAppState: () => appStateRef.current,
    setAppState: (updater) => {
      appStateRef.current = updater(appStateRef.current);
    }
  };
}
async function resolveResumeTarget(cwd, raw) {
  if (!raw) {
    return;
  }
  if (raw === "latest") {
    const sessions = await listSessions(cwd);
    return sessions[0]?.id;
  }
  return raw;
}
async function startRepl(options, { stdin = processStdin, stdout = processStdout } = {}) {
  const rl = readline2.createInterface({ input: stdin, output: stdout });
  const appStateRef = { current: createInitialAppState() };
  let session = new SessionEngine({
    id: createId("session"),
    cwd: options.cwd
  });
  let activeAbortController = null;
  let interrupted = false;
  stdout.write(`${formatHelp()}

`);
  stdout.write([
    "REPL commands:",
    "  /help",
    "  /new",
    "  /sessions [--limit N] [--status ready|needs_attention]",
    "  /inspect <sessionId>",
    "  /export-session <sessionId> [--format markdown|json] [--output path]",
    "  /rm-session <sessionId>",
    "  /cleanup-sessions --keep N | --older-than DAYS [--status ...] [--dry-run]",
    "  /resume latest",
    "  /resume failed",
    "  /resume <sessionId>",
    "  /quit",
    ""
  ].join(`
`));
  const onSigint = () => {
    if (activeAbortController) {
      interrupted = true;
      activeAbortController.abort(new Error("User interrupted current turn"));
      stdout.write(`
[interrupt] abort requested
`);
      return;
    }
    rl.close();
  };
  process.on("SIGINT", onSigint);
  try {
    for (;; ) {
      const line = await rl.question(`cc-lite:${session.sessionId}> `);
      const trimmed = line.trim();
      if (!trimmed)
        continue;
      if (trimmed === "exit" || trimmed === "quit" || trimmed === "/quit") {
        break;
      }
      if (trimmed === "/help") {
        stdout.write([
          "REPL commands:",
          "  /help",
          "  /new",
          "  /sessions [--limit N] [--status ready|needs_attention]",
          "  /inspect <sessionId>",
          "  /export-session <sessionId> [--format markdown|json] [--output path]",
          "  /rm-session <sessionId>",
          "  /cleanup-sessions --keep N | --older-than DAYS [--status ...] [--dry-run]",
          "  /resume latest",
          "  /resume failed",
          "  /resume <sessionId>",
          "  /quit",
          ""
        ].join(`
`));
        continue;
      }
      if (trimmed === "/new") {
        appStateRef.current = createInitialAppState();
        session = new SessionEngine({
          id: createId("session"),
          cwd: options.cwd
        });
        stdout.write(`started ${session.sessionId}
`);
        continue;
      }
      if (trimmed === "/sessions") {
        const result = await executeCliCommand(options.cwd, ["sessions"], options.autoApprove ?? false);
        stdout.write(`${typeof result.output === "string" ? result.output : JSON.stringify(result.output, null, 2)}
`);
        continue;
      }
      if (trimmed.startsWith("/resume")) {
        const [, rawTarget] = trimmed.split(/\s+/, 2);
        const target = await resolveResumeTarget(options.cwd, rawTarget);
        if (!target) {
          stdout.write(`no resumable session found
`);
          continue;
        }
        appStateRef.current = createInitialAppState();
        session = new SessionEngine({
          id: target,
          cwd: options.cwd
        });
        session.hydrateMessages(await readTranscriptMessages(options.cwd, target));
        stdout.write(`resumed ${target}
`);
        continue;
      }
      try {
        if (trimmed.startsWith("/")) {
          const result = await executeCliCommand(options.cwd, trimmed.slice(1).trim().split(/\s+/), options.autoApprove ?? false);
          stdout.write(`${JSON.stringify(result, null, 2)}
`);
          continue;
        }
        const userMessage = {
          id: createId("user"),
          type: "user",
          content: trimmed
        };
        await session.recordMessages([userMessage]);
        let lastAssistantText = "";
        const toolSummaries = new Map;
        activeAbortController = new AbortController;
        interrupted = false;
        for await (const message of query({
          prompt: trimmed,
          messages: session.getMessages(),
          systemPrompt: [],
          toolUseContext: createContext(options.cwd, session, appStateRef, activeAbortController),
          canUseTool,
          onAssistantTextDelta: (text) => {
            const delta = text.slice(lastAssistantText.length);
            if (delta) {
              stdout.write(delta);
              lastAssistantText = text;
            }
          },
          onPermissionRequest: async (request) => {
            if (options.autoApprove) {
              return true;
            }
            const tool = findToolByName(getTools(), request.toolName);
            if (!tool) {
              return false;
            }
            const answer = await rl.question(`${request.message} [y] once / [a] session / [N] `);
            const normalized = answer.trim().toLowerCase();
            if (normalized === "a" || normalized === "always") {
              rememberPermissionRule(createContext(options.cwd, session, appStateRef, activeAbortController ?? new AbortController), tool, request.input);
              return true;
            }
            return normalized === "y" || normalized === "yes";
          }
        })) {
          await session.recordMessages([message]);
          if (message.type === "assistant") {
            const toolUses = message.content.filter((block) => block.type === "tool_use");
            if (toolUses.length > 0) {
              if (lastAssistantText) {
                stdout.write(`
`);
              }
              for (const toolUse of toolUses) {
                const summary = `${toolUse.name} ${summarizeToolInput2(toolUse.input)}`.trim();
                toolSummaries.set(toolUse.id, summary);
                stdout.write(`[tool:start] ${summary}
`);
              }
            }
            continue;
          }
          if (message.type === "tool_result") {
            const summary = toolSummaries.get(message.toolUseId) || message.toolUseId;
            if (message.isError) {
              stdout.write(`[tool:error] ${summary} · ${summarizeUnknown2(message.content, 80)}
`);
            } else {
              stdout.write(`[tool:done] ${summary} · ${summarizeUnknown2(message.content, 80)}
`);
            }
            toolSummaries.delete(message.toolUseId);
          }
        }
        if (lastAssistantText) {
          stdout.write(`
`);
        }
        if (interrupted) {
          stdout.write(`[interrupt] current turn aborted
`);
        }
        stdout.write(`[transcript] ${session.getTranscriptPath()}
`);
      } catch (error) {
        const interruptedNow = activeAbortController?.signal.aborted ?? false;
        const message = error instanceof Error ? error.message : String(error);
        stdout.write(interruptedNow ? `[interrupt] current turn aborted
` : `${message}
`);
      } finally {
        activeAbortController = null;
      }
    }
  } finally {
    process.off("SIGINT", onSigint);
    rl.close();
  }
}

// app/tui.ts
import readline3 from "readline";
import { stdin as input2, stdout as output2 } from "process";

// shared/cli.ts
function tokenizeCommandLine(input2) {
  const tokens = [];
  let current = "";
  let quote = null;
  let escaped = false;
  for (const char of input2) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (escaped) {
    current += "\\";
  }
  if (quote) {
    throw new Error("Unterminated quoted string");
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

// app/tui.ts
function getPermissionMode(state, runtimeRef) {
  return runtimeRef.current.toolContext.getAppState().permissionContext.mode;
}
function wrapText(text, width) {
  const normalized = text.replace(/\r\n/g, `
`);
  const rawLines = normalized.split(`
`);
  const wrapped = [];
  for (const rawLine of rawLines) {
    if (!rawLine) {
      wrapped.push("");
      continue;
    }
    let line = rawLine;
    while (line.length > width) {
      let splitIndex = width;
      if (line.charAt(width) !== " " && width > 0) {
        const spaceIndex = line.lastIndexOf(" ", width);
        if (spaceIndex > 0) {
          splitIndex = spaceIndex;
        }
      }
      wrapped.push(line.slice(0, splitIndex).trimEnd());
      line = line.slice(splitIndex).trimStart();
      if (line.length > width && line.indexOf(" ") === -1) {
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
function trimTextPlain(text, width) {
  if (text.length <= width) {
    return text.padEnd(width, " ");
  }
  return `${text.slice(0, Math.max(0, width - 1))}…`;
}
function formatEntry(entry) {
  switch (entry.kind) {
    case "user":
      return `You  ${entry.text}`;
    case "assistant":
      return `CCL  ${entry.text}`;
    case "tool":
      return `Tool ${entry.text}`;
    case "result":
      return `Out  ${entry.text}`;
    case "error":
      return `Err  ${entry.text}`;
    case "system":
      return `Sys  ${entry.text}`;
  }
}
function formatUnknown(value) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
function summarizeText2(text, maxLength = 48) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized || "(empty)";
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}
function shouldCollapse(text) {
  return text.includes(`
`) || text.length > 160;
}
function makeConversationEntries(state, message) {
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
        summary: collapsible ? summarizeText2(text) : undefined
      }
    ];
  }
  return message.content.map((block) => {
    if (block.type === "text") {
      return { kind: "assistant", text: block.text };
    }
    return {
      kind: "tool",
      text: `${block.name} ${formatUnknown(block.input)}`
    };
  });
}
function createRuntime(cwd, appStateRef, sessionId) {
  const session = new SessionEngine({
    id: sessionId ?? createId("session"),
    cwd
  });
  const toolContext = {
    cwd,
    abortController: new AbortController,
    messages: session.getMessages(),
    getAppState: () => appStateRef.current,
    setAppState: (updater) => {
      appStateRef.current = updater(appStateRef.current);
    },
    agentId: createId("agent")
  };
  return { session, toolContext };
}
function addToolStep(state, step) {
  state.toolSteps.push({
    seq: state.nextStepSeq++,
    at: new Date().toTimeString().slice(0, 8),
    label: step,
    summary: summarizeText2(step, 28),
    kind: "session",
    status: "info"
  });
  state.toolSteps = state.toolSteps.slice(-12);
}
function setCurrentActivity(state, activity) {
  state.currentActivity = activity;
}
function addActivityStep(state, label, kind, status, durationMs) {
  state.toolSteps.push({
    seq: state.nextStepSeq++,
    at: new Date().toTimeString().slice(0, 8),
    durationMs,
    label,
    summary: summarizeText2(label, 28),
    kind,
    status
  });
  state.toolSteps = state.toolSteps.slice(-12);
}
function cycleTimelineFilter(filter) {
  switch (filter) {
    case "all":
      return "failed";
    case "failed":
      return "tools";
    case "tools":
      return "all";
  }
}
function updateFoldState(state, target, expanded) {
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
function applyModalOverlay(lines, modal, width, height) {
  const boxWidth = Math.min(width - 6, Math.max(36, Math.floor(width * 0.7)));
  const contentLines = wrapText(modal.message, Math.max(10, boxWidth - 4));
  const YELLOW = "\x1B[33m";
  const RESET = "\x1B[0m";
  const BOLD = "\x1B[1m";
  const boxLines = [
    `${BOLD}${YELLOW}┌${"─".repeat(boxWidth - 2)}┐${RESET}`,
    `${BOLD}${YELLOW}│ ${trimTextPlain(modal.title, boxWidth - 4)} │${RESET}`,
    `├${"─".repeat(boxWidth - 2)}┤`,
    ...contentLines.map((line) => `│ ${trimTextPlain(line, boxWidth - 4)} │`),
    `├${"─".repeat(boxWidth - 2)}┤`,
    `${YELLOW}│ ${trimTextPlain("[y] allow   [a] session   [n] cancel", boxWidth - 4)} │${RESET}`,
    `└${"─".repeat(boxWidth - 2)}┘`
  ];
  const startY = Math.max(1, Math.floor((height - boxLines.length) / 2));
  const startX = Math.max(0, Math.floor((width - boxWidth) / 2));
  const next = [...lines];
  for (let i = 0;i < boxLines.length; i += 1) {
    const targetIndex = startY + i;
    if (targetIndex >= next.length) {
      break;
    }
    const original = next[targetIndex].padEnd(width, " ");
    const overlay = boxLines[i];
    next[targetIndex] = original.slice(0, startX) + overlay + original.slice(startX + overlay.length);
  }
  return next;
}
function renderScreen(state, runtimeRef) {
  const width = Math.max(60, output2.columns ?? 80);
  const height = Math.max(20, output2.rows ?? 24);
  const RESET = "\x1B[0m";
  const BOLD = "\x1B[1m";
  const CYAN = "\x1B[36m";
  const GREEN = "\x1B[32m";
  const YELLOW = "\x1B[33m";
  const BLUE = "\x1B[34m";
  const MAGENTA = "\x1B[35m";
  const GRAY = "\x1B[90m";
  const RED = "\x1B[31m";
  const mainWidth = width - 4;
  const contentHeight = Math.max(8, height - 10);
  const mode = getPermissionMode(state, runtimeRef);
  const header = [
    `${BOLD}${CYAN}Claude Code-lite TUI${RESET}`,
    `${GRAY}Mode: ${mode} · Session: ${state.currentSessionId}${RESET}`,
    ""
  ];
  const messageLines = state.entries.flatMap((entry) => {
    let coloredText = formatEntry(entry);
    switch (entry.kind) {
      case "user":
        coloredText = `${BLUE}${coloredText}${RESET}`;
        break;
      case "assistant":
        coloredText = `${GREEN}${coloredText}${RESET}`;
        break;
      case "tool":
        coloredText = `${YELLOW}${coloredText}${RESET}`;
        break;
      case "result":
        coloredText = `${GRAY}${coloredText}${RESET}`;
        break;
      case "error":
        coloredText = `${RED}${coloredText}${RESET}`;
        break;
    }
    return wrapText(coloredText, Math.max(20, mainWidth - 4));
  });
  if (state.streamingAssistantText.trim()) {
    messageLines.push(...wrapText(`${GREEN}${formatEntry({
      kind: "assistant",
      text: `${state.streamingAssistantText}▌`
    })}${RESET}`, Math.max(20, mainWidth - 4)));
  }
  const maxScroll = Math.max(0, messageLines.length - contentHeight);
  if (state.scrollOffset > maxScroll) {
    state.scrollOffset = maxScroll;
  }
  const start = Math.max(0, messageLines.length - contentHeight - state.scrollOffset);
  const visibleMessages = messageLines.slice(start, start + contentHeight);
  let lines = [
    ...header,
    ...visibleMessages,
    "",
    `${GRAY}${"-".repeat(width)}${RESET}`,
    state.status.includes("Error") || state.status.includes("failed") ? `${RED}Status: ${state.status}${RESET}` : state.busy ? `${YELLOW}Status: ${state.status}${RESET}` : `${GREEN}Status: ${state.status}${RESET}`,
    `${GRAY}Keys: Enter submit · Up/Down scroll · PgUp/PgDn page · Ctrl+E expand · Ctrl+G collapse · Ctrl+F filter · Esc clear · Ctrl+C quit${RESET}`,
    state.modal ? `${YELLOW}Modal active${RESET}` : `${BLUE}Prompt> ${state.inputBuffer}${RESET}`
  ].slice(0, height);
  if (state.modal) {
    lines = applyModalOverlay(lines, state.modal, width, height);
  }
  output2.write("\x1B[2J\x1B[H");
  output2.write(lines.join(`
`));
}
async function restoreSession(cwd, appStateRef, state, runtimeRef, sessionId) {
  const messages = await readTranscriptMessages(cwd, sessionId);
  const runtime = createRuntime(cwd, appStateRef, sessionId);
  runtime.session.hydrateMessages(messages);
  runtimeRef.current = runtime;
  state.entries = messages.flatMap((message) => makeConversationEntries(state, message));
  state.currentSessionId = sessionId;
  state.scrollOffset = 0;
  state.status = `Resumed ${sessionId}`;
  addToolStep(state, `resumed ${sessionId}`);
}
async function runSlashCommand(line, options, state, runtimeRef, appStateRef) {
  const commandLine = line.slice(1).trim();
  if (!commandLine) {
    state.entries.push({
      kind: "system",
      text: "可用命令：/help /tools /sessions [--limit N] [--status ready|needs_attention] /inspect <id> /export-session <id> [--format markdown|json] [--output path] /transcript <id> /rm-session <id> /cleanup-sessions --keep N [--dry-run] /expand [n|all] /collapse [n|all] /filter [all|failed|tools] /resume [id|latest|failed] /new /clear /quit"
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
        text: "已创建新会话。"
      }
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
        "  /quit"
      ].join(`
`)
    });
    return;
  }
  if (commandLine.startsWith("expand")) {
    const [, rawTarget] = commandLine.split(/\s+/, 2);
    const target = !rawTarget || rawTarget === "all" ? "all" : Number(rawTarget);
    const count = updateFoldState(state, target === "all" || Number.isNaN(target) ? "all" : target, true);
    state.status = `Expanded ${count} result block(s)`;
    return;
  }
  if (commandLine.startsWith("collapse")) {
    const [, rawTarget] = commandLine.split(/\s+/, 2);
    const target = !rawTarget || rawTarget === "all" ? "all" : Number(rawTarget);
    const count = updateFoldState(state, target === "all" || Number.isNaN(target) ? "all" : target, false);
    state.status = `Collapsed ${count} result block(s)`;
    return;
  }
  if (commandLine.startsWith("filter")) {
    const [, rawTarget] = commandLine.split(/\s+/, 2);
    if (rawTarget !== "all" && rawTarget !== "failed" && rawTarget !== "tools") {
      state.entries.push({
        kind: "error",
        text: "filter 只支持 all、failed、tools。"
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
    const target = !rawTarget || rawTarget === "latest" ? sessions[0]?.id : rawTarget === "failed" ? sessions.find((session) => session.status === "needs_attention")?.id : rawTarget;
    if (!target) {
      state.entries.push({
        kind: "error",
        text: "没有可恢复的会话。"
      });
      return;
    }
    await restoreSession(options.cwd, appStateRef, state, runtimeRef, target);
    return;
  }
  const result = await executeCliCommand(options.cwd, tokenizeCommandLine(commandLine), options.autoApprove ?? false);
  if (result.kind === "meta") {
    state.entries.push({ kind: "system", text: result.output });
    return;
  }
  if (result.kind === "utility") {
    state.entries.push({
      kind: "system",
      text: formatUnknown(result.output)
    });
    return;
  }
  state.entries.push({
    kind: "system",
    text: `直接执行工具 ${result.tool} 完成。
${formatUnknown(result.output)}`
  });
  addToolStep(state, `slash tool ${result.tool}`);
}
async function startTui(options) {
  if (!input2.isTTY || !output2.isTTY) {
    throw new Error("TUI 模式需要在交互式终端中运行。");
  }
  const appStateRef = { current: createInitialAppState() };
  const runtimeRef = { current: createRuntime(options.cwd, appStateRef) };
  const state = {
    entries: [
      {
        kind: "system",
        text: "输入自然语言让我执行本地动作，或输入 /help 查看命令。"
      }
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
      detail: "waiting for prompt"
    },
    currentSessionId: runtimeRef.current.session.sessionId,
    activityStartedAt: null,
    nextCollapseKey: 1,
    nextStepSeq: 1,
    timelineFilter: "all"
  };
  const availableSessions = await listSessions(options.cwd);
  if (availableSessions.length > 0) {
    state.entries.push({
      kind: "system",
      text: `发现最近会话 ${availableSessions[0].id}。输入 /resume latest 可恢复；若要回到异常会话，使用 /resume failed。`
    });
  }
  let exiting = false;
  const cleanup = () => {
    output2.write("\x1B[?1049l\x1B[?25h");
    input2.removeListener("keypress", onKeypress);
    output2.removeListener("resize", onResize);
    if (input2.isTTY) {
      input2.setRawMode(false);
    }
  };
  const onResize = () => {
    renderScreen(state, runtimeRef);
  };
  const requestPermission = async (request) => {
    if (options.autoApprove) {
      setCurrentActivity(state, {
        phase: "approval",
        toolName: request.toolName,
        detail: "auto-approved",
        lastResult: "approved"
      });
      addActivityStep(state, `auto-approved ${request.toolName}`, "permission", "done");
      return true;
    }
    state.status = `Waiting for permission: ${request.toolName}`;
    setCurrentActivity(state, {
      phase: "approval",
      toolName: request.toolName,
      detail: request.message
    });
    addActivityStep(state, `permission ${request.toolName}`, "permission", "info");
    renderScreen(state, runtimeRef);
    return new Promise((resolve2) => {
      state.modal = {
        title: `Permission · ${request.toolName}`,
        message: request.message,
        toolName: request.toolName,
        inputValue: request.input,
        resolve: (decision) => {
          state.modal = null;
          const allowed = decision !== "deny";
          if (decision === "allow-session") {
            const tool = findToolByName(getTools(), request.toolName);
            if (tool) {
              rememberPermissionRule(runtimeRef.current.toolContext, tool, request.input);
            }
          }
          state.status = allowed ? `Approved ${request.toolName}` : `Rejected ${request.toolName}`;
          setCurrentActivity(state, {
            phase: allowed ? "done" : "failed",
            toolName: request.toolName,
            detail: allowed ? "permission granted" : "permission denied",
            lastResult: allowed ? "approved" : "rejected"
          });
          addActivityStep(state, `${allowed ? "approved" : "rejected"} ${request.toolName}`, "permission", allowed ? "done" : "failed");
          resolve2(allowed);
        }
      };
      renderScreen(state, runtimeRef);
    });
  };
  const submitPrompt = async (line) => {
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
    runtimeRef.current.toolContext.abortController = new AbortController;
    setCurrentActivity(state, trimmed.startsWith("/") ? {
      phase: "planning",
      detail: "running slash command"
    } : {
      phase: "planning",
      detail: "planning response"
    });
    state.entries.push({
      kind: trimmed.startsWith("/") ? "system" : "user",
      text: trimmed
    });
    state.scrollOffset = 0;
    if (!trimmed.startsWith("/")) {
      addActivityStep(state, `prompt ${trimmed.slice(0, 32)}`, "prompt", "info");
    }
    renderScreen(state, runtimeRef);
    try {
      if (trimmed.startsWith("/")) {
        await runSlashCommand(trimmed, options, state, runtimeRef, appStateRef);
      } else {
        const userMessage = {
          id: createId("user"),
          type: "user",
          content: trimmed
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
          onPermissionRequest: requestPermission
        })) {
          if (message.type === "assistant" && message.content.some((block) => block.type === "text")) {
            state.streamingAssistantText = "";
          }
          await runtimeRef.current.session.recordMessages([message]);
          const wasAtBottom = state.scrollOffset === 0;
          state.entries.push(...makeConversationEntries(state, message));
          if (message.type === "assistant") {
            const toolUse = message.content.find((block) => block.type === "tool_use");
            if (toolUse && toolUse.type === "tool_use") {
              setCurrentActivity(state, {
                phase: "running",
                toolName: toolUse.name,
                detail: "tool executing"
              });
              addActivityStep(state, `run ${toolUse.name}`, "tool", "info");
            }
          }
          if (message.type === "tool_result") {
            const previousToolName = state.currentActivity?.toolName;
            const durationMs = state.activityStartedAt === null ? undefined : Date.now() - state.activityStartedAt;
            setCurrentActivity(state, {
              phase: message.isError ? "failed" : "done",
              toolName: previousToolName,
              detail: message.isError ? "tool returned error" : "tool completed",
              lastResult: message.isError ? "error" : "ok"
            });
            addActivityStep(state, `${message.isError ? "error" : "done"} ${previousToolName ?? (message.toolUseId?.slice(0, 10) ?? "unknown-tool")}`, message.isError ? "error" : "tool", message.isError ? "failed" : "done", durationMs);
          }
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
          lastResult: state.currentActivity?.lastResult ?? "ok"
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const interrupted = runtimeRef.current.toolContext.abortController.signal.aborted;
      state.entries.push({
        kind: interrupted ? "system" : "error",
        text: interrupted ? "当前 turn 已中断。" : message
      });
      state.status = interrupted ? "Interrupted" : "Error";
      state.streamingAssistantText = "";
      const durationMs = state.activityStartedAt === null ? undefined : Date.now() - state.activityStartedAt;
      setCurrentActivity(state, {
        phase: "failed",
        detail: interrupted ? "interrupted by user" : message,
        lastResult: interrupted ? "interrupted" : "error"
      });
      addActivityStep(state, interrupted ? "interrupted current turn" : `error ${message.slice(0, 24)}`, interrupted ? "session" : "error", "failed", durationMs);
    } finally {
      state.busy = false;
      state.activityStartedAt = null;
      state.streamingAssistantText = "";
      renderScreen(state, runtimeRef);
    }
  };
  const onKeypress = (str, key) => {
    if (exiting) {
      return;
    }
    if (state.modal) {
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
    if (key.ctrl && key.name === "c") {
      if (state.busy) {
        runtimeRef.current.toolContext.abortController.abort(new Error("User interrupted current turn"));
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
      output2.write("\x1B[2J\x1B[H");
      renderScreen(state, runtimeRef);
      return;
    }
    if (state.busy) {
      return;
    }
    if (key.name === "return") {
      const current = state.inputBuffer;
      state.inputBuffer = "";
      submitPrompt(current);
      return;
    }
    if (key.name === "backspace") {
      state.inputBuffer = state.inputBuffer.slice(0, -1);
      renderScreen(state, runtimeRef);
      return;
    }
    if (key.name === "escape") {
      state.inputBuffer = "";
      renderScreen(state, runtimeRef);
      return;
    }
    if (key.name === "up") {
      state.scrollOffset += 1;
      renderScreen(state, runtimeRef);
      return;
    }
    if (key.name === "down") {
      state.scrollOffset = Math.max(0, state.scrollOffset - 1);
      renderScreen(state, runtimeRef);
      return;
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
    if (!str || key.ctrl || key.meta) {
      return;
    }
    state.inputBuffer += str;
    renderScreen(state, runtimeRef);
  };
  output2.write("\x1B[?1049h\x1B[?25l");
  readline3.emitKeypressEvents(input2);
  input2.setRawMode(true);
  input2.resume();
  input2.on("keypress", onKeypress);
  output2.on("resize", onResize);
  renderScreen(state, runtimeRef);
  while (!exiting) {
    await new Promise((resolve2) => setTimeout(resolve2, 50));
  }
  cleanup();
}

// app/main.ts
async function main(argv = process.argv.slice(2)) {
  const autoApprove = argv.includes("--yes");
  const streamOutput = argv.includes("--stream") ? true : argv.includes("--no-stream") ? false : undefined;
  const filteredArgs = argv.filter((arg) => arg !== "--yes" && arg !== "--stream" && arg !== "--no-stream");
  if (filteredArgs.length === 0 || filteredArgs[0] === "tui") {
    await startTui({
      cwd: cwd(),
      autoApprove
    });
    return;
  }
  if (filteredArgs[0] === "repl") {
    await startRepl({
      cwd: cwd(),
      autoApprove
    });
    return;
  }
  await runHeadless({
    cwd: cwd(),
    args: filteredArgs,
    autoApprove,
    streamOutput
  });
}
var isDirectExecution = typeof process !== "undefined" && process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}
`);
    process.exitCode = 1;
  });
}
export {
  main
};

//# debugId=C17128FAF4F411E364756E2164756E21
//# sourceMappingURL=main.js.map
