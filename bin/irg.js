var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// storage/documentIndex.ts
import { mkdir as mkdir5, readFile as readFile4, readdir as readdir2, rm as rm4, writeFile as writeFile4 } from "fs/promises";
import { join as join5 } from "path";
function getDocumentsDir(cwd2) {
  return join5(cwd2, ".irg", "documents");
}
function getDocumentPath(cwd2, docId) {
  return join5(getDocumentsDir(cwd2), `${docId}.json`);
}
async function readDocument(cwd2, docId) {
  try {
    const content = await readFile4(getDocumentPath(cwd2, docId), "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
var init_documentIndex = __esm({
  "storage/documentIndex.ts"() {
    "use strict";
  }
});

// storage/irgMd.ts
var irgMd_exports = {};
__export(irgMd_exports, {
  addDocRef: () => addDocRef,
  getFullInjectionContent: () => getFullInjectionContent,
  isDocInjected: () => isDocInjected,
  parseDocRefs: () => parseDocRefs,
  readIrgMd: () => readIrgMd,
  removeDocRef: () => removeDocRef
});
import { readFile as readFile5, writeFile as writeFile5 } from "fs/promises";
import { join as join6 } from "path";
async function readIrgMd(cwd2) {
  const parts = [];
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  if (homeDir) {
    try {
      const globalContent = await readFile5(join6(homeDir, ".irg", IRG_MD_FILENAME), "utf8");
      if (globalContent.trim()) parts.push(globalContent.trim());
    } catch {
    }
  }
  try {
    const projectContent = await readFile5(join6(cwd2, IRG_MD_FILENAME), "utf8");
    if (projectContent.trim()) parts.push(projectContent.trim());
  } catch {
  }
  try {
    const localContent = await readFile5(join6(cwd2, IRG_LOCAL_FILENAME), "utf8");
    if (localContent.trim()) parts.push(localContent.trim());
  } catch {
  }
  return parts.join("\n\n");
}
function parseDocRefs(content) {
  const refs = [];
  const regex = /@doc:([\w-]+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}
async function addDocRef(cwd2, docId) {
  const filePath = join6(cwd2, IRG_MD_FILENAME);
  let content = "";
  try {
    content = await readFile5(filePath, "utf8");
  } catch {
    content = "# IRG \u9879\u76EE\u6307\u4EE4\n";
  }
  const refLine = `@doc:${docId}`;
  if (content.includes(refLine)) {
    return;
  }
  const sectionHeader = "## \u5DE5\u5177\u53C2\u8003";
  if (content.includes(sectionHeader)) {
    const sectionIndex = content.indexOf(sectionHeader);
    const afterHeader = sectionIndex + sectionHeader.length;
    const nextNewline = content.indexOf("\n", afterHeader);
    const insertAt = nextNewline === -1 ? content.length : nextNewline + 1;
    content = content.slice(0, insertAt) + refLine + "\n" + content.slice(insertAt);
  } else {
    content = content.trimEnd() + "\n\n" + sectionHeader + "\n" + refLine + "\n";
  }
  await writeFile5(filePath, content, "utf8");
}
async function removeDocRef(cwd2, docId) {
  const filePath = join6(cwd2, IRG_MD_FILENAME);
  let content;
  try {
    content = await readFile5(filePath, "utf8");
  } catch {
    return;
  }
  const refLine = `@doc:${docId}`;
  if (!content.includes(refLine)) {
    return;
  }
  const lines = content.split("\n");
  const filtered = lines.filter((line) => line.trim() !== refLine);
  content = filtered.join("\n");
  content = content.replace(/## 工具参考\n+$/m, "");
  await writeFile5(filePath, content, "utf8");
}
async function isDocInjected(cwd2, docId) {
  try {
    const content = await readIrgMd(cwd2);
    return content.includes(`@doc:${docId}`);
  } catch {
    return false;
  }
}
async function getFullInjectionContent(cwd2) {
  const irgContent = await readIrgMd(cwd2);
  if (!irgContent.trim()) return "";
  const docRefs = parseDocRefs(irgContent);
  if (docRefs.length === 0) return irgContent;
  const docContents = [];
  for (const docId of docRefs) {
    try {
      const doc = await readDocument(cwd2, docId);
      if (doc) {
        docContents.push(`### ${doc.title}

${doc.content}`);
      }
    } catch {
    }
  }
  if (docContents.length === 0) return irgContent;
  let result = irgContent;
  for (const docId of docRefs) {
    const refLine = `@doc:${docId}`;
    result = result.replace(refLine, `<!-- injected: ${docId} -->`);
  }
  result += "\n\n## Injected Tool Reference Documents\n\n";
  result += docContents.join("\n\n---\n\n");
  return result;
}
var IRG_MD_FILENAME, IRG_LOCAL_FILENAME;
var init_irgMd = __esm({
  "storage/irgMd.ts"() {
    "use strict";
    init_documentIndex();
    IRG_MD_FILENAME = "irg.md";
    IRG_LOCAL_FILENAME = "irg.local.md";
  }
});

// node_modules/picocolors/picocolors.js
var require_picocolors = __commonJS({
  "node_modules/picocolors/picocolors.js"(exports, module) {
    var p = process || {};
    var argv = p.argv || [];
    var env = p.env || {};
    var isColorSupported = !(!!env.NO_COLOR || argv.includes("--no-color")) && (!!env.FORCE_COLOR || argv.includes("--color") || p.platform === "win32" || (p.stdout || {}).isTTY && env.TERM !== "dumb" || !!env.CI);
    var formatter = (open, close, replace = open) => (input3) => {
      let string = "" + input3, index = string.indexOf(close, open.length);
      return ~index ? open + replaceClose(string, close, replace, index) + close : open + string + close;
    };
    var replaceClose = (string, close, replace, index) => {
      let result = "", cursor = 0;
      do {
        result += string.substring(cursor, index) + replace;
        cursor = index + close.length;
        index = string.indexOf(close, cursor);
      } while (~index);
      return result + string.substring(cursor);
    };
    var createColors = (enabled = isColorSupported) => {
      let f = enabled ? formatter : () => String;
      return {
        isColorSupported: enabled,
        reset: f("\x1B[0m", "\x1B[0m"),
        bold: f("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m"),
        dim: f("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"),
        italic: f("\x1B[3m", "\x1B[23m"),
        underline: f("\x1B[4m", "\x1B[24m"),
        inverse: f("\x1B[7m", "\x1B[27m"),
        hidden: f("\x1B[8m", "\x1B[28m"),
        strikethrough: f("\x1B[9m", "\x1B[29m"),
        black: f("\x1B[30m", "\x1B[39m"),
        red: f("\x1B[31m", "\x1B[39m"),
        green: f("\x1B[32m", "\x1B[39m"),
        yellow: f("\x1B[33m", "\x1B[39m"),
        blue: f("\x1B[34m", "\x1B[39m"),
        magenta: f("\x1B[35m", "\x1B[39m"),
        cyan: f("\x1B[36m", "\x1B[39m"),
        white: f("\x1B[37m", "\x1B[39m"),
        gray: f("\x1B[90m", "\x1B[39m"),
        bgBlack: f("\x1B[40m", "\x1B[49m"),
        bgRed: f("\x1B[41m", "\x1B[49m"),
        bgGreen: f("\x1B[42m", "\x1B[49m"),
        bgYellow: f("\x1B[43m", "\x1B[49m"),
        bgBlue: f("\x1B[44m", "\x1B[49m"),
        bgMagenta: f("\x1B[45m", "\x1B[49m"),
        bgCyan: f("\x1B[46m", "\x1B[49m"),
        bgWhite: f("\x1B[47m", "\x1B[49m"),
        blackBright: f("\x1B[90m", "\x1B[39m"),
        redBright: f("\x1B[91m", "\x1B[39m"),
        greenBright: f("\x1B[92m", "\x1B[39m"),
        yellowBright: f("\x1B[93m", "\x1B[39m"),
        blueBright: f("\x1B[94m", "\x1B[39m"),
        magentaBright: f("\x1B[95m", "\x1B[39m"),
        cyanBright: f("\x1B[96m", "\x1B[39m"),
        whiteBright: f("\x1B[97m", "\x1B[39m"),
        bgBlackBright: f("\x1B[100m", "\x1B[49m"),
        bgRedBright: f("\x1B[101m", "\x1B[49m"),
        bgGreenBright: f("\x1B[102m", "\x1B[49m"),
        bgYellowBright: f("\x1B[103m", "\x1B[49m"),
        bgBlueBright: f("\x1B[104m", "\x1B[49m"),
        bgMagentaBright: f("\x1B[105m", "\x1B[49m"),
        bgCyanBright: f("\x1B[106m", "\x1B[49m"),
        bgWhiteBright: f("\x1B[107m", "\x1B[49m")
      };
    };
    module.exports = createColors();
    module.exports.createColors = createColors;
  }
});

// node_modules/is-dark/dist/index.js
var require_dist = __commonJS({
  "node_modules/is-dark/dist/index.js"(exports) {
    "use strict";
    exports.__esModule = true;
    var DarkModeHandler = (
      /** @class */
      /* @__PURE__ */ (function() {
        function DarkModeHandler2() {
          var _this = this;
          this.isNode = false;
          this.state = "light";
          this.subscribers = [];
          this.isDarkMode = function() {
            if (_this.isNode)
              return false;
            return _this.state === "dark";
          };
          this.subscribeToColorScheme = function(method) {
            _this.subscribers.push(method);
          };
          this.clearSubscribers = function() {
            _this.subscribers = [];
          };
          this.handleUiChange = function(e) {
            _this.state = e.matches ? "dark" : "light";
            if (_this.subscribers.length > 0) {
              _this.subscribers.forEach(function(subscriber) {
                subscriber(_this.state);
              });
            }
          };
          if (typeof window === "undefined") {
            this.isNode = true;
            return;
          }
          this.media = window.matchMedia("(prefers-color-scheme: dark)");
          this.media.addListener(this.handleUiChange);
          this.handleUiChange(this.media);
        }
        return DarkModeHandler2;
      })()
    );
    var dm = new DarkModeHandler();
    exports["default"] = dm.isDarkMode;
    exports.subscribeToColorScheme = dm.subscribeToColorScheme;
  }
});

// app/main.ts
import { cwd } from "process";
import { pathToFileURL } from "url";

// app/headless.ts
import { writeFile as writeFile12 } from "fs/promises";
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
function getTranscriptPath(cwd2, sessionId) {
  return join(cwd2, ".irg", "transcripts", `${sessionId}.jsonl`);
}
async function appendTranscript(cwd2, sessionId, messages) {
  const filePath = getTranscriptPath(cwd2, sessionId);
  await mkdir(join(cwd2, ".irg", "transcripts"), {
    recursive: true
  });
  const lines = messages.map((message) => JSON.stringify(message)).join("\n");
  await appendFile(filePath, `${lines}
`, "utf8");
}
async function readTranscriptMessages(cwd2, sessionId) {
  const { readFile: readFile15, access: access2 } = await import("fs/promises");
  const filePath = getTranscriptPath(cwd2, sessionId);
  try {
    await access2(filePath);
  } catch {
    return [];
  }
  const content = await readFile15(filePath, "utf8");
  return content.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
}
async function deleteTranscript(cwd2, sessionId) {
  await rm(getTranscriptPath(cwd2, sessionId), { force: true });
}

// storage/sessionIndex.ts
import { mkdir as mkdir2, readFile, readdir, rm as rm2, stat, writeFile } from "fs/promises";
import { join as join2 } from "path";
function getSessionsDir(cwd2) {
  return join2(cwd2, ".irg", "sessions");
}
function getTranscriptsDir(cwd2) {
  return join2(cwd2, ".irg", "transcripts");
}
function getSessionInfoPath(cwd2, sessionId) {
  return join2(getSessionsDir(cwd2), `${sessionId}.json`);
}
function getTranscriptPath2(cwd2, sessionId) {
  return join2(getTranscriptsDir(cwd2), `${sessionId}.jsonl`);
}
function getSessionInfoFilePath(cwd2, sessionId) {
  return getSessionInfoPath(cwd2, sessionId);
}
function summarizeText(text, maxLength = 80) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}\u2026`;
}
function extractUserPrompts(messages) {
  return messages.filter(
    (message) => message.type === "user"
  ).map((message) => {
    const text = typeof message.content === "string" ? message.content : message.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return summarizeText(text, 120);
  });
}
function deriveSessionTitle(messages, sessionId) {
  const firstUser = messages.find(
    (message) => message.type === "user"
  );
  if (firstUser) {
    const text = typeof firstUser.content === "string" ? firstUser.content : firstUser.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return summarizeText(text, 72);
  }
  return `session ${sessionId}`;
}
function deriveSessionSummary(messages, status, lastTool, errorCount) {
  const prompts = extractUserPrompts(messages);
  const latestPrompt = prompts[prompts.length - 1];
  const errorSuffix = errorCount && errorCount > 0 ? ` \xB7 ${errorCount} error${errorCount > 1 ? "s" : ""}` : "";
  const prefix = status === "error" ? `needs attention${errorSuffix}` : status === "completed" ? `done${errorSuffix}` : status === "active" ? `active${errorSuffix}` : `idle${errorSuffix}`;
  if (lastTool && latestPrompt) {
    return summarizeText(`${prefix} \xB7 ${lastTool} \xB7 ${latestPrompt}`, 120);
  }
  if (lastTool) {
    return summarizeText(`${prefix} \xB7 ${lastTool}`, 120);
  }
  if (latestPrompt) {
    return summarizeText(`${prefix} \xB7 ${latestPrompt}`, 120);
  }
  return status ? prefix : void 0;
}
function getSessionMetadata(messages) {
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
  return { lastTool, lastError, toolUseCount, errorCount };
}
function deriveSessionStatus(previous, metadata, isActive, currentMessageCount = 0) {
  if (previous?.status === "archived") return "archived";
  if (isActive) return "active";
  if ((metadata.errorCount ?? 0) > 0) return "error";
  if (currentMessageCount > 0 || (previous?.messageCount ?? 0) > 0) return "completed";
  return "idle";
}
function getConfiguredProvider() {
  return process.env.IRG_LLM_PROVIDER?.trim() || void 0;
}
function getConfiguredModel() {
  return process.env.IRG_LLM_MODEL?.trim() || void 0;
}
async function readSessionInfo(cwd2, sessionId) {
  try {
    const content = await readFile(getSessionInfoPath(cwd2, sessionId), "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
async function updateSessionInfo(cwd2, sessionId, messages, isActive = false) {
  const previous = await readSessionInfo(cwd2, sessionId);
  const prompts = extractUserPrompts(messages);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const metadata = getSessionMetadata(messages);
  const status = deriveSessionStatus(previous, metadata, isActive, messages.length);
  const next = {
    id: sessionId,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    lastActiveAt: isActive ? now : previous?.lastActiveAt,
    messageCount: messages.length,
    title: previous?.title || deriveSessionTitle(messages, sessionId),
    summary: deriveSessionSummary(
      messages,
      status,
      metadata.lastTool,
      metadata.errorCount
    ) || previous?.summary,
    firstPrompt: prompts[0],
    lastPrompt: prompts[prompts.length - 1],
    provider: getConfiguredProvider() || previous?.provider,
    model: getConfiguredModel() || previous?.model,
    parentId: previous?.parentId,
    taskId: previous?.taskId,
    checkedInTasks: previous?.checkedInTasks,
    status,
    ...metadata
  };
  await mkdir2(getSessionsDir(cwd2), { recursive: true });
  await writeFile(
    getSessionInfoPath(cwd2, sessionId),
    `${JSON.stringify(next, null, 2)}
`,
    "utf8"
  );
  return next;
}
async function listSessions(cwd2) {
  const infos = /* @__PURE__ */ new Map();
  try {
    const entries = await readdir(getSessionsDir(cwd2));
    for (const entry of entries) {
      if (!entry.endsWith(".json")) {
        continue;
      }
      const sessionId = entry.replace(/\.json$/, "");
      const info = await readSessionInfo(cwd2, sessionId);
      if (info) {
        infos.set(sessionId, info);
      }
    }
  } catch {
  }
  try {
    const entries = await readdir(getTranscriptsDir(cwd2));
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
          const content = await readFile(
            getTranscriptPath2(cwd2, sessionId),
            "utf8"
          );
          const messages = content.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
          const prompts = extractUserPrompts(messages);
          const metadata = getSessionMetadata(messages);
          const fallbackStatus = (metadata.errorCount ?? 0) > 0 ? "error" : "completed";
          infos.set(sessionId, {
            ...current,
            title: deriveSessionTitle(messages, sessionId),
            summary: deriveSessionSummary(
              messages,
              fallbackStatus,
              metadata.lastTool,
              metadata.errorCount
            ),
            firstPrompt: prompts[0],
            lastPrompt: prompts[prompts.length - 1],
            messageCount: messages.length,
            updatedAt: (await stat(getTranscriptPath2(cwd2, sessionId)).catch(() => null))?.mtime.toISOString() || current.updatedAt,
            status: fallbackStatus,
            ...metadata
          });
        } catch {
        }
      }
    }
  } catch {
  }
  for (const [id, info] of infos) {
    if (isSessionStale(info)) {
      infos.set(id, { ...info, status: "idle" });
    }
  }
  const statusOrder = {
    error: 0,
    active: 1,
    completed: 2,
    idle: 3,
    archived: 4
  };
  return [...infos.values()].sort((left, right) => {
    const leftRank = statusOrder[left.status ?? "idle"] ?? 3;
    const rightRank = statusOrder[right.status ?? "idle"] ?? 3;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    const leftTime = left.updatedAt || left.createdAt || "";
    const rightTime = right.updatedAt || right.createdAt || "";
    return rightTime.localeCompare(leftTime);
  });
}
async function deleteSessionInfo(cwd2, sessionId) {
  await rm2(getSessionInfoPath(cwd2, sessionId), { force: true });
}
async function touchSession(cwd2, sessionId) {
  const previous = await readSessionInfo(cwd2, sessionId);
  if (!previous) return;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const next = {
    ...previous,
    lastActiveAt: now,
    status: previous.status === "archived" ? "archived" : "active"
  };
  await mkdir2(getSessionsDir(cwd2), { recursive: true });
  await writeFile(
    getSessionInfoPath(cwd2, sessionId),
    `${JSON.stringify(next, null, 2)}
`,
    "utf8"
  );
}
async function closeSession(cwd2, sessionId) {
  const previous = await readSessionInfo(cwd2, sessionId);
  if (!previous) return;
  const finalStatus = (previous.errorCount ?? 0) > 0 ? "error" : "completed";
  const next = {
    ...previous,
    status: finalStatus,
    checkedInTasks: []
  };
  await mkdir2(getSessionsDir(cwd2), { recursive: true });
  await writeFile(
    getSessionInfoPath(cwd2, sessionId),
    `${JSON.stringify(next, null, 2)}
`,
    "utf8"
  );
}
async function checkinToTask(cwd2, sessionId, taskId) {
  const previous = await readSessionInfo(cwd2, sessionId);
  if (!previous) return;
  const tasks = new Set(previous.checkedInTasks || []);
  tasks.add(taskId);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const next = {
    ...previous,
    lastActiveAt: now,
    checkedInTasks: [...tasks],
    status: "active"
  };
  await mkdir2(getSessionsDir(cwd2), { recursive: true });
  await writeFile(
    getSessionInfoPath(cwd2, sessionId),
    `${JSON.stringify(next, null, 2)}
`,
    "utf8"
  );
}
async function checkoutFromTask(cwd2, sessionId, taskId) {
  const previous = await readSessionInfo(cwd2, sessionId);
  if (!previous) return;
  const tasks = (previous.checkedInTasks || []).filter((t) => t !== taskId);
  const next = {
    ...previous,
    checkedInTasks: tasks
  };
  await mkdir2(getSessionsDir(cwd2), { recursive: true });
  await writeFile(
    getSessionInfoPath(cwd2, sessionId),
    `${JSON.stringify(next, null, 2)}
`,
    "utf8"
  );
}
var STALE_THRESHOLD_MS = 60 * 60 * 1e3;
function isSessionStale(info, thresholdMs = STALE_THRESHOLD_MS) {
  if (info.status !== "active") return false;
  if (!info.lastActiveAt) return true;
  return Date.now() - new Date(info.lastActiveAt).getTime() > thresholdMs;
}

// shared/eventBus.ts
import { EventEmitter } from "events";
var TypedEventBus = class extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0);
  }
  emit(event, data) {
    return super.emit(event, data);
  }
  on(event, listener) {
    return super.on(event, listener);
  }
  off(event, listener) {
    return super.off(event, listener);
  }
  once(event, listener) {
    return super.once(event, listener);
  }
};
var eventBus = new TypedEventBus();

// runtime/usage.ts
function emptyUsage() {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0
  };
}

// storage/knowledge.ts
import { mkdir as mkdir3, readFile as readFile2, writeFile as writeFile2 } from "fs/promises";
import { join as join3 } from "path";

// shared/ids.ts
import { randomUUID } from "crypto";
function createId(prefix = "id") {
  return `${prefix}-${randomUUID()}`;
}

// storage/knowledge.ts
var MAX_ENTRIES = 100;
var CHAR_LIMIT = 500;
function getKnowledgePath(cwd2) {
  return join3(cwd2, ".irg", "knowledge.json");
}
function emptyStore() {
  return { entries: [], version: 1 };
}
async function loadKnowledgeStore(cwd2) {
  try {
    const content = await readFile2(getKnowledgePath(cwd2), "utf8");
    return JSON.parse(content);
  } catch {
    return emptyStore();
  }
}
async function saveKnowledgeStore(cwd2, store) {
  await mkdir3(join3(cwd2, ".irg"), { recursive: true });
  await writeFile2(
    getKnowledgePath(cwd2),
    JSON.stringify(store, null, 2),
    "utf8"
  );
}
async function addKnowledge(cwd2, category, content, source, tags = [], confidence = 0.7) {
  if (!content.trim()) return null;
  const truncated = content.length > CHAR_LIMIT ? content.slice(0, CHAR_LIMIT - 3) + "..." : content;
  const store = await loadKnowledgeStore(cwd2);
  const duplicate = store.entries.find(
    (e) => e.content === truncated && e.category === category
  );
  if (duplicate) {
    duplicate.confidence = Math.min(1, duplicate.confidence + 0.1);
    duplicate.usageCount += 1;
    duplicate.lastUsed = (/* @__PURE__ */ new Date()).toISOString();
    await saveKnowledgeStore(cwd2, store);
    return duplicate;
  }
  if (store.entries.length >= MAX_ENTRIES) {
    store.entries.sort((a, b) => {
      const scoreA = a.confidence * 0.6 + a.usageCount / 10 * 0.4;
      const scoreB = b.confidence * 0.6 + b.usageCount / 10 * 0.4;
      return scoreA - scoreB;
    });
    store.entries = store.entries.slice(1);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const entry = {
    id: createId("knowledge"),
    category,
    content: truncated,
    source,
    confidence,
    usageCount: 0,
    lastUsed: now,
    createdAt: now,
    tags
  };
  store.entries.push(entry);
  store.version += 1;
  await saveKnowledgeStore(cwd2, store);
  return entry;
}
function knowledgeToSystemPrompt(entries) {
  if (entries.length === 0) return "";
  const lines = ["=== PERSISTENT KNOWLEDGE ==="];
  const grouped = {
    fact: [],
    preference: [],
    pattern: [],
    anti_pattern: []
  };
  for (const entry of entries) {
    grouped[entry.category].push(entry);
  }
  if (grouped.anti_pattern.length > 0) {
    lines.push("\n--- Anti-Patterns (AVOID these) ---");
    for (const entry of grouped.anti_pattern) {
      lines.push(`- [${entry.confidence.toFixed(1)}] ${entry.content}`);
    }
  }
  if (grouped.preference.length > 0) {
    lines.push("\n--- User Preferences ---");
    for (const entry of grouped.preference) {
      lines.push(`- [${entry.confidence.toFixed(1)}] ${entry.content}`);
    }
  }
  if (grouped.fact.length > 0) {
    lines.push("\n--- Project Facts ---");
    for (const entry of grouped.fact) {
      lines.push(`- [${entry.confidence.toFixed(1)}] ${entry.content}`);
    }
  }
  if (grouped.pattern.length > 0) {
    lines.push("\n--- Success Patterns ---");
    for (const entry of grouped.pattern) {
      lines.push(`- [${entry.confidence.toFixed(1)}] ${entry.content}`);
    }
  }
  return lines.join("\n");
}

// storage/memory.ts
import { mkdir as mkdir4, readFile as readFile3, writeFile as writeFile3 } from "fs/promises";
import { join as join4 } from "path";
var MEMORY_CHAR_LIMIT = 3575;
function getMemoryPath(cwd2) {
  return join4(cwd2, ".irg", "Memory.md");
}
async function loadMemory(cwd2) {
  try {
    return await readFile3(getMemoryPath(cwd2), "utf8");
  } catch {
    return "";
  }
}
async function saveMemory(cwd2, content) {
  await mkdir4(join4(cwd2, ".irg"), { recursive: true });
  const truncated = content.length > MEMORY_CHAR_LIMIT ? content.slice(0, MEMORY_CHAR_LIMIT) : content;
  await writeFile3(getMemoryPath(cwd2), truncated, "utf8");
}
async function rebuildMemoryFromKnowledge(cwd2) {
  const store = await loadKnowledgeStore(cwd2);
  const sorted = [...store.entries].sort((a, b) => {
    if (a.category === "anti_pattern" && b.category !== "anti_pattern") return -1;
    if (b.category === "anti_pattern" && a.category !== "anti_pattern") return 1;
    return b.confidence - a.confidence;
  });
  const prompt = knowledgeToSystemPrompt(sorted);
  await saveMemory(cwd2, prompt);
  return prompt;
}
async function getMemoryForSystemPrompt(cwd2) {
  const memory = await loadMemory(cwd2);
  if (memory.trim()) return memory;
  const rebuilt = await rebuildMemoryFromKnowledge(cwd2);
  return rebuilt;
}

// runtime/session.ts
function extractKnowledgeFromMessages(messages) {
  const insights = [];
  let errorCount = 0;
  let toolUseCount = 0;
  const toolsUsed = /* @__PURE__ */ new Set();
  const errorTools = /* @__PURE__ */ new Set();
  for (const msg of messages) {
    if (msg.type === "assistant") {
      const aMsg = msg;
      for (const block of aMsg.content) {
        if (block.type === "tool_use") {
          toolUseCount += 1;
          toolsUsed.add(block.name);
        }
      }
    }
    if (msg.type === "tool_result" && msg.isError) {
      errorCount += 1;
      for (const prevMsg of messages) {
        if (prevMsg.type === "assistant") {
          const aMsg = prevMsg;
          for (const block of aMsg.content) {
            if (block.type === "tool_use" && block.id === msg.toolUseId) {
              errorTools.add(block.name);
            }
          }
        }
      }
    }
  }
  if (errorTools.size > 0) {
    for (const tool of errorTools) {
      insights.push({
        category: "anti_pattern",
        content: `Tool "${tool}" produced errors in this session. Consider alternative approaches or verify inputs before using ${tool}.`,
        tags: ["error", tool, "anti-pattern"]
      });
    }
  }
  if (toolUseCount > 15) {
    insights.push({
      category: "pattern",
      content: `High tool usage (${toolUseCount} calls) suggests complex task. Consider using sub-agents or teams for similar tasks to reduce context pollution.`,
      tags: ["efficiency", "tool-usage"]
    });
  }
  const userMessages = messages.filter((m) => m.type === "user");
  if (userMessages.length > 3) {
    const userContents = userMessages.map((m) => {
      if (m.type !== "user") return "";
      return typeof m.content === "string" ? m.content : m.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    });
    const hasCorrection = userContents.some((c, i) => {
      if (i === 0) return false;
      const lower = c.toLowerCase();
      return lower.includes("no,") || lower.includes("not like that") || lower.includes("wrong") || lower.includes("try again") || lower.includes("different");
    });
    if (hasCorrection) {
      insights.push({
        category: "anti_pattern",
        content: "User had to correct the assistant multiple times. Initial approach may not match user expectations. Ask clarifying questions earlier.",
        tags: ["user-correction", "communication"]
      });
    }
  }
  return insights;
}
var SessionEngine = class {
  constructor(config) {
    this.config = config;
  }
  config;
  messages = [];
  usage = emptyUsage();
  knowledgeExtracted = false;
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
    if (this.config.autoExtractKnowledge && !this.knowledgeExtracted) {
      const hasAssistantText = messages.some(
        (m) => m.type === "assistant" && m.content.some(
          (b) => b.type === "text" && b.text.trim().length > 0
        )
      );
      if (hasAssistantText) {
        this.knowledgeExtracted = true;
        this.extractAndPersistKnowledge().catch((err) => {
          console.error("[Session] Auto knowledge extraction failed:", err);
        });
      }
    }
  }
  getTranscriptPath() {
    return getTranscriptPath(this.cwd, this.sessionId);
  }
  getUsage() {
    return { ...this.usage };
  }
  async touch() {
    await touchSession(this.config.cwd, this.sessionId);
    eventBus.emit("session:heartbeat", {
      sessionId: this.sessionId,
      timestamp: Date.now()
    });
  }
  async close() {
    await closeSession(this.config.cwd, this.sessionId);
    eventBus.emit("session:closed", {
      sessionId: this.sessionId,
      timestamp: Date.now()
    });
  }
  async checkinTask(taskId) {
    await checkinToTask(this.config.cwd, this.sessionId, taskId);
  }
  async checkoutTask(taskId) {
    await checkoutFromTask(this.config.cwd, this.sessionId, taskId);
  }
  async extractAndPersistKnowledge() {
    const insights = extractKnowledgeFromMessages(this.messages);
    let added = 0;
    for (const insight of insights) {
      const entry = await addKnowledge(
        this.cwd,
        insight.category,
        insight.content,
        "user_implicit",
        insight.tags
      );
      if (entry) added += 1;
    }
    if (added > 0) {
      await rebuildMemoryFromKnowledge(this.cwd);
    }
    return added;
  }
};

// permissions/engine.ts
function getInputPattern(input3) {
  if (typeof input3 !== "object" || input3 === null) {
    return void 0;
  }
  if ("path" in input3 && typeof input3.path === "string" && input3.path.trim()) {
    return input3.path.trim();
  }
  if ("command" in input3 && typeof input3.command === "string" && input3.command.trim()) {
    return input3.command.trim();
  }
  if ("url" in input3 && typeof input3.url === "string" && input3.url.trim()) {
    return input3.url.trim();
  }
  if ("description" in input3 && typeof input3.description === "string" && input3.description.trim()) {
    return input3.description.trim();
  }
  return void 0;
}
function matchesRule(rule, tool, input3) {
  if (rule.toolName !== tool.name) {
    return false;
  }
  if (!rule.pattern) {
    return true;
  }
  return getInputPattern(input3) === rule.pattern;
}
function checkMatrix(matrix, tool) {
  if (!matrix || !tool.resourceType || !tool.actionType) return void 0;
  const resource = matrix[tool.resourceType];
  if (!resource) return void 0;
  const allowed = resource[tool.actionType];
  return allowed;
}
function rememberPermissionRule(context, tool, input3) {
  const rule = {
    toolName: tool.name,
    pattern: getInputPattern(input3)
  };
  context.setAppState((prev) => {
    const exists = prev.permissionContext.allowRules.some(
      (existing) => existing.toolName === rule.toolName && existing.pattern === rule.pattern
    );
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
var canUseTool = async (tool, input3, context, _parentMessage, _toolUseId) => {
  const validation = await tool.validateInput?.(input3, context);
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
      updatedInput: input3
    };
  }
  const matrixResult = checkMatrix(permissionContext.matrix, tool);
  if (matrixResult === true) {
    return { behavior: "allow", updatedInput: input3 };
  }
  if (matrixResult === false) {
    return {
      behavior: "deny",
      message: `Tool ${tool.name} is blocked by permission matrix (${tool.resourceType}:${tool.actionType})`
    };
  }
  if (permissionContext.denyRules.some((rule) => matchesRule(rule, tool, input3))) {
    return {
      behavior: "deny",
      message: `Tool ${tool.name} is blocked by a session rule`
    };
  }
  if (permissionContext.allowRules.some((rule) => matchesRule(rule, tool, input3))) {
    return {
      behavior: "allow",
      updatedInput: input3
    };
  }
  if (permissionContext.askRules.some((rule) => matchesRule(rule, tool, input3))) {
    return {
      behavior: "ask",
      message: `Tool ${tool.name} requires confirmation by a session rule`,
      updatedInput: input3
    };
  }
  const toolDecision = await tool.checkPermissions?.(input3, context);
  if (toolDecision) {
    return toolDecision;
  }
  if (tool.isReadOnly(input3)) {
    return {
      behavior: "allow",
      updatedInput: input3
    };
  }
  return {
    behavior: "ask",
    message: `Tool ${tool.name} requires confirmation`,
    updatedInput: input3
  };
};

// runtime/llm.ts
var cachedConfig = null;
function getLlmConfig() {
  return cachedConfig;
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
    }).filter(Boolean).join("\n");
  }
  return "";
}
function parseToolArguments(raw) {
  if (raw === null || raw === void 0) {
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
      content: allSystem.join("\n\n")
    });
  }
  for (const message of messages) {
    if (message.type === "user") {
      if (typeof message.content === "string") {
        apiMessages.push({ role: "user", content: message.content });
      } else {
        const openAiContent = message.content.map((block) => {
          if (block.type === "text") {
            return { type: "text", text: block.text };
          } else if (block.type === "image") {
            return { type: "image_url", image_url: { url: `data:${block.mimeType};base64,${block.data}` } };
          }
          return { type: "text", text: "" };
        });
        apiMessages.push({ role: "user", content: openAiContent });
      }
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
    const toolBlocks = message.content.filter(
      (block) => block.type === "tool_use"
    );
    apiMessages.push({
      role: "assistant",
      content: textBlocks.length > 0 ? textBlocks.join("\n\n") : null,
      tool_calls: toolBlocks.length > 0 ? toolBlocks.map((block) => ({
        id: block.id,
        type: "function",
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input ?? {})
        }
      })) : void 0
    });
  }
  return apiMessages;
}
function toAnthropicMessages(messages) {
  const apiMessages = [];
  for (const message of messages) {
    if (message.type === "user") {
      if (typeof message.content === "string") {
        apiMessages.push({
          role: "user",
          content: [{ type: "text", text: message.content }]
        });
      } else {
        const anthropicContent = message.content.map((block) => {
          if (block.type === "text") {
            return { type: "text", text: block.text };
          } else if (block.type === "image") {
            return { type: "image", source: { type: "base64", media_type: block.mimeType, data: block.data } };
          }
          return { type: "text", text: "" };
        });
        apiMessages.push({
          role: "user",
          content: anthropicContent
        });
      }
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
      content: message.content.map(
        (block) => block.type === "text" ? { type: "text", text: block.text } : {
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input
        }
      )
    });
  }
  return apiMessages;
}
async function readSseEvents(response, onEvent) {
  if (!response.body) {
    throw new Error("Streaming response body is missing");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      let eventName = null;
      for (const line of frame.split("\n")) {
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
    const toolCallsByIndex = /* @__PURE__ */ new Map();
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
        messages: toOpenAiMessages(
          params.messages,
          params.systemPrompt,
          config
        ),
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
      throw new Error(
        payload.error?.message || `LLM request failed with status ${response.status}`
      );
    }
    await readSseEvents(response, (_event, data) => {
      const payload = JSON.parse(data);
      const delta = payload.choices?.[0]?.delta;
      if (!delta) {
        return;
      }
      if (delta.content !== void 0 && delta.content !== null) {
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
        system: systemParts.join("\n\n"),
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
      throw new Error(
        payload.error?.message || `LLM request failed with status ${response.status}`
      );
    }
    let accumulatedText = "";
    const toolCallsByIndex = /* @__PURE__ */ new Map();
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
        input: toolCall.input !== void 0 ? toolCall.input : parseToolArguments(toolCall.inputJson)
      }))
    };
  }
};
function getProvider(config) {
  return config.provider === "anthropic" ? anthropicProvider : openAiProvider;
}
async function runLlmTurn(params) {
  const config = getLlmConfig();
  if (!config?.apiKey) {
    throw new Error("LLM is not configured");
  }
  return getProvider(config).runTurn(params, config);
}

// tools/agent/subagentContext.ts
function createSubagentContext(parent, overrides) {
  return {
    ...parent,
    messages: overrides?.messages ?? parent.messages,
    agentId: overrides?.agentId ?? parent.agentId ?? createId("agent"),
    agentType: overrides?.agentType,
    abortController: overrides?.abortController ?? (overrides?.shareAbortController ? parent.abortController : new AbortController()),
    setAppState: overrides?.shareSetAppState ? parent.setAppState : () => {
    }
  };
}

// tools/agent/agentRegistry.ts
var BUILTIN_AGENTS = {
  "general-purpose": {
    name: "general-purpose",
    description: "A general-purpose agent for complex multi-step tasks that require both exploration and modification.",
    systemPrompt: [
      "You are a sub-agent working on a delegated task.",
      "Complete the task autonomously using the tools available to you.",
      "Be thorough but concise in your findings.",
      "When you are done, provide a clear summary of what you found or did."
    ],
    allowedTools: "*",
    maxTurns: 8
  },
  explore: {
    name: "explore",
    description: "A fast, read-only agent optimized for searching and analyzing codebases. Use for file discovery, code search, and codebase exploration.",
    systemPrompt: [
      "You are an exploration agent. Your job is to search and analyze the codebase.",
      "You are READ-ONLY \u2014 you cannot modify any files.",
      "Be thorough: check multiple locations, follow imports, trace references.",
      "When you are done, provide a structured summary of your findings."
    ],
    allowedTools: ["Read", "FileTree", "SearchFiles", "WebFetch", "WebSearch"],
    isReadOnly: true,
    maxTurns: 10
  },
  plan: {
    name: "plan",
    description: "A research agent for gathering context during planning. Use when you need to understand the codebase before creating a plan.",
    systemPrompt: [
      "You are a planning research agent. Your job is to gather context about the codebase to support planning.",
      "You are READ-ONLY \u2014 you cannot modify any files.",
      "Focus on understanding the current state, dependencies, and potential impact areas.",
      "Provide a structured research summary that can be used for planning."
    ],
    allowedTools: ["Read", "FileTree", "SearchFiles"],
    isReadOnly: true,
    maxTurns: 6
  },
  reflect: {
    name: "reflect",
    description: "A reflection agent that analyzes past interactions and extracts actionable insights for self-improvement.",
    systemPrompt: [
      "You are a reflection agent. Your job is to analyze past interactions and extract actionable insights.",
      "For each interaction, identify:",
      "1. What went well (success patterns to reinforce)",
      "2. What went wrong (anti-patterns to avoid)",
      "3. What could be improved (optimization opportunities)",
      "4. Whether a new skill should be created or an existing one updated",
      "You are READ-ONLY \u2014 you cannot modify any files.",
      "IMPORTANT: You cannot launch other sub-agents or trigger further reflections.",
      "Output your findings in this structured format:",
      "## Success Patterns",
      "- [pattern description]",
      "## Anti-Patterns",
      "- [anti-pattern description]",
      "## Optimization Opportunities",
      "- [improvement suggestion]",
      "## Skill Suggestions",
      "- [skill name]: [description of what this skill should do]"
    ],
    allowedTools: ["Read", "FileTree", "SearchFiles"],
    isReadOnly: true,
    maxTurns: 4
  },
  pm: {
    name: "pm",
    description: "Project Manager agent that decomposes goals into task plans using templates and documents",
    systemPrompt: [
      "You are a Project Manager agent. Your job is to:",
      "1. Understand the user's high-level goal",
      "2. Search for matching workflow templates",
      "3. Read relevant project documents (PRD, specs, tech designs) for context",
      "4. Create a detailed plan with tasks, dependencies, and agent assignments",
      "5. Present the plan as a structured proposal for user approval",
      "",
      "When creating plans:",
      "- Use templates when available as starting points",
      "- Reference project documents for technical context",
      "- Define clear task dependencies (depends_on)",
      "- Assign appropriate agents (general-purpose, grpc-worker, explore)",
      "- Include acceptance criteria for verification",
      "",
      "Output format: Present your plan as a structured proposal with:",
      "- Title and description",
      "- Task list with dependencies",
      "- Assigned agent for each task",
      "- Any relevant document references"
    ],
    allowedTools: [
      "Read",
      "FileTree",
      "SearchFiles",
      "WebFetch"
    ],
    capabilities: ["planning", "orchestration"],
    maxTurns: 12
  },
  "grpc-worker": {
    name: "grpc-worker",
    description: "Agent specialized in executing gRPC calls according to workflow definitions. Used for integrating with external microservices.",
    systemPrompt: [
      "You are a gRPC workflow execution agent. You execute gRPC calls to external microservices.",
      "",
      "## Critical Rules",
      "",
      "1. **ALWAYS use the GrpcClient tool** to make gRPC calls. Never use Shell or any other tool for gRPC operations.",
      "2. When the task description contains gRPC parameters (protoFile, service, method, address, payload), call GrpcClient with those exact parameters.",
      "3. If a gRPC call fails, use the Checkpoint tool to ask the user what to do (retry, skip, or abort). Do NOT retry automatically.",
      "4. If a step requires user approval, use the Checkpoint tool to pause and wait for user input.",
      "5. After each call, report the response clearly.",
      "",
      "## How to call GrpcClient",
      "",
      "When you see a task like: `gRPC Call: AlgoGRPC.AlgoService.SendMessage` with payload parameters,",
      "you must call the GrpcClient tool like this:",
      "",
      "```",
      'GrpcClient(protoFile="protos/AlgoService.proto", service="AlgoGRPC.AlgoService", method="SendMessage", address="192.168.25.106:9010", payload={...})',
      "```",
      "",
      "Do NOT interpret gRPC task descriptions as shell commands. They are instructions for the GrpcClient tool."
    ],
    allowedTools: ["GrpcClient", "Read", "Checkpoint"],
    capabilities: ["grpc", "workflow", "align"],
    maxTurns: 20
  }
};
function getAgentDefinition(subagentType) {
  const key = (subagentType?.trim() || "general-purpose").toLowerCase();
  return BUILTIN_AGENTS[key] ?? BUILTIN_AGENTS["general-purpose"];
}
function getToolDefinitionsForAgent(agentDef, allToolDefs) {
  const blockedTools = ["Agent", "Team", "Reflect", "Skill"];
  if (agentDef.allowedTools === "*") {
    return allToolDefs.filter((t) => !blockedTools.includes(t.name));
  }
  return allToolDefs.filter(
    (t) => agentDef.allowedTools.includes(t.name) && !blockedTools.includes(t.name)
  );
}

// tools/agent/resultCompressor.ts
function compressSubagentResult(messages) {
  const assistantTexts = [];
  for (const msg of messages) {
    if (msg.type !== "assistant") continue;
    const aMsg = msg;
    for (const block of aMsg.content) {
      if (block.type === "text" && block.text.trim()) {
        assistantTexts.push(block.text.trim());
      }
    }
  }
  if (assistantTexts.length === 0) {
    return "Subagent completed with no text output.";
  }
  return assistantTexts.join("\n\n");
}

// tools/Tool.ts
function findToolByName(tools, name) {
  return tools.find((tool) => tool.name === name);
}

// tools/agent/runAgent.ts
function buildSubagentSystemPrompt(agentDef) {
  return [
    ...agentDef.systemPrompt,
    "IMPORTANT: You are a sub-agent. You cannot launch other sub-agents. Complete your task independently.",
    "When you finish, provide a concise summary of your findings or actions as your final message."
  ];
}
function getFilteredTools(agentDef) {
  const allTools = getTools();
  const blockedTools = ["Agent", "Team", "Reflect", "Skill"];
  if (agentDef.allowedTools === "*") {
    return allTools.filter((t) => !blockedTools.includes(t.name));
  }
  return allTools.filter(
    (t) => agentDef.allowedTools.includes(t.name) && !blockedTools.includes(t.name)
  );
}
function getSubagentToolDefinitions(agentDef) {
  const allDefs = buildAllToolDefinitions();
  return getToolDefinitionsForAgent(agentDef, allDefs);
}
function buildAllToolDefinitions() {
  return [
    {
      name: "Read",
      description: "Read a text file from the current working directory.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative or absolute file path." }
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
          oldString: { type: "string", description: "Existing text to replace." },
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
          prompt: { type: "string", description: "Optional guidance describing what to extract from the page." }
        },
        required: ["url", "prompt"],
        additionalProperties: false
      }
    },
    {
      name: "WebSearch",
      description: "Search the web using DuckDuckGo.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query." }
        },
        required: ["query"],
        additionalProperties: false
      }
    },
    {
      name: "FileTree",
      description: "List directory tree structure.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path." },
          maxDepth: { type: "number", description: "Maximum depth to traverse." }
        },
        required: ["path"],
        additionalProperties: false
      }
    },
    {
      name: "SearchFiles",
      description: "Search files by name pattern or content regex.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["files", "content"], description: "Search mode." },
          pattern: { type: "string", description: "Glob pattern or regex." },
          path: { type: "string", description: "Directory to search in." }
        },
        required: ["mode", "pattern"],
        additionalProperties: false
      }
    },
    {
      name: "GrpcClient",
      description: "Make a gRPC call to an external service. Requires a .proto file, service name, method name, and target address.",
      parameters: {
        type: "object",
        properties: {
          protoFile: { type: "string", description: "Path to the .proto file." },
          service: { type: "string", description: "Fully qualified service name (e.g. 'mypackage.MyService')." },
          method: { type: "string", description: "Method name to call." },
          address: { type: "string", description: "Target address in host:port format." },
          payload: { type: "object", description: "Request payload as key-value pairs." },
          metadata: { type: "object", description: "Optional gRPC metadata as key-value pairs." },
          deadline: { type: "number", description: "Optional timeout in milliseconds (default 300000, i.e. 5 minutes)." }
        },
        required: ["protoFile", "service", "method", "address", "payload"],
        additionalProperties: false
      }
    },
    {
      name: "Checkpoint",
      description: "Pause execution and wait for user input. Use for approval confirmations, error recovery choices (retry/skip/abort), or collecting user-provided data.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["approval", "error_choice", "data_input"], description: "Type of checkpoint." },
          message: { type: "string", description: "Message to show to the user." },
          options: { type: "array", items: { type: "string" }, description: "Options for error_choice type (e.g. ['retry', 'skip', 'abort'])." },
          schema: { type: "array", description: "Field definitions for data_input type.", items: { type: "object", properties: { name: { type: "string" }, label: { type: "string" }, type: { type: "string" }, options: { type: "array", items: { type: "string" } }, required: { type: "boolean" } } } }
        },
        required: ["type", "message"],
        additionalProperties: false
      }
    },
    {
      name: "TaskCreate",
      description: "Create a new task in the task management system.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title." },
          description: { type: "string", description: "Task description." },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority." },
          assignee: { type: "string", description: "Agent to assign (e.g. 'general-purpose', 'grpc-worker')." },
          dependsOn: { type: "array", items: { type: "string" }, description: "Task IDs this task depends on." }
        },
        required: ["title"],
        additionalProperties: false
      }
    }
  ];
}
function createAssistantMessage(blocks) {
  return {
    id: createId("assistant"),
    type: "assistant",
    content: blocks
  };
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
function stringify(data) {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}
async function* executeSubagentToolCall(toolName, toolInput, toolUseId, context, permissionFn, filteredTools) {
  const tool = findToolByName(filteredTools, toolName);
  if (!tool) {
    yield createToolResultMessage(toolUseId, stringify({ error: `Unknown tool ${toolName}` }), true);
    return;
  }
  const parentMessage = createAssistantMessage([
    { type: "tool_use", id: toolUseId, name: toolName, input: toolInput }
  ]);
  const permission = await permissionFn(tool, toolInput, context, parentMessage, toolUseId);
  if (permission.behavior === "deny") {
    yield createToolResultMessage(toolUseId, stringify({ error: permission.message }), true);
    return;
  }
  let effectiveInput = toolInput;
  if (permission.updatedInput !== void 0) {
    effectiveInput = permission.updatedInput;
  }
  try {
    const result = await tool.call(
      effectiveInput,
      context,
      permissionFn,
      parentMessage
    );
    yield createToolResultMessage(toolUseId, stringify(result.data));
    if (result.extraMessages) {
      for (const extraMessage of result.extraMessages) {
        yield extraMessage;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    yield createToolResultMessage(toolUseId, stringify({ error: message }), true);
  }
}
async function runAgent(params) {
  const agentDef = getAgentDefinition(params.subagentType);
  const maxTurns = params.maxTurns ?? agentDef.maxTurns ?? 8;
  const permissionFn = params.canUseTool ?? canUseTool;
  const subContext = createSubagentContext(params.parentContext, {
    agentType: agentDef.name
  });
  const filteredTools = getFilteredTools(agentDef);
  if (!getLlmConfig()?.apiKey) {
    console.log(`[runAgent] No LLM API key configured, returning early`);
    return [
      `Subagent "${agentDef.name}" accepted the task.`,
      `Description: ${params.description}`,
      `Prompt length: ${params.prompt.length} characters`,
      "No LLM configured \u2014 subagent cannot execute without a model."
    ].join("\n");
  }
  console.log(`[runAgent] Starting agent "${agentDef.name}" for: ${params.description}`);
  const messages = [
    { id: createId("user"), type: "user", content: params.prompt }
  ];
  const systemPrompt = buildSubagentSystemPrompt(agentDef);
  try {
    const { getFullInjectionContent: getFullInjectionContent2 } = await Promise.resolve().then(() => (init_irgMd(), irgMd_exports));
    const irgContent = await getFullInjectionContent2(params.parentContext.cwd);
    if (irgContent.trim()) {
      systemPrompt.push(irgContent);
    }
  } catch {
  }
  const toolDefs = getSubagentToolDefinitions(agentDef);
  const allResultMessages = [];
  if (params.onMessage) {
    for (const msg of messages) {
      await params.onMessage(msg);
    }
  }
  for (let turn = 0; turn < maxTurns; turn += 1) {
    console.log(`[runAgent] Turn ${turn + 1}/${maxTurns}`);
    const llmResponse = await runLlmTurn({
      messages,
      systemPrompt,
      tools: toolDefs,
      onTextDelta: params.onProgress
    });
    if (!llmResponse.text && llmResponse.toolCalls.length === 0) {
      break;
    }
    const assistantBlocks = [];
    if (llmResponse.text) {
      assistantBlocks.push({ type: "text", text: llmResponse.text });
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
    messages.push(assistantMessage);
    allResultMessages.push(assistantMessage);
    if (params.onMessage) {
      await params.onMessage(assistantMessage);
    }
    const toolCalls = assistantBlocks.filter(
      (block) => block.type === "tool_use"
    );
    if (toolCalls.length === 0) {
      break;
    }
    for (const toolCall of toolCalls) {
      for await (const msg of executeSubagentToolCall(
        toolCall.name,
        toolCall.input,
        toolCall.id,
        subContext,
        permissionFn,
        filteredTools
      )) {
        messages.push(msg);
        allResultMessages.push(msg);
        if (params.onMessage) {
          await params.onMessage(msg);
        }
      }
    }
  }
  console.log(`[runAgent] Completed, total messages: ${allResultMessages.length}`);
  return compressSubagentResult(allResultMessages);
}

// tools/agent/agentTool.ts
var AgentTool = {
  name: "Agent",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Launch a subagent";
  },
  async call(args, context, canUseTool2, _parentMessage) {
    createSubagentContext(context, {
      agentType: args.subagentType
    });
    const result = await runAgent({
      description: args.description,
      prompt: args.prompt,
      subagentType: args.subagentType,
      parentContext: context,
      canUseTool: canUseTool2
    });
    return {
      data: {
        status: "completed",
        result
      }
    };
  },
  async validateInput(input3) {
    if (!input3.description.trim()) {
      return { result: false, message: "Description is required" };
    }
    if (!input3.prompt.trim()) {
      return { result: false, message: "Prompt is required" };
    }
    return { result: true };
  },
  async checkPermissions(input3, context) {
    if (context.getAppState().permissionContext.mode === "default") {
      return {
        behavior: "ask",
        message: `Agent launch requires confirmation for "${input3.description}"`
      };
    }
    return {
      behavior: "allow",
      updatedInput: input3
    };
  },
  isReadOnly() {
    return false;
  },
  isConcurrencySafe() {
    return false;
  }
};

// tools/agent/team.ts
var BUILTIN_TEAMS = {
  "code-review": {
    name: "code-review",
    description: "A code review team with specialized reviewers for security, performance, and style.",
    lead: {
      name: "review-coordinator",
      role: "coordinator",
      description: "Coordinates the code review process and synthesizes findings.",
      systemPrompt: [
        "You are the coordinator of a code review team.",
        "Your job is to synthesize the findings from all reviewers into a coherent, actionable report.",
        "Prioritize findings by severity: critical bugs > security issues > performance > style.",
        "Provide clear, actionable recommendations."
      ],
      allowedTools: ["Read", "FileTree", "SearchFiles"],
      isReadOnly: true
    },
    members: [
      {
        name: "security-reviewer",
        role: "reviewer",
        description: "Reviews code for security vulnerabilities and best practices.",
        systemPrompt: [
          "You are a security-focused code reviewer.",
          "Look for: injection vulnerabilities, authentication issues, data exposure, insecure defaults.",
          "Rate each finding as critical, high, medium, or low severity.",
          "Provide specific remediation advice for each finding."
        ],
        allowedTools: ["Read", "SearchFiles"],
        isReadOnly: true
      },
      {
        name: "performance-reviewer",
        role: "reviewer",
        description: "Reviews code for performance issues and optimization opportunities.",
        systemPrompt: [
          "You are a performance-focused code reviewer.",
          "Look for: inefficient algorithms, unnecessary re-renders, memory leaks, N+1 queries, blocking operations.",
          "Suggest specific optimizations with expected impact."
        ],
        allowedTools: ["Read", "SearchFiles"],
        isReadOnly: true
      }
    ]
  },
  "research": {
    name: "research",
    description: "A research team for comprehensive analysis of codebases or topics.",
    lead: {
      name: "research-lead",
      role: "coordinator",
      description: "Leads research efforts and synthesizes findings from team members.",
      systemPrompt: [
        "You are the lead researcher coordinating a research team.",
        "Synthesize findings from all researchers into a comprehensive report.",
        "Identify patterns, contradictions, and gaps in the research.",
        "Provide clear conclusions and actionable next steps."
      ],
      allowedTools: ["Read", "FileTree", "SearchFiles", "WebFetch", "WebSearch"],
      isReadOnly: true
    },
    members: [
      {
        name: "codebase-analyst",
        role: "researcher",
        description: "Analyzes the codebase structure, patterns, and dependencies.",
        systemPrompt: [
          "You are a codebase analyst.",
          "Focus on understanding the architecture, module dependencies, and code patterns.",
          "Map out the key components and their relationships.",
          "Identify potential areas of concern or improvement."
        ],
        allowedTools: ["Read", "FileTree", "SearchFiles"],
        isReadOnly: true
      },
      {
        name: "documentation-analyst",
        role: "researcher",
        description: "Analyzes documentation and external resources.",
        systemPrompt: [
          "You are a documentation and external resource analyst.",
          "Search for relevant documentation, API references, and external resources.",
          "Cross-reference findings with the codebase analysis.",
          "Identify documentation gaps and inconsistencies."
        ],
        allowedTools: ["Read", "WebFetch", "WebSearch"],
        isReadOnly: true
      }
    ]
  }
};
function getTeamDefinition(teamName) {
  if (!teamName?.trim()) return null;
  return BUILTIN_TEAMS[teamName.toLowerCase()] ?? null;
}
function getToolDefsForTeamMember(member, allToolDefs) {
  const blockedTools = ["Agent", "Team", "Reflect", "Skill"];
  if (member.allowedTools === "*") {
    return allToolDefs.filter((t) => !blockedTools.includes(t.name));
  }
  return allToolDefs.filter(
    (t) => member.allowedTools.includes(t.name) && !blockedTools.includes(t.name)
  );
}

// tools/agent/teamOrchestrator.ts
function buildMemberSystemPrompt(member, task) {
  return [
    ...member.systemPrompt,
    "IMPORTANT: You are a team member. You cannot launch other sub-agents.",
    "Focus on your specific role and expertise.",
    "When you finish, provide a clear summary of your findings or actions.",
    `The overall task is: ${task}`
  ];
}
function getFilteredToolsForMember(member) {
  const allTools = getTools();
  const blockedTools = ["Agent", "Team", "Reflect", "Skill"];
  if (member.allowedTools === "*") {
    return allTools.filter((t) => !blockedTools.includes(t.name));
  }
  return allTools.filter(
    (t) => member.allowedTools.includes(t.name) && !blockedTools.includes(t.name)
  );
}
function buildAllToolDefinitions2() {
  return [
    {
      name: "Read",
      description: "Read a text file from the current working directory.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "File path." } },
        required: ["path"],
        additionalProperties: false
      }
    },
    {
      name: "Write",
      description: "Write text content to a file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path." },
          content: { type: "string", description: "File content." }
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
          path: { type: "string", description: "File path." },
          oldString: { type: "string", description: "Text to replace." },
          newString: { type: "string", description: "Replacement text." }
        },
        required: ["path", "oldString", "newString"],
        additionalProperties: false
      }
    },
    {
      name: "Shell",
      description: "Run a shell command.",
      parameters: {
        type: "object",
        properties: { command: { type: "string", description: "Shell command." } },
        required: ["command"],
        additionalProperties: false
      }
    },
    {
      name: "WebFetch",
      description: "Fetch a URL and return processed text.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL." },
          prompt: { type: "string", description: "What to extract." }
        },
        required: ["url", "prompt"],
        additionalProperties: false
      }
    },
    {
      name: "WebSearch",
      description: "Search the web.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search query." } },
        required: ["query"],
        additionalProperties: false
      }
    },
    {
      name: "FileTree",
      description: "List directory tree.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path." },
          maxDepth: { type: "number", description: "Max depth." }
        },
        required: ["path"],
        additionalProperties: false
      }
    },
    {
      name: "SearchFiles",
      description: "Search files by name or content.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["files", "content"] },
          pattern: { type: "string", description: "Pattern." },
          path: { type: "string", description: "Directory." }
        },
        required: ["mode", "pattern"],
        additionalProperties: false
      }
    }
  ];
}
function createAssistantMessage2(blocks) {
  return {
    id: createId("assistant"),
    type: "assistant",
    content: blocks
  };
}
function createToolResultMessage2(toolUseId, content, isError = false) {
  return {
    id: createId("tool-result"),
    type: "tool_result",
    toolUseId,
    content,
    isError
  };
}
function stringify2(data) {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}
async function* executeMemberToolCall(toolName, toolInput, toolUseId, context, permissionFn, filteredTools) {
  const tool = findToolByName(filteredTools, toolName);
  if (!tool) {
    yield createToolResultMessage2(toolUseId, stringify2({ error: `Unknown tool ${toolName}` }), true);
    return;
  }
  const parentMessage = createAssistantMessage2([
    { type: "tool_use", id: toolUseId, name: toolName, input: toolInput }
  ]);
  const permission = await permissionFn(tool, toolInput, context, parentMessage, toolUseId);
  if (permission.behavior === "deny") {
    yield createToolResultMessage2(toolUseId, stringify2({ error: permission.message }), true);
    return;
  }
  let effectiveInput = toolInput;
  if (permission.updatedInput !== void 0) {
    effectiveInput = permission.updatedInput;
  }
  try {
    const result = await tool.call(effectiveInput, context, permissionFn, parentMessage);
    yield createToolResultMessage2(toolUseId, stringify2(result.data));
    if (result.extraMessages) {
      for (const extraMessage of result.extraMessages) {
        yield extraMessage;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    yield createToolResultMessage2(toolUseId, stringify2({ error: message }), true);
  }
}
async function runMemberAgent(member, task, parentContext, permissionFn, maxTurns, onProgress) {
  const subContext = createSubagentContext(parentContext, {
    agentType: member.name
  });
  const filteredTools = getFilteredToolsForMember(member);
  const systemPrompt = buildMemberSystemPrompt(member, task);
  const allToolDefs = buildAllToolDefinitions2();
  const toolDefs = getToolDefsForTeamMember(member, allToolDefs);
  const messages = [
    { id: createId("user"), type: "user", content: task }
  ];
  const allResultMessages = [];
  onProgress?.({
    member: member.name,
    phase: "started",
    message: `${member.name} starting task...`
  });
  for (let turn = 0; turn < maxTurns; turn += 1) {
    const llmResponse = await runLlmTurn({
      messages,
      systemPrompt,
      tools: toolDefs
    });
    if (!llmResponse.text && llmResponse.toolCalls.length === 0) {
      break;
    }
    const assistantBlocks = [];
    if (llmResponse.text) {
      assistantBlocks.push({ type: "text", text: llmResponse.text });
    }
    for (const toolCall of llmResponse.toolCalls) {
      assistantBlocks.push({
        type: "tool_use",
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.input
      });
    }
    const assistantMessage = createAssistantMessage2(assistantBlocks);
    messages.push(assistantMessage);
    allResultMessages.push(assistantMessage);
    const toolCalls = assistantBlocks.filter(
      (block) => block.type === "tool_use"
    );
    if (toolCalls.length === 0) {
      break;
    }
    for (const toolCall of toolCalls) {
      for await (const msg of executeMemberToolCall(
        toolCall.name,
        toolCall.input,
        toolCall.id,
        subContext,
        permissionFn,
        filteredTools
      )) {
        messages.push(msg);
        allResultMessages.push(msg);
      }
    }
  }
  onProgress?.({
    member: member.name,
    phase: "completed",
    message: `${member.name} completed task.`
  });
  return compressSubagentResult(allResultMessages);
}
async function runTeam(params) {
  const { teamName, task, parentContext } = params;
  const permissionFn = params.canUseTool ?? canUseTool;
  const maxTurnsPerMember = params.maxTurnsPerMember ?? 6;
  if (!getLlmConfig()?.apiKey) {
    return {
      summary: `Team "${teamName}" cannot run without LLM configuration.`,
      taskResults: {},
      messages: []
    };
  }
  const teamDef = getTeamDefinition(teamName);
  if (!teamDef) {
    return {
      summary: `Team "${teamName}" not found. Available teams: ${Object.keys(BUILTIN_TEAMS).join(", ")}`,
      taskResults: {},
      messages: []
    };
  }
  const taskResults = {};
  const teamMessages = [];
  const now = () => Date.now();
  params.onProgress?.({
    member: teamDef.lead.name,
    phase: "team_started",
    message: `Team "${teamDef.name}" starting task: ${task}`
  });
  const memberResults = await Promise.all(
    teamDef.members.map(async (member) => {
      const memberTask = `[Team: ${teamDef.name}] ${task}

Your role: ${member.role} (${member.description})`;
      const result = await runMemberAgent(
        member,
        memberTask,
        parentContext,
        permissionFn,
        maxTurnsPerMember,
        params.onProgress
      );
      taskResults[member.name] = result;
      teamMessages.push({
        from: member.name,
        to: teamDef.lead.name,
        type: "task_result",
        content: result,
        timestamp: now()
      });
      return { member, result };
    })
  );
  const memberSummaries = memberResults.map(({ member, result }) => `## ${member.name} (${member.role})
${result}`).join("\n\n");
  const leadTask = [
    `[Team: ${teamDef.name}] Synthesize the following team findings into a coherent report.`,
    "",
    `Original task: ${task}`,
    "",
    "## Team Member Reports",
    memberSummaries,
    "",
    "Please provide a unified summary with key findings, prioritized by importance."
  ].join("\n");
  const leadResult = await runMemberAgent(
    teamDef.lead,
    leadTask,
    parentContext,
    permissionFn,
    maxTurnsPerMember,
    params.onProgress
  );
  taskResults[teamDef.lead.name] = leadResult;
  teamMessages.push({
    from: teamDef.lead.name,
    to: "all",
    type: "status_update",
    content: leadResult,
    timestamp: now()
  });
  params.onProgress?.({
    member: teamDef.lead.name,
    phase: "team_completed",
    message: `Team "${teamDef.name}" completed task.`
  });
  return {
    summary: leadResult,
    taskResults,
    messages: teamMessages
  };
}

// tools/agent/teamTool.ts
var TeamTool = {
  name: "Team",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Launch a team of specialized agents that work in parallel on a complex task";
  },
  async call(args, context, canUseTool2, _parentMessage) {
    const result = await runTeam({
      teamName: args.teamName,
      task: args.task,
      parentContext: context,
      canUseTool: canUseTool2
    });
    const hasError = result.summary.includes("cannot run") || result.summary.includes("not found");
    return {
      data: {
        status: hasError ? "error" : "completed",
        summary: result.summary,
        memberResults: result.taskResults
      }
    };
  },
  async validateInput(input3) {
    if (!input3.teamName?.trim()) {
      return { result: false, message: "Team name is required" };
    }
    if (!input3.task?.trim()) {
      return { result: false, message: "Task description is required" };
    }
    return { result: true };
  },
  async checkPermissions(input3, context) {
    if (context.getAppState().permissionContext.mode === "default") {
      return {
        behavior: "ask",
        message: `Team launch requires confirmation for team "${input3.teamName}"`
      };
    }
    return {
      behavior: "allow",
      updatedInput: input3
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
import { mkdir as mkdir7, readFile as readFile6, writeFile as writeFile6 } from "fs/promises";
import { dirname as dirname2, resolve, normalize } from "path";
function resolvePathSafe(inputPath, cwd2, allowedRoots) {
  const roots = allowedRoots ?? [cwd2];
  const resolved = normalize(resolve(cwd2, inputPath));
  const isAllowed = roots.some((root) => {
    const normalizedRoot = normalize(resolve(cwd2, root));
    return resolved === normalizedRoot || resolved.startsWith(normalizedRoot + "/");
  });
  if (!isAllowed) {
    throw new Error(
      `Path outside allowed scope: ${resolved}
Allowed roots: ${roots.join(", ")}`
    );
  }
  return resolved;
}
async function readTextFile(path) {
  return readFile6(path, "utf8");
}
async function writeTextFile(path, content) {
  await mkdir7(dirname2(path), { recursive: true });
  await writeFile6(path, content, "utf8");
  return Buffer.byteLength(content, "utf8");
}

// tools/files/editTool.ts
import { mkdir as mkdir8, writeFile as writeFile7 } from "fs/promises";
import { join as join7 } from "path";
function generateUnifiedDiff(oldLines, newLines, filename) {
  let diff = `--- a/${filename}
+++ b/${filename}
`;
  const maxLen = Math.max(oldLines.length, newLines.length);
  let hunkStart = -1;
  let hunkOld = 0;
  let hunkNew = 0;
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i] ?? "";
    const newLine = newLines[i] ?? "";
    const isContext = oldLine === newLine;
    if (isContext) {
      if (hunkStart >= 0) {
        diff += `@@ -${hunkOld},${hunkNew} +${hunkNew},${hunkNew} @@
`;
        hunkStart = -1;
      }
      diff += ` ${oldLine}
`;
    } else {
      if (hunkStart < 0) {
        hunkStart = i;
        hunkOld = Math.max(1, i);
        hunkNew = Math.max(1, i);
      }
    }
  }
  if (hunkStart >= 0) {
    diff += `@@ -${hunkOld},1 +${hunkNew},1 @@
`;
  }
  return diff;
}
var EditTool = {
  name: "Edit",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Edit a file in place with diff display and automatic backup.";
  },
  async call(args, context, _canUseTool, _parentMessage) {
    const absolutePath = resolvePathSafe(args.path, context.cwd);
    const content = await readTextFile(absolutePath);
    if (!content.includes(args.oldString)) {
      throw new Error(`Could not find target string in ${args.path}`);
    }
    const oldLines = content.split("\n");
    const newContent = content.replace(args.oldString, args.newString);
    const newLines = newContent.split("\n");
    const diff = generateUnifiedDiff(oldLines, newLines, args.path);
    const backupDir = join7(context.cwd, ".irg", "backups");
    const backupPath = join7(backupDir, `${args.path.replace(/[/]/g, "_")}_${Date.now()}.bak`);
    await mkdir8(backupDir, { recursive: true });
    await writeFile7(backupPath, content, "utf8");
    await writeTextFile(absolutePath, newContent);
    return {
      data: {
        applied: true,
        diff,
        backupPath
      }
    };
  },
  async validateInput(input3) {
    if (!input3?.path || typeof input3.path !== "string" || !input3.path.trim()) {
      return { result: false, message: "Path is required" };
    }
    if (typeof input3.oldString !== "string") {
      return { result: false, message: "oldString must be a string" };
    }
    if (typeof input3.newString !== "string") {
      return { result: false, message: "newString must be a string" };
    }
    if (input3.oldString === input3.newString) {
      return { result: false, message: "oldString and newString must differ" };
    }
    return { result: true };
  },
  async checkPermissions(input3, context) {
    if (context.getAppState().permissionContext.mode === "default") {
      return {
        behavior: "ask",
        message: `Edit requires confirmation for ${input3.path}`
      };
    }
    return {
      behavior: "allow",
      updatedInput: input3
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
    const absolutePath = resolvePathSafe(args.path, context.cwd);
    const content = await readTextFile(absolutePath);
    return {
      data: {
        content
      }
    };
  },
  async validateInput(input3) {
    if (!input3?.path || typeof input3.path !== "string" || !input3.path.trim()) {
      return { result: false, message: "Path is required" };
    }
    return { result: true };
  },
  async checkPermissions(input3) {
    return {
      behavior: "allow",
      updatedInput: input3
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
    const absolutePath = resolvePathSafe(args.path, context.cwd);
    const bytesWritten = await writeTextFile(absolutePath, args.content);
    return {
      data: {
        bytesWritten
      }
    };
  },
  async validateInput(input3) {
    if (!input3?.path || typeof input3.path !== "string" || !input3.path.trim()) {
      return { result: false, message: "Path is required" };
    }
    if (typeof input3.content !== "string") {
      return { result: false, message: "Content must be a string" };
    }
    return { result: true };
  },
  async checkPermissions(input3, context) {
    if (context.getAppState().permissionContext.mode === "default") {
      return {
        behavior: "ask",
        message: `Write requires confirmation for ${input3.path}`
      };
    }
    return {
      behavior: "allow",
      updatedInput: input3
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
var SAFE_COMMANDS = [
  "ls",
  "pwd",
  "whoami",
  "date",
  "echo",
  "cat",
  "head",
  "tail",
  "wc",
  "grep",
  "find",
  "which",
  "env",
  "printenv",
  "uname",
  "hostname",
  "git",
  "npm",
  "node",
  "npx",
  "bun",
  "pnpm",
  "yarn",
  "python",
  "python3",
  "pip",
  "pip3",
  "tsc",
  "eslint",
  "prettier",
  "curl",
  "wget",
  "mkdir",
  "touch",
  "cp",
  "ps",
  "top",
  "df",
  "du",
  "free"
];
var DANGEROUS_PATTERNS = [
  /\brm\b/,
  /\bkill\b/,
  /\bpkill\b/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bchmod\b/,
  /\bchown\b/,
  /\bsudo\b/,
  /\bsu\b/,
  /\bmkfs\b/,
  /\bdd\b/,
  /\bformat\b/,
  /\b>\s*\/\w/,
  /\b>>\s*\/\w/,
  // Redirect to system paths
  /\|\s*sh/,
  /\|\s*bash/,
  // Pipe to shell
  /\bcurl\b.*\|\s*(sh|bash|python)/
  // curl pipe to interpreter
];
function isWhitelistedCommand(command) {
  const trimmed = command.trim();
  const firstWord = trimmed.split(/\s+/)[0];
  if (!firstWord || !SAFE_COMMANDS.includes(firstWord)) return false;
  return !DANGEROUS_PATTERNS.some((p) => p.test(trimmed));
}
var ShellTool = {
  name: "Shell",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Run a shell command";
  },
  async call(args, context, _canUseTool, _parentMessage) {
    const data = await new Promise((resolve5, reject) => {
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
        resolve5({
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
  async validateInput(input3) {
    if (!input3?.command || !String(input3.command).trim()) {
      return { result: false, message: "Command is required" };
    }
    return { result: true };
  },
  async checkPermissions(input3, context) {
    if (context.getAppState().permissionContext.mode === "default") {
      if (isWhitelistedCommand(input3.command)) {
        return { behavior: "allow", updatedInput: input3 };
      }
      return {
        behavior: "ask",
        message: `Shell requires confirmation for "${input3.command}"`
      };
    }
    return {
      behavior: "allow",
      updatedInput: input3
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
import { firefox } from "playwright";
function cleanHtml(html) {
  const tagsToRemove = [
    "script",
    "style",
    "noscript",
    "iframe",
    "object",
    "embed",
    "svg",
    "math",
    "nav",
    "footer",
    "header",
    "aside"
  ];
  let cleaned = html;
  for (const tag of tagsToRemove) {
    const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, "gis");
    cleaned = cleaned.replace(regex, "");
  }
  const contentSelectors = ["article", "main", ".content", "#content", ".post"];
  for (const selector of contentSelectors) {
    try {
      const regex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)</${selector}>`, "gis");
      const match = cleaned.match(regex);
      if (match && match[1].length > cleaned.length * 0.3) {
        cleaned = match[1];
        break;
      }
    } catch {
    }
  }
  const textOnly = cleaned.replace(/<[^>]*>/g, "");
  const normalized = textOnly.replace(/\s+/g, " ").trim();
  return normalized;
}
async function web_fetch(url) {
  let browser;
  try {
    browser = await firefox.launch({ headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(3e4);
    console.log(`[WebFetch] Fetching URL: ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 3e4 });
    await page.waitForLoadState("domcontentloaded");
    await page.evaluate(`
      window.scrollTo(0, document.body.scrollHeight);
    `);
    const html = await page.content();
    console.log(`[WebFetch] Successfully fetched ${html.length} bytes from ${url}`);
    await browser.close();
    return html;
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch {
      }
    }
    throw new Error(`WebFetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
async function cleanAndExtract(html, maxLen = 5e4) {
  const cleaned = cleanHtml(html);
  if (cleaned.length > maxLen) {
    return cleaned.substring(0, maxLen) + "\n\n... [truncated] ...";
  }
  return cleaned;
}
var WebFetchTool = {
  name: "WebFetch",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Fetch and process a URL";
  },
  async call(args, _context, _canUseTool, _parentMessage) {
    try {
      const html = await web_fetch(args.url);
      const cleanedContent = await cleanAndExtract(html);
      console.log(`[WebFetch] Cleaned content: ${cleanedContent.length} characters`);
      const result = args.prompt.trim() ? `Prompt: ${args.prompt}

Fetched and cleaned content:
${cleanedContent}` : cleanedContent;
      return {
        data: {
          result
        }
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[WebFetch] Call failed for ${args.url}: ${errorMsg}`);
      return {
        data: {
          result: `Error fetching URL:
${errorMsg}`
        }
      };
    }
  },
  async validateInput(input3) {
    try {
      new URL(input3.url);
    } catch {
      return { result: false, message: "A valid URL is required" };
    }
    return { result: true };
  },
  async checkPermissions(input3) {
    return {
      behavior: "allow",
      updatedInput: input3
    };
  },
  isReadOnly() {
    return true;
  },
  isConcurrencySafe() {
    return true;
  }
};

// tools/files/fileTreeTool.ts
import { readdir as readdir3, stat as stat2 } from "fs/promises";
import { resolve as resolve2 } from "path";
function getFileType(mode) {
  if (mode & 40960) return "symlink";
  if (mode & 16384) return "directory";
  return "file";
}
async function buildTree(dirPath, cwd2, relativePath, maxDepth, depth, fileLimit, includeHidden, counter) {
  const entry = {
    name: relativePath || ".",
    type: "directory",
    children: []
  };
  let entries = [];
  try {
    const rawEntries = await readdir3(dirPath, { withFileTypes: true });
    for (const re of rawEntries) {
      if (!includeHidden && re.name.startsWith(".")) continue;
      const st = await stat2(resolve2(dirPath, re.name)).catch(() => null);
      if (!st) continue;
      entries.push({ name: re.name, mode: st.mode });
    }
  } catch {
  }
  entries.sort((a, b) => {
    const aIsDir = a.mode & 16384;
    const bIsDir = b.mode & 16384;
    if (aIsDir !== bIsDir) return bIsDir - aIsDir;
    return a.name.localeCompare(b.name);
  });
  for (const e of entries) {
    if (counter.total >= fileLimit) {
      entry.children.push({
        name: "...",
        type: "file",
        size: 0
      });
      break;
    }
    const childPath = resolve2(dirPath, e.name);
    const childRel = relativePath ? `${relativePath}/${e.name}` : e.name;
    const fileType = getFileType(e.mode);
    if (fileType === "directory") {
      counter.dirs++;
      counter.total++;
      if (depth < maxDepth) {
        const childTree = await buildTree(
          childPath,
          cwd2,
          childRel,
          maxDepth,
          depth + 1,
          fileLimit,
          includeHidden,
          counter
        );
        entry.children.push(childTree);
      } else {
        const childStat = await stat2(childPath).catch(() => null);
        entry.children.push({
          name: e.name,
          type: "directory"
        });
      }
    } else {
      counter.files++;
      counter.total++;
      entry.children.push({
        name: e.name,
        type: "file",
        size: e.mode & 32767
      });
    }
  }
  return entry;
}
var FileTreeTool = {
  name: "FileTree",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "List directory contents recursively with file types and sizes.";
  },
  async call(args, context, _canUseTool, _parentMessage) {
    const targetPath = args.path ? resolve2(context.cwd, args.path) : context.cwd;
    const maxDepth = args.maxDepth ?? 3;
    const fileLimit = args.fileLimit ?? 100;
    const includeHidden = args.includeHidden ?? false;
    const entry = await buildTree(
      targetPath,
      context.cwd,
      "",
      maxDepth,
      0,
      fileLimit,
      includeHidden,
      { files: 0, dirs: 0, total: 0 }
    );
    return {
      data: {
        entries: [entry],
        totalFiles: 0,
        totalDirs: 0,
        truncated: false
      }
    };
  },
  async validateInput(input3) {
    if (input3.path && typeof input3.path !== "string") {
      return { result: false, message: "Path must be a string" };
    }
    if (input3.maxDepth !== void 0 && (input3.maxDepth < 0 || !Number.isInteger(input3.maxDepth))) {
      return { result: false, message: "maxDepth must be a non-negative integer" };
    }
    if (input3.fileLimit !== void 0 && (input3.fileLimit < 1 || !Number.isInteger(input3.fileLimit))) {
      return { result: false, message: "fileLimit must be a positive integer" };
    }
    return { result: true };
  },
  async checkPermissions(input3) {
    return {
      behavior: "allow",
      updatedInput: input3
    };
  },
  isReadOnly() {
    return true;
  },
  isConcurrencySafe() {
    return true;
  }
};

// tools/files/searchFilesTool.ts
import { readdir as readdir4, stat as stat3, readFile as readFile7 } from "fs/promises";
import { resolve as resolve3, relative as relative2, dirname as dirname3 } from "path";
function getFileType2(mode) {
  if (mode & 40960) return "symlink";
  if (mode & 16384) return "directory";
  return "file";
}
function matchesGlob(filename, glob) {
  const pattern = glob.replace(/\*\*/g, "___DOUBLESTAR___").replace(/\*/g, "___SINGLESTAR___").replace(/\?/g, "___QUESTION___");
  let regex = "^";
  for (const part of pattern.split("___DOUBLESTAR___")) {
    for (const sub of part.split("___SINGLESTAR___")) {
      regex += sub.replace(/[/]/g, "[/]").replace(/___QUESTION___/g, ".");
    }
    regex += ".*";
  }
  regex += "$";
  try {
    return new RegExp(regex).test(filename);
  } catch {
    return false;
  }
}
async function searchFilesInDir(dirPath, cwd2, glob, pattern, limit, counter, type) {
  const results = [];
  let entries = [];
  try {
    const rawEntries = await readdir4(dirPath, { withFileTypes: true });
    for (const re of rawEntries) {
      if (re.name.startsWith(".")) continue;
      const st = await stat3(resolve3(dirPath, re.name)).catch(() => null);
      if (!st) continue;
      entries.push({ name: re.name, mode: st.mode });
    }
  } catch {
    return results;
  }
  for (const e of entries) {
    if (counter.total >= limit) break;
    const fullPath = resolve3(dirPath, e.name);
    const relPath = relative2(cwd2, fullPath);
    const fileType = getFileType2(e.mode);
    if (glob) {
      const fileName = e.name;
      const dirName = dirname3(relPath);
      const fullRelPath = dirName ? `${dirName}/${fileName}` : fileName;
      const nameMatches = matchesGlob(fileName, glob);
      const pathMatches = glob.includes("/") ? matchesGlob(fullRelPath, glob) : false;
      if (!nameMatches && !pathMatches) continue;
    }
    if (fileType === "directory") {
      const subResults = await searchFilesInDir(
        fullPath,
        cwd2,
        glob,
        pattern,
        limit,
        counter,
        type
      );
      results.push(...subResults);
    } else {
      counter.files++;
      counter.total++;
      if (type === "files") {
        results.push({
          path: relPath,
          type: "file",
          size: e.mode & 32767
        });
      } else if (type === "content" && pattern) {
        try {
          const content = await readFile7(fullPath, "utf8");
          const lines = content.split("\n");
          const regex = new RegExp(pattern, "i");
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              results.push({
                path: relPath,
                line: i + 1,
                content: lines[i].trim()
              });
              counter.contentMatches++;
              counter.total++;
              if (counter.total >= limit) break;
            }
          }
        } catch {
        }
      }
    }
  }
  return results;
}
var SearchFilesTool = {
  name: "SearchFiles",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Search for files by glob pattern or search file contents by regex. Supports 'files' mode (list matching files) and 'content' mode (find matching lines).";
  },
  async call(args, context, _canUseTool, _parentMessage) {
    const searchPath = args.path ? resolve3(context.cwd, args.path) : context.cwd;
    const limit = args.limit ?? 50;
    const type = args.type ?? "files";
    const results = await searchFilesInDir(
      searchPath,
      context.cwd,
      args.glob || null,
      args.pattern || null,
      limit,
      { files: 0, contentMatches: 0, total: 0 },
      type
    );
    const truncated = results.length >= limit;
    return {
      data: {
        matches: results.slice(0, limit),
        totalFiles: 0,
        totalMatches: results.length,
        truncated,
        searchPath: relative2(context.cwd, searchPath)
      }
    };
  },
  async validateInput(input3) {
    if (input3.glob !== void 0 && typeof input3.glob !== "string") {
      return { result: false, message: "glob must be a string" };
    }
    if (input3.pattern !== void 0 && typeof input3.pattern !== "string") {
      return { result: false, message: "pattern must be a string" };
    }
    if (input3.path !== void 0 && typeof input3.path !== "string") {
      return { result: false, message: "path must be a string" };
    }
    if (input3.limit !== void 0 && (input3.limit < 1 || !Number.isInteger(input3.limit))) {
      return { result: false, message: "limit must be a positive integer" };
    }
    if (input3.type !== void 0 && !["files", "content"].includes(input3.type)) {
      return { result: false, message: "type must be 'files' or 'content'" };
    }
    return { result: true };
  },
  async checkPermissions(input3) {
    return {
      behavior: "allow",
      updatedInput: input3
    };
  },
  isReadOnly() {
    return true;
  },
  isConcurrencySafe() {
    return true;
  }
};

// tools/web/webSearchTool.ts
async function duckduckgoSearch(query2, maxResults = 10) {
  const encodedQuery = encodeURIComponent(query2);
  const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AgentFromScratch/1.0)",
      "Accept": "text/html"
    },
    signal: AbortSignal.timeout(15e3)
  });
  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed: ${response.status}`);
  }
  const html = await response.text();
  const results = [];
  const titleRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  const snippetRegex = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]+href="[^"]+"[^>]*>([^<]+)<\/a>/g;
  let titleMatch;
  while ((titleMatch = titleRegex.exec(html)) !== null && results.length < maxResults) {
    const matchUrl = titleMatch[1];
    const href = matchUrl.replace(/^https?:\/\/duckduckgo\.com\/l\/\?u=(.+)$/, (_, u) => {
      try {
        return decodeURIComponent(u);
      } catch {
        return matchUrl;
      }
    });
    results.push({
      title: titleMatch[2].trim(),
      url: href,
      snippet: ""
    });
  }
  let snippetMatch;
  while ((snippetMatch = snippetRegex.exec(html)) !== null && results.length < maxResults) {
    if (results.length > 0 && results[results.length - 1].snippet === "") {
      results[results.length - 1].snippet = snippetMatch[1].trim();
    } else {
      results.push({
        title: "",
        url: "",
        snippet: snippetMatch[1].trim()
      });
    }
  }
  if (results.length > 0 && results[0].snippet === "") {
    for (const r of results) {
      if (!r.snippet) {
        r.snippet = "Click the link for more details.";
      }
    }
  }
  return results.slice(0, maxResults);
}
async function duckduckgoInstantAnswer(query2) {
  const encodedQuery = encodeURIComponent(query2);
  const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1`;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(1e4)
    });
    if (!response.ok) return [];
    const data = await response.json();
    const results = [];
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics) {
        if (topic.Text && topic.URL) {
          results.push({
            text: topic.Text,
            url: topic.URL,
            icon: topic.Icon?.URL || ""
          });
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}
var WebSearchTool = {
  name: "WebSearch",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Search the web using DuckDuckGo. Returns titles, URLs, and snippets. Useful for finding information, documentation, and current events.";
  },
  async call(args, context, _canUseTool, _parentMessage) {
    const maxResults = args.maxResults ?? 10;
    let results = [];
    const instantResults = await duckduckgoInstantAnswer(args.query);
    if (instantResults.length > 0) {
      results = instantResults.map((r) => ({
        title: r.text.split("\n")[0],
        url: r.url,
        snippet: r.text.split("\n").slice(1).join("\n").trim()
      }));
    }
    if (results.length < 3) {
      const htmlResults = await duckduckgoSearch(args.query, maxResults);
      for (const r of htmlResults) {
        if (!results.some((existing) => existing.url === r.url)) {
          results.push(r);
        }
      }
    }
    const truncated = results.length >= maxResults;
    return {
      data: {
        results: results.slice(0, maxResults),
        totalResults: results.length,
        truncated
      }
    };
  },
  async validateInput(input3) {
    if (!input3.query || typeof input3.query !== "string" || !input3.query.trim()) {
      return { result: false, message: "Query is required" };
    }
    if (input3.maxResults !== void 0 && (input3.maxResults < 1 || !Number.isInteger(input3.maxResults))) {
      return { result: false, message: "maxResults must be a positive integer" };
    }
    return { result: true };
  },
  async checkPermissions(input3) {
    return {
      behavior: "allow",
      updatedInput: input3
    };
  },
  isReadOnly() {
    return true;
  },
  isConcurrencySafe() {
    return true;
  }
};

// tools/web/imageUploadTool.ts
import { mkdir as mkdir9, writeFile as writeFile8 } from "fs/promises";
import { join as join8 } from "path";
var ImageUploadTool = {
  name: "ImageUpload",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Upload an image (base64) for storage and later analysis. Supports common image formats (PNG, JPG, GIF, WebP).";
  },
  async call(args, context, _canUseTool, _parentMessage) {
    const imageData = args.data;
    const mimeType = args.mimeType || "image/png";
    const description = args.description || "Uploaded image";
    let ext = "png";
    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = "jpg";
    else if (mimeType.includes("gif")) ext = "gif";
    else if (mimeType.includes("webp")) ext = "webp";
    else if (mimeType.includes("png")) ext = "png";
    const timestamp = Date.now();
    const filename = `image_${timestamp}.${ext}`;
    const imageDir = join8(context.cwd, ".irg", "images");
    await mkdir9(imageDir, { recursive: true });
    const filePath = join8(imageDir, filename);
    const buffer = Buffer.from(imageData, "base64");
    await writeFile8(filePath, buffer);
    return {
      data: {
        path: filePath,
        mimeType,
        size: buffer.length,
        description
      }
    };
  },
  async validateInput(input3) {
    if (!input3.data || typeof input3.data !== "string") {
      return { result: false, message: "Image data (base64) is required" };
    }
    if (input3.mimeType !== void 0 && typeof input3.mimeType !== "string") {
      return { result: false, message: "mimeType must be a string" };
    }
    if (input3.description !== void 0 && typeof input3.description !== "string") {
      return { result: false, message: "description must be a string" };
    }
    return { result: true };
  },
  async checkPermissions(input3) {
    return {
      behavior: "allow",
      updatedInput: input3
    };
  },
  isReadOnly() {
    return false;
  },
  isConcurrencySafe() {
    return true;
  }
};

// tools/web/imageAnalyzeTool.ts
import { readdir as readdir5, readFile as readFile8, stat as stat4 } from "fs/promises";
import { join as join9 } from "path";
async function analyzeWithAnthropic(imageData, mimeType, prompt, config) {
  const response = await fetch(`${config.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": config.anthropicVersion || "2023-06-01"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      system: prompt || "Describe this image in detail.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: imageData
              }
            }
          ]
        }
      ]
    })
  });
  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.error?.message || `Anthropic API error: ${response.status}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text || "No analysis returned.";
}
async function analyzeWithOpenAI(imageData, mimeType, prompt, config) {
  const dataUrl = `data:${mimeType};base64,${imageData}`;
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: prompt || "Describe this image in detail."
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt || "Describe this image in detail." },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } }
          ]
        }
      ]
    })
  });
  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.error?.message || `OpenAI API error: ${response.status}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "No analysis returned.";
}
var ImageAnalyzeTool = {
  name: "ImageAnalyze",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Analyze an image using LLM vision capabilities. Upload an image first with ImageUpload, then analyze it.";
  },
  async call(args, context, _canUseTool, _parentMessage) {
    const llmConfig = getLlmConfig();
    if (!llmConfig?.apiKey) {
      return {
        data: {
          analysis: "Cannot analyze image: no LLM configured. Set IRG_LLM_API_KEY and IRG_LLM_MODEL.",
          imageUrl: "",
          provider: "none",
          model: "none"
        }
      };
    }
    let imageData;
    let mimeType;
    let imageUrl;
    if (args.imagePath) {
      const filePath = args.imagePath.startsWith("/") ? args.imagePath : join9(context.cwd, args.imagePath);
      const fileStat = await stat4(filePath).catch(() => null);
      if (!fileStat) {
        return {
          data: {
            analysis: `Image not found: ${args.imagePath}`,
            imageUrl: "",
            provider: "none",
            model: "none"
          }
        };
      }
      const buffer = await readFile8(filePath);
      imageData = buffer.toString("base64");
      mimeType = fileStat.mode & 32767 ? "image/png" : "image/png";
      imageUrl = filePath;
    } else if (args.imageId) {
      const imageDir = join9(context.cwd, ".irg", "images");
      const files = await readdir5(imageDir).catch(() => []);
      const matchingFile = files.find((f) => f.startsWith(args.imageId));
      if (!matchingFile) {
        return {
          data: {
            analysis: `Image not found: ${args.imageId}`,
            imageUrl: "",
            provider: "none",
            model: "none"
          }
        };
      }
      const filePath = join9(imageDir, matchingFile);
      const buffer = await readFile8(filePath);
      imageData = buffer.toString("base64");
      mimeType = matchingFile.endsWith(".jpg") || matchingFile.endsWith(".jpeg") ? "image/jpeg" : "image/png";
      imageUrl = filePath;
    } else {
      return {
        data: {
          analysis: "Provide imagePath or imageId to analyze.",
          imageUrl: "",
          provider: "none",
          model: "none"
        }
      };
    }
    let analysis = "";
    try {
      if (llmConfig.provider === "anthropic") {
        analysis = await analyzeWithAnthropic(imageData, mimeType, args.prompt || "Describe this image in detail.", llmConfig);
      } else {
        analysis = await analyzeWithOpenAI(imageData, mimeType, args.prompt || "Describe this image in detail.", llmConfig);
      }
    } catch (error) {
      analysis = `Error analyzing image: ${error instanceof Error ? error.message : String(error)}`;
    }
    return {
      data: {
        analysis,
        imageUrl,
        provider: llmConfig.provider,
        model: llmConfig.model
      }
    };
  },
  async validateInput(input3) {
    if (input3.imagePath !== void 0 && typeof input3.imagePath !== "string") {
      return { result: false, message: "imagePath must be a string" };
    }
    if (input3.imageId !== void 0 && typeof input3.imageId !== "string") {
      return { result: false, message: "imageId must be a string" };
    }
    if (input3.prompt !== void 0 && typeof input3.prompt !== "string") {
      return { result: false, message: "prompt must be a string" };
    }
    return { result: true };
  },
  async checkPermissions(input3) {
    return {
      behavior: "allow",
      updatedInput: input3
    };
  },
  isReadOnly() {
    return true;
  },
  isConcurrencySafe() {
    return true;
  }
};

// tools/web/imageGenerateTool.ts
import { mkdir as mkdir10, writeFile as writeFile9 } from "fs/promises";
import { join as join10 } from "path";
async function generateWithOpenAI(prompt, size, model, quality, apiKey, n) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      quality,
      n
    })
  });
  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.error?.message || `OpenAI DALL-E error: ${response.status}`);
  }
  const data = await response.json();
  return data.data || [];
}
async function generateWithStabilityAI(prompt, size, apiKey) {
  const [width, height] = size.split("x").map(Number);
  const response = await fetch("https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Accept": "application/json"
    },
    body: JSON.stringify({
      text_prompts: [{ text: prompt, weight: 1 }],
      cfg_scale: 7,
      width,
      height,
      steps: 30,
      samples: 1
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stability AI error: ${response.status} - ${text}`);
  }
  const data = await response.json();
  return (data.artifacts || []).map((art) => ({ b64_json: art.base64 }));
}
var ImageGenerateTool = {
  name: "ImageGenerate",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Generate images using AI. Supports OpenAI DALL-E and Stability AI. Set IMAGE_GENERATION_PROVIDER (openai or stability) and the corresponding API key.";
  },
  async call(args, context, _canUseTool, _parentMessage) {
    const provider = process.env.IMAGE_GENERATION_PROVIDER || "openai";
    const apiKey = provider === "openai" ? process.env.IMAGE_GENERATION_API_KEY || process.env.OPENAI_API_KEY : process.env.STABILITY_AI_KEY || process.env.IMAGE_GENERATION_API_KEY;
    if (!apiKey) {
      return {
        data: {
          images: [],
          model: "none",
          size: "1024x1024"
        }
      };
    }
    const size = args.size || "1024x1024";
    const model = args.model || "dall-e-3";
    const quality = args.quality || "standard";
    const n = args.n || 1;
    const imageDir = join10(context.cwd, ".irg", "images");
    await mkdir10(imageDir, { recursive: true });
    let images = [];
    if (provider === "openai") {
      images = await generateWithOpenAI(
        args.prompt,
        size,
        model,
        quality,
        apiKey,
        n
      );
    } else {
      images = await generateWithStabilityAI(args.prompt, size, apiKey);
    }
    const savedImages = await Promise.all(
      images.map(async (img, i) => {
        if (img.b64_json) {
          const timestamp = Date.now();
          const filename = `generated_${timestamp}_${i}.png`;
          const filePath = join10(imageDir, filename);
          const buffer = Buffer.from(img.b64_json, "base64");
          await writeFile9(filePath, buffer);
          return { path: filePath, b64_json: img.b64_json };
        }
        return { url: img.url };
      })
    );
    return {
      data: {
        images: savedImages,
        model: provider === "openai" ? model : "stable-diffusion-xl",
        size
      }
    };
  },
  async validateInput(input3) {
    if (!input3.prompt || typeof input3.prompt !== "string" || !input3.prompt.trim()) {
      return { result: false, message: "Prompt is required" };
    }
    if (input3.size !== void 0 && !/^\d+x\d+$/.test(input3.size)) {
      return { result: false, message: "size must be in format WxH (e.g., 1024x1024)" };
    }
    if (input3.model !== void 0 && !["dall-e-3", "dall-e-2"].includes(input3.model)) {
      return { result: false, message: "model must be 'dall-e-3' or 'dall-e-2'" };
    }
    if (input3.quality !== void 0 && !["standard", "hd"].includes(input3.quality)) {
      return { result: false, message: "quality must be 'standard' or 'hd'" };
    }
    if (input3.n !== void 0 && (input3.n < 1 || input3.n > 10)) {
      return { result: false, message: "n must be between 1 and 10" };
    }
    return { result: true };
  },
  async checkPermissions(input3) {
    return {
      behavior: "allow",
      updatedInput: input3
    };
  },
  isReadOnly() {
    return false;
  },
  isConcurrencySafe() {
    return true;
  }
};

// skills/loader.ts
import { readFile as readFile9, readdir as readdir6, access } from "fs/promises";
import { join as join11, dirname as dirname4 } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { platform } from "os";
var LoadedSkills = [];
var KEBAB_CAMEL_MAP = {
  "user-invocable": "userInvocable",
  "disable-model-invocation": "disableModelInvocation",
  "argument-hint": "argumentHint",
  "allowed-tools": "allowedTools",
  "command-dispatch": "commandDispatch",
  "command-tool": "commandTool",
  "command-arg-mode": "commandArgMode"
};
function normalizeKeys(parsed) {
  const result = {};
  for (const [key, value] of Object.entries(parsed)) {
    const normalizedKey = KEBAB_CAMEL_MAP[key] || key;
    result[normalizedKey] = value;
  }
  return result;
}
function parseSimpleYaml(yamlContent) {
  const result = {};
  const lines = yamlContent.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;
    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();
    if (value.startsWith("{")) {
      try {
        value = JSON.parse(value);
        result[key] = value;
        continue;
      } catch {
      }
    }
    if (value.startsWith("[")) {
      let jsonStr = value;
      let openBrackets = (value.match(/\[/g) || []).length;
      let closeBrackets = (value.match(/\]/g) || []).length;
      let j = i + 1;
      while (j < lines.length && openBrackets > closeBrackets) {
        const nextLine = lines[j];
        jsonStr += "\n" + nextLine;
        openBrackets += (nextLine.match(/\[/g) || []).length;
        closeBrackets += (nextLine.match(/\]/g) || []).length;
        j++;
      }
      try {
        result[key] = JSON.parse(jsonStr);
        i = j - 1;
        continue;
      } catch (e) {
        console.warn("Failed to parse array JSON:", e);
      }
    }
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    } else if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    } else if (/^\d+$/.test(value)) {
      value = Number(value);
    }
    result[key] = value;
  }
  return normalizeKeys(result);
}
function extractGating(parsed) {
  if (parsed.metadata && typeof parsed.metadata === "object") {
    const meta = parsed.metadata;
    const openclaw = meta.openclaw || meta;
    return {
      always: openclaw.always === true,
      os: Array.isArray(openclaw.os) ? openclaw.os : void 0,
      requires: openclaw.requires ? {
        bins: Array.isArray(openclaw.requires.bins) ? openclaw.requires.bins : void 0,
        anyBins: Array.isArray(openclaw.requires.anyBins) ? openclaw.requires.anyBins : void 0,
        env: Array.isArray(openclaw.requires.env) ? openclaw.requires.env : void 0,
        config: Array.isArray(openclaw.requires.config) ? openclaw.requires.config : void 0
      } : void 0,
      primaryEnv: openclaw.primaryEnv,
      emoji: openclaw.emoji,
      homepage: openclaw.homepage || parsed.homepage
    };
  }
  return void 0;
}
function checkGating(gating) {
  if (!gating) return true;
  if (gating.always) return true;
  if (gating.os && gating.os.length > 0) {
    const currentOs = platform();
    if (!gating.os.includes(currentOs)) return false;
  }
  if (gating.requires) {
    if (gating.requires.bins) {
      for (const bin of gating.requires.bins) {
        try {
          execSync(`which ${bin} 2>/dev/null`, { stdio: "pipe" });
        } catch {
          return false;
        }
      }
    }
    if (gating.requires.anyBins && gating.requires.anyBins.length > 0) {
      let found = false;
      for (const bin of gating.requires.anyBins) {
        try {
          execSync(`which ${bin} 2>/dev/null`, { stdio: "pipe" });
          found = true;
          break;
        } catch {
        }
      }
      if (!found) return false;
    }
    if (gating.requires.env) {
      for (const envVar of gating.requires.env) {
        if (!process.env[envVar]) return false;
      }
    }
  }
  return true;
}
function toMetadata(parsed, name, trigger) {
  const gating = extractGating(parsed);
  return {
    name,
    description: parsed.description || "",
    trigger,
    paths: Array.isArray(parsed.paths) ? parsed.paths : [],
    userInvocable: parsed.userInvocable !== false,
    disableModelInvocation: parsed.disableModelInvocation === true,
    argumentHint: parsed.argumentHint,
    context: parsed.context === "inline" || parsed.context === "fork" ? parsed.context : void 0,
    agent: parsed.agent,
    allowedTools: Array.isArray(parsed.allowedTools) ? parsed.allowedTools : void 0,
    model: parsed.model,
    params: Array.isArray(parsed.params) ? parsed.params : void 0,
    homepage: parsed.homepage,
    commandDispatch: parsed.commandDispatch === "tool" ? "tool" : void 0,
    commandTool: parsed.commandTool,
    commandArgMode: parsed.commandArgMode === "raw" ? "raw" : void 0,
    gating
  };
}
function replaceBaseDir(content, dirPath) {
  if (!dirPath || !content.includes("{baseDir}")) return content;
  return content.replace(/\{baseDir\}/g, dirPath);
}
async function parseSkillFile(skillPath, dirPath) {
  try {
    const content = await readFile9(skillPath, "utf-8");
    const parts = content.split("---");
    if (parts.length < 3) {
      console.error(`Invalid skill file format: ${skillPath}`);
      return null;
    }
    const frontmatterRaw = parts[1].trim();
    const rawBody = parts.slice(2).join("---").trim();
    const parsed = parseSimpleYaml(frontmatterRaw);
    const frontmatterObj = {};
    const name = parsed.name || "";
    const trigger = Array.isArray(parsed.trigger) ? parsed.trigger : [];
    if (parsed.description) frontmatterObj.description = parsed.description;
    if (parsed.model) frontmatterObj.model = parsed.model;
    if (parsed.context === "inline" || parsed.context === "fork") {
      frontmatterObj.context = parsed.context;
    }
    if (Array.isArray(parsed.allowedTools)) frontmatterObj.allowedTools = parsed.allowedTools;
    if (Array.isArray(parsed.params)) frontmatterObj.params = parsed.params;
    if (Array.isArray(parsed.paths)) frontmatterObj.paths = parsed.paths;
    if (parsed.userInvocable !== void 0) frontmatterObj.userInvocable = parsed.userInvocable;
    if (parsed.disableModelInvocation !== void 0) frontmatterObj.disableModelInvocation = parsed.disableModelInvocation;
    if (parsed.argumentHint) frontmatterObj.argumentHint = parsed.argumentHint;
    if (parsed.agent) frontmatterObj.agent = parsed.agent;
    if (parsed.homepage) frontmatterObj.homepage = parsed.homepage;
    if (parsed.commandDispatch) frontmatterObj.commandDispatch = parsed.commandDispatch;
    if (parsed.commandTool) frontmatterObj.commandTool = parsed.commandTool;
    if (parsed.commandArgMode) frontmatterObj.commandArgMode = parsed.commandArgMode;
    const gating = extractGating(parsed);
    if (gating) frontmatterObj.metadata = gating;
    const metadata = toMetadata(parsed, name, trigger);
    if (!checkGating(metadata.gating)) {
      return null;
    }
    const body = replaceBaseDir(rawBody, dirPath);
    return {
      name,
      trigger,
      paths: metadata.paths,
      frontmatter: frontmatterObj,
      content: body,
      dirPath,
      metadata
    };
  } catch (error) {
    console.error(`Error parsing skill ${skillPath}:`, error);
    return null;
  }
}
async function registerSkill(skillPath, dirPath) {
  const skill = await parseSkillFile(skillPath, dirPath);
  if (skill) {
    LoadedSkills.push(skill);
  }
}
async function registerSkillsFromDirectory(dirPath) {
  try {
    const entries = await readdir6(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join11(dirPath, entry.name);
      if (entry.isDirectory()) {
        const skillMdPath = join11(fullPath, "SKILL.md");
        try {
          await access(skillMdPath);
          await registerSkill(skillMdPath, fullPath);
        } catch {
          const altMdPath = join11(fullPath, entry.name + ".md");
          try {
            await access(altMdPath);
            await registerSkill(altMdPath, fullPath);
          } catch {
          }
        }
      } else if (entry.name.endsWith(".md")) {
        await registerSkill(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading skills directory ${dirPath}:`, error);
  }
}
async function directoryExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
async function loadSkills() {
  LoadedSkills = [];
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDir = dirname4(currentFilePath);
  const possiblePaths = [
    join11(currentDir, "bundled"),
    join11(dirname4(dirname4(currentDir)), "skills", "bundled"),
    join11(process.cwd(), "skills", "bundled")
  ];
  let skillsLoaded = false;
  for (const skillsPath of possiblePaths) {
    if (await directoryExists(skillsPath)) {
      console.log(`Loading skills from: ${skillsPath}`);
      await registerSkillsFromDirectory(skillsPath);
      skillsLoaded = true;
      break;
    }
  }
  if (!skillsLoaded) {
    console.warn("Could not find skills directory in any of the expected locations");
    console.warn("Tried paths:", possiblePaths);
  }
  const userSkillsPath = join11(process.cwd(), ".irg", "skills");
  if (await directoryExists(userSkillsPath)) {
    console.log(`Loading user skills from: ${userSkillsPath}`);
    await registerSkillsFromDirectory(userSkillsPath);
  }
  return LoadedSkills;
}
function getLoadedSkills() {
  return LoadedSkills;
}
function shouldTriggerByKeyword(skill, prompt) {
  if (!skill.trigger || skill.trigger.length === 0) return false;
  const lowerPrompt = prompt.toLowerCase();
  return skill.trigger.some((t) => lowerPrompt.includes(t.toLowerCase()));
}
function simpleGlobMatch(str, pattern) {
  const regexStr = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "{{DOUBLESTAR}}").replace(/\*/g, "[^/]*").replace(/{{DOUBLESTAR}}/g, ".*").replace(/\?/g, "[^/]");
  try {
    const regex = new RegExp(`^${regexStr}$`, "i");
    return regex.test(str);
  } catch {
    return false;
  }
}
function shouldTriggerByPaths(skill, prompt) {
  if (!skill.paths || skill.paths.length === 0) return false;
  const lowerPrompt = prompt.toLowerCase();
  for (const pattern of skill.paths) {
    const fileRefs = lowerPrompt.match(/[\w/.-]+\.\w+/g) || [];
    for (const ref of fileRefs) {
      if (simpleGlobMatch(ref, pattern)) return true;
    }
  }
  return false;
}
function shouldTriggerByDescription(skill, prompt) {
  if (!skill.metadata.description) return false;
  const descLower = skill.metadata.description.toLowerCase();
  const promptWords = prompt.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  let matchCount = 0;
  for (const word of promptWords) {
    if (descLower.includes(word)) matchCount += 1;
  }
  return matchCount >= Math.max(1, Math.ceil(promptWords.length * 0.3));
}
function detectRelevantSkills(prompt) {
  const skills = getLoadedSkills();
  return skills.filter((skill) => {
    if (skill.metadata.disableModelInvocation) return false;
    return shouldTriggerByKeyword(skill, prompt) || shouldTriggerByPaths(skill, prompt) || shouldTriggerByDescription(skill, prompt);
  });
}
function findSkillByName(name) {
  const lowerName = name.toLowerCase();
  return LoadedSkills.find(
    (s) => s.name.toLowerCase() === lowerName || s.name.toLowerCase().replace(/\s+/g, "-") === lowerName
  );
}
async function loadSkillInstruction(skill) {
  if (skill._instructionCache) return skill._instructionCache;
  const references = [];
  if (skill.dirPath) {
    try {
      const refDir = join11(skill.dirPath, "references");
      const entries = await readdir6(refDir);
      for (const entry of entries) {
        if (entry.endsWith(".md") || entry.endsWith(".txt")) {
          references.push(join11(refDir, entry));
        }
      }
    } catch {
    }
  }
  const instruction = {
    content: skill.content,
    references
  };
  skill._instructionCache = instruction;
  return instruction;
}
function formatSkillMetadataForPrompt(skills) {
  if (skills.length === 0) return "";
  const lines = ["<available_skills>"];
  for (const skill of skills) {
    if (skill.metadata.disableModelInvocation) continue;
    let line = `- ${skill.name}: ${skill.metadata.description || "No description"}`;
    if (skill.metadata.argumentHint) {
      line += ` (Usage: /${skill.name} ${skill.metadata.argumentHint})`;
    }
    lines.push(line);
  }
  lines.push("</available_skills>");
  return lines.join("\n");
}
function formatSkillInstructionForPrompt(skill) {
  const parts = [];
  parts.push(`=== SKILL: ${skill.name} ===`);
  if (skill.metadata.description) {
    parts.push(`Description: ${skill.metadata.description}`);
  }
  parts.push("");
  parts.push(skill.content);
  if (skill.metadata.allowedTools && skill.metadata.allowedTools.length > 0) {
    parts.push("");
    parts.push(`Allowed tools: ${skill.metadata.allowedTools.join(", ")}`);
  }
  if (skill.dirPath) {
    parts.push("");
    parts.push(`Skill directory: ${skill.dirPath}`);
    parts.push("Reference files, scripts, and templates are available in this directory.");
    parts.push("Use Read tool to inspect reference files. Use Shell tool to execute scripts.");
  }
  parts.push("");
  parts.push("INSTRUCTIONS: Follow the workflow outlined above. Complete ALL steps in order.");
  return parts.join("\n");
}

// skills/skillTool.ts
var SkillTool = {
  name: "Skill",
  inputSchema: null,
  outputSchema: null,
  async description(_input, _context) {
    const skills = getLoadedSkills();
    const metaList = formatSkillMetadataForPrompt(
      skills.filter((s) => !s.metadata.disableModelInvocation)
    );
    return [
      "Execute a skill within the main conversation. Use this tool when you need to invoke a specific skill by name.",
      metaList
    ].join("\n\n");
  },
  async call(args, context, canUseTool2, _parentMessage) {
    const skill = findSkillByName(args.command);
    if (!skill) {
      return {
        data: {
          status: "not_found"
        }
      };
    }
    const instruction = await loadSkillInstruction(skill);
    const formatted = formatSkillInstructionForPrompt(skill);
    let fullInstruction = formatted;
    if (args.arguments?.trim()) {
      fullInstruction += `

User arguments: ${args.arguments}`;
    }
    if (instruction.references.length > 0) {
      fullInstruction += "\n\nAvailable reference files (read them if needed):";
      for (const ref of instruction.references) {
        fullInstruction += `
- ${ref}`;
      }
    }
    return {
      data: {
        status: "invoked",
        skillName: skill.name,
        instruction: fullInstruction
      },
      contextModifier: (ctx) => {
        return {
          ...ctx,
          agentType: skill.metadata.agent || ctx.agentType
        };
      }
    };
  },
  async validateInput(input3) {
    if (!input3.command?.trim()) {
      return { result: false, message: "Skill command name is required" };
    }
    return { result: true };
  },
  async checkPermissions(_input, _context) {
    return { behavior: "allow" };
  },
  isReadOnly() {
    return true;
  },
  isConcurrencySafe() {
    return true;
  }
};

// discovery/moduleDiscovery.ts
import { readdir as readdir7, stat as stat6 } from "fs/promises";
import { join as join12, extname } from "path";
var SOURCE_EXTENSIONS = /* @__PURE__ */ new Set([
  ".cs",
  ".cpp",
  ".cc",
  ".cxx",
  ".c++",
  ".hpp",
  ".h",
  ".hxx",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py"
]);
var LANGUAGE_EXT = {
  ".cs": "csharp",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".c++": "cpp",
  ".hpp": "cpp",
  ".h": "cpp",
  ".hxx": "cpp",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "typescript",
  ".jsx": "typescript",
  ".py": "python"
};
function detectLang(filePath) {
  const ext = extname(filePath).toLowerCase();
  return LANGUAGE_EXT[ext] || "unknown";
}
async function collectSourceFiles(dirPath, maxFiles = 200) {
  const files = [];
  const stack = [dirPath];
  while (stack.length > 0 && files.length < maxFiles) {
    const current = stack.pop();
    let entries;
    try {
      entries = await readdir7(current);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = join12(current, entry);
      let st;
      try {
        st = await stat6(fullPath);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (!entry.startsWith(".") && entry !== "node_modules" && entry !== "bin" && entry !== "obj") {
          stack.push(fullPath);
        }
      } else if (st.isFile() && SOURCE_EXTENSIONS.has(extname(entry).toLowerCase())) {
        files.push(fullPath);
      }
    }
  }
  return files;
}
async function discoverModules(cwd2, targetPaths = []) {
  const modules = [];
  const scanDirs = targetPaths.length > 0 ? targetPaths.map((p) => join12(cwd2, p)) : [cwd2];
  for (const scanDir of scanDirs) {
    let entries;
    try {
      entries = await readdir7(scanDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = join12(scanDir, entry);
      let st;
      try {
        st = await stat6(fullPath);
      } catch {
        continue;
      }
      if (!st.isDirectory() || entry.startsWith(".")) continue;
      const sourceFiles = await collectSourceFiles(fullPath);
      if (sourceFiles.length === 0) continue;
      const langCounts = {};
      for (const sf of sourceFiles) {
        const lang = detectLang(sf);
        langCounts[lang] = (langCounts[lang] || 0) + 1;
      }
      const dominantLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";
      const manifestCandidates = ["package.json", "project.json", "CMakeLists.txt", "Makefile", "setup.py", "pyproject.toml"];
      let manifestFile;
      for (const mc of manifestCandidates) {
        try {
          await stat6(join12(fullPath, mc));
          manifestFile = join12(fullPath, mc);
          break;
        } catch {
        }
      }
      const entryCandidates = sourceFiles.filter(
        (f) => f.endsWith("Program.cs") || f.endsWith("main.cpp") || f.endsWith("main.cc") || f.endsWith("index.ts") || f.endsWith("__init__.py") || f.endsWith("main.py")
      );
      modules.push({
        type: "local_module",
        name: entry,
        rootPath: fullPath,
        entryFiles: entryCandidates.length > 0 ? entryCandidates : sourceFiles.slice(0, 3),
        sourceFiles,
        manifestFile,
        language: dominantLang
      });
    }
  }
  return modules;
}

// discovery/parsers/csharpParser.ts
import { readFile as readFile11 } from "fs/promises";
function extractDocComment(lines, declLineIdx) {
  const docLines = [];
  let i = declLineIdx - 1;
  while (i >= 0) {
    const line = lines[i].trim();
    if (line.startsWith("///")) {
      docLines.unshift(line.replace(/^\/\/\/\s?/, ""));
    } else if (line === "" || line.startsWith("[") || line.startsWith("//")) {
      i--;
      continue;
    } else {
      break;
    }
    i--;
  }
  return docLines.length > 0 ? docLines.join("\n") : void 0;
}
function parseParams(paramStr) {
  if (!paramStr.trim()) return [];
  const params = [];
  let depth = 0;
  let current = "";
  for (const ch of paramStr) {
    if (ch === "<" || ch === "(") depth++;
    else if (ch === ">" || ch === ")") depth--;
    if (ch === "," && depth === 0) {
      params.push(parseParamItem(current.trim()));
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    params.push(parseParamItem(current.trim()));
  }
  return params.filter((p) => p.name !== "unknown" || p.type !== "unknown");
}
function parseParamItem(item) {
  const defaultMatch = item.match(/^(.+?)\s*=\s*(.+)$/);
  let typeAndName = item;
  let defaultValue;
  if (defaultMatch) {
    typeAndName = defaultMatch[1].trim();
    defaultValue = defaultMatch[2].trim();
  }
  const parts = typeAndName.split(/\s+/);
  const modifiers = /* @__PURE__ */ new Set(["ref", "out", "in", "params", "this"]);
  const nameParts = [];
  const typeParts = [];
  for (let i = 0; i < parts.length; i++) {
    if (modifiers.has(parts[i])) {
      typeParts.push(parts[i]);
    } else if (i === parts.length - 1) {
      nameParts.push(parts[i]);
    } else {
      typeParts.push(parts[i]);
    }
  }
  return {
    name: nameParts.join(" ") || "unknown",
    type: typeParts.join(" ") || "var",
    required: defaultValue === void 0,
    defaultValue,
    description: ""
  };
}
function extractModifiers(modifierStr) {
  return modifierStr.split(/\s+/).filter((m) => m.length > 0).filter((m) => !["class", "struct", "interface", "enum", "record"].includes(m));
}
function matchBlock(source, startIdx, openChar, closeChar) {
  let depth = 0;
  let result = "";
  for (let i = startIdx; i < source.length; i++) {
    if (source[i] === openChar) depth++;
    else if (source[i] === closeChar) {
      depth--;
      if (depth === 0) {
        result = source.slice(startIdx + 1, i);
        break;
      }
    }
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i];
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") i++;
        i++;
      }
    }
  }
  return result;
}
var CS_CLASS_RE = /((?:public|private|protected|internal|static|abstract|sealed|partial|unsafe|readonly)\s+)*\b(class|struct|interface|record)\s+(\w+(?:<[^>]*>)?)\s*(?::\s*([^{]+?))?\s*\{/g;
var CS_METHOD_RE = /((?:public|private|protected|internal|static|virtual|override|abstract|async|unsafe|extern|partial|new|sealed|readonly)\s+)*(\w+(?:<[^>]*>(?:\s*\?)?|\[\s*\])?)\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)/g;
var CS_CONSTRUCTOR_RE = /((?:public|private|protected|internal|static|extern)\s+)*(\w+)\s*\(([^)]*)\)\s*(?::\s*base\s*\([^)]*\))?\s*\{/g;
var CS_PROPERTY_RE = /((?:public|private|protected|internal|static|virtual|override|abstract|new|sealed|readonly)\s+)*(\w+(?:<[^>]*>(?:\s*\?)?|\[\s*\])?)\s+(\w+)\s*\{/g;
var CS_FIELD_RE = /((?:public|private|protected|internal|static|readonly|const|volatile|new)\s+)*(\w+(?:<[^>]*>(?:\s*\?)?|\[\s*\])?)\s+(\w+)\s*(?:=|;)/g;
var CS_USING_RE = /using\s+(\S+(?:\s*=\s*\S+)?)\s*;/g;
var CS_ENUM_RE = /((?:public|private|protected|internal)\s+)?enum\s+(\w+)\s*(?::\s*(\w+))?\s*\{([^}]*)\}/gs;
async function parseCSharpFile(filePath) {
  const source = await readFile11(filePath, "utf8");
  const lines = source.split("\n");
  const imports = [];
  let match;
  const usingRe = new RegExp(CS_USING_RE.source, "g");
  while ((match = usingRe.exec(source)) !== null) {
    imports.push({ source: match[1], names: [match[1]] });
  }
  const classes = [];
  const enums = [];
  const functions = [];
  const classRe = new RegExp(CS_CLASS_RE.source, "g");
  while ((match = classRe.exec(source)) !== null) {
    const modifiers = extractModifiers(match[1] || "");
    const kind = match[2];
    const name = match[3];
    const bases = (match[4] || "").split(",").map((b) => b.trim()).filter(Boolean);
    const bodyStart = match.index + match[0].length;
    const body = matchBlock(source, bodyStart - 1, "{", "}");
    const declLineIdx = source.slice(0, match.index).split("\n").length - 1;
    const cls = {
      name,
      modifiers,
      baseTypes: bases,
      methods: extractCSharpMethods(body, name),
      properties: extractCSharpProperties(body),
      fields: extractCSharpFields(body),
      constructors: extractCSharpConstructors(body, name),
      docComment: extractDocComment(lines, declLineIdx)
    };
    const namespaceMatch = source.slice(0, match.index).match(/namespace\s+(\S+)/);
    if (namespaceMatch && !namespaceMatch[0].includes("//")) {
      const nsIdx = source.slice(0, match.index).lastIndexOf(namespaceMatch[0]);
      if (nsIdx > 0 && source[nsIdx - 1] !== "/") {
        cls.namespace = namespaceMatch[1];
      }
    }
    classes.push(cls);
    if (kind === "interface") {
      cls.properties = [];
      cls.fields = [];
      cls.constructors = [];
    }
  }
  const enumRe = new RegExp(CS_ENUM_RE.source, "g");
  while ((match = enumRe.exec(source)) !== null) {
    const members = [];
    const bodyStr = match[4];
    const memberLines = bodyStr.split(",");
    for (const ml of memberLines) {
      const trimmed = ml.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf("=");
      members.push({
        name: eqIdx > 0 ? trimmed.slice(0, eqIdx).trim() : trimmed,
        value: eqIdx > 0 ? trimmed.slice(eqIdx + 1).trim() : void 0
      });
    }
    enums.push({
      name: match[2],
      modifiers: match[1] ? extractModifiers(match[1]) : [],
      members
    });
  }
  return {
    path: filePath,
    language: "csharp",
    imports,
    classes,
    functions,
    enums
  };
}
function extractCSharpMethods(body, className) {
  const methods = [];
  const re = new RegExp(CS_METHOD_RE.source, "g");
  let match;
  while ((match = re.exec(body)) !== null) {
    const name = match[3];
    if (name === className) continue;
    methods.push({
      name,
      modifiers: extractModifiers(match[1] || ""),
      returnType: match[2],
      params: parseParams(match[5])
    });
  }
  return methods;
}
function extractCSharpConstructors(body, className) {
  const ctors = [];
  const re = new RegExp(CS_CONSTRUCTOR_RE.source, "g");
  let match;
  while ((match = re.exec(body)) !== null) {
    if (match[2] === className) {
      ctors.push({
        modifiers: extractModifiers(match[1] || ""),
        params: parseParams(match[3])
      });
    }
  }
  return ctors;
}
function extractCSharpProperties(body) {
  const props = [];
  const re = new RegExp(CS_PROPERTY_RE.source, "g");
  let match;
  while ((match = re.exec(body)) !== null) {
    const propEnd = body.indexOf("{", match.index + match[0].length);
    const accessorBlock = body.slice(match.index + match[0].length);
    props.push({
      name: match[3],
      type: match[2],
      modifiers: extractModifiers(match[1] || ""),
      hasGetter: /\bget\b/.test(accessorBlock.slice(0, 200)),
      hasSetter: /\bset\b/.test(accessorBlock.slice(0, 200))
    });
  }
  return props;
}
function extractCSharpFields(body) {
  const fields = [];
  const re = new RegExp(CS_FIELD_RE.source, "g");
  let match;
  while ((match = re.exec(body)) !== null) {
    fields.push({
      name: match[3],
      type: match[2],
      modifiers: extractModifiers(match[1] || "")
    });
  }
  return fields.filter((f) => !f.name.includes("{"));
}

// discovery/parsers/cppParser.ts
import { readFile as readFile12 } from "fs/promises";
function extractDocComment2(lines, declLineIdx) {
  const docLines = [];
  let i = declLineIdx - 1;
  if (i >= 0 && lines[i].trim().endsWith("*/")) {
    let blockLines = [];
    let inBlock = false;
    while (i >= 0) {
      const line = lines[i].trim();
      if (line.startsWith("/*") || line.startsWith("/**")) {
        blockLines.unshift(line.replace(/^\/\*\*?\s?/, "").replace(/\*\/$/, "").trim());
        inBlock = true;
        i--;
        break;
      }
      if (line.includes("*/") || line.startsWith("*")) {
        blockLines.unshift(line.replace(/^\*\s?/, "").replace(/\*\/$/, "").trim());
        i--;
      } else if (line === "" && blockLines.length > 0) {
        i--;
        continue;
      } else {
        break;
      }
    }
    if (inBlock && blockLines.length > 0) {
      return blockLines.join("\n");
    }
  }
  while (i >= 0) {
    const line = lines[i].trim();
    if (line.startsWith("///")) {
      docLines.unshift(line.replace(/^\/\/\/\s?/, ""));
    } else if (line === "" || line.startsWith("//")) {
      i--;
      continue;
    } else {
      break;
    }
    i--;
  }
  return docLines.length > 0 ? docLines.join("\n") : void 0;
}
function parseParams2(paramStr) {
  if (!paramStr.trim()) return [];
  const params = [];
  let depth = 0;
  let current = "";
  for (const ch of paramStr) {
    if (ch === "<" || ch === "(" || ch === "{") depth++;
    else if (ch === ">" || ch === ")" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      params.push(parseParamItem2(current.trim()));
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    params.push(parseParamItem2(current.trim()));
  }
  return params.filter((p) => p.type !== "unknown" || p.name !== "unknown");
}
function parseParamItem2(item) {
  const defaultMatch = item.match(/^(.+?)\s*=\s*(.+)$/);
  let typeAndName = item;
  let defaultValue;
  if (defaultMatch) {
    typeAndName = defaultMatch[1].trim();
    defaultValue = defaultMatch[2].trim();
  }
  const cleanItem = typeAndName.replace(/const\s+/g, "").replace(/&{1,2}/g, "").replace(/\*/g, "").trim();
  const parts = cleanItem.split(/\s+/);
  if (parts.length === 1) {
    return { name: parts[0], type: "auto", required: !defaultValue, defaultValue, description: "" };
  }
  const name = parts[parts.length - 1];
  const type = parts.slice(0, -1).join(" ");
  return {
    name,
    type: type || "auto",
    required: defaultValue === void 0,
    defaultValue,
    description: ""
  };
}
function extractModifiers2(modifierStr) {
  if (!modifierStr) return [];
  return modifierStr.split(/\s+/).filter(Boolean).filter((m) => !["class", "struct", "enum"].includes(m));
}
function matchBlock2(source, startIdx, openChar, closeChar) {
  let depth = 0;
  for (let i = startIdx; i < source.length; i++) {
    if (source[i] === openChar) {
      depth++;
      if (depth === 1) continue;
    } else if (source[i] === closeChar) {
      depth--;
      if (depth === 0) {
        return source.slice(startIdx + 1, i);
      }
    }
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i];
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") i++;
        i++;
      }
    }
    if (source[i] === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
    }
    if (source[i] === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i++;
    }
  }
  return "";
}
var CPP_CLASS_RE = /\b(class|struct)\s+(\w+(?:<[^>]*>)?)\s*(?::\s*([^{]+?))?\s*\{/g;
var CPP_FUNC_RE = /((?:virtual|static|inline|constexpr|explicit|friend|extern)\s+)*(\w+(?:<[^>]*>(?:\s*[*&]{1,2})?|[\w:]+))\s+(\w+)\s*\(([^)]*)\)\s*(const)?/g;
var CPP_TEMPLATE_FUNC_RE = /template\s*<[^>]*>\s*\n?\s*((?:(?:virtual|static|inline|constexpr|explicit)\s+)*)\s*(\w+(?:<[^>]*>(?:\s*[*&]{1,2})?|[\w:]+))\s+(\w+)\s*\(([^)]*)\)/g;
var CPP_TEMPLATE_CLASS_RE = /template\s*<[^>]*>\s*\n?\s*\b(class|struct)\s+(\w+(?:<[^>]*>)?)\s*(?::\s*([^{]+?))?\s*\{/g;
var CPP_INCLUDE_RE = /#include\s+[<"]([^>"]+)[>"]/g;
var CPP_ENUM_RE = /\benum\s+(?:class\s+)?(\w+)\s*(?::\s*(\w+))?\s*\{([^}]*)\}/gs;
async function parseCppFile(filePath) {
  const source = await readFile12(filePath, "utf8");
  const lines = source.split("\n");
  const imports = [];
  let match;
  const includeRe = new RegExp(CPP_INCLUDE_RE.source, "g");
  while ((match = includeRe.exec(source)) !== null) {
    imports.push({ source: match[1], names: [match[1]] });
  }
  const classes = [];
  const functions = [];
  const enums = [];
  const classRe = new RegExp(CPP_CLASS_RE.source, "g");
  while ((match = classRe.exec(source)) !== null) {
    const name = match[2];
    const bases = (match[3] || "").split(",").map((b) => b.trim().replace(/public|private|protected/g, "").trim()).filter(Boolean);
    const body = matchBlock2(source, match.index + match[0].length - 1, "{", "}");
    const declLineIdx = source.slice(0, match.index).split("\n").length - 1;
    const cls = {
      name,
      modifiers: [],
      baseTypes: bases,
      methods: extractCppMethods(body),
      properties: [],
      fields: extractCppFields(body),
      constructors: extractCppConstructors(body, name),
      docComment: extractDocComment2(lines, declLineIdx)
    };
    classes.push(cls);
  }
  const templateClassRe = new RegExp(CPP_TEMPLATE_CLASS_RE.source, "g");
  while ((match = templateClassRe.exec(source)) !== null) {
    const name = match[2];
    const bases = (match[3] || "").split(",").map((b) => b.trim().replace(/public|private|protected/g, "").trim()).filter(Boolean);
    const body = matchBlock2(source, match.index + match[0].length - 1, "{", "}");
    classes.push({
      name: `${name}<T>`,
      modifiers: [],
      baseTypes: bases,
      methods: extractCppMethods(body),
      properties: [],
      fields: extractCppFields(body),
      constructors: [],
      docComment: void 0
    });
  }
  const funcRe = new RegExp(CPP_FUNC_RE.source, "g");
  while ((match = funcRe.exec(source)) !== null) {
    const name = match[3];
    if (isCppKeyword(name) || name.includes("::")) continue;
    functions.push({
      name,
      returnType: match[2],
      params: parseParams2(match[4]),
      modifiers: extractModifiers2(match[1] || ""),
      isTemplate: false
    });
  }
  const templateFuncRe = new RegExp(CPP_TEMPLATE_FUNC_RE.source, "g");
  while ((match = templateFuncRe.exec(source)) !== null) {
    const name = match[3];
    if (isCppKeyword(name)) continue;
    functions.push({
      name: `${name}<T>`,
      returnType: match[2],
      params: parseParams2(match[4]),
      modifiers: extractModifiers2(match[1] || ""),
      isTemplate: true
    });
  }
  const enumRe = new RegExp(CPP_ENUM_RE.source, "g");
  while ((match = enumRe.exec(source)) !== null) {
    const members = [];
    const bodyStr = match[3];
    const memberLines = bodyStr.split(",");
    for (const ml of memberLines) {
      const trimmed = ml.trim();
      if (!trimmed || trimmed.startsWith("//")) continue;
      const eqIdx = trimmed.indexOf("=");
      members.push({
        name: eqIdx > 0 ? trimmed.slice(0, eqIdx).trim() : trimmed,
        value: eqIdx > 0 ? trimmed.slice(eqIdx + 1).trim() : void 0
      });
    }
    enums.push({
      name: match[1],
      modifiers: [],
      members
    });
  }
  const dedupedFunctions = functions.filter(
    (f, idx, arr) => arr.findIndex((x) => x.name === f.name) === idx
  );
  return {
    path: filePath,
    language: "cpp",
    imports,
    classes,
    functions: dedupedFunctions,
    enums
  };
}
function isCppKeyword(name) {
  const keywords = /* @__PURE__ */ new Set([
    "if",
    "else",
    "for",
    "while",
    "do",
    "switch",
    "case",
    "default",
    "return",
    "break",
    "continue",
    "goto",
    "throw",
    "try",
    "catch",
    "new",
    "delete",
    "sizeof",
    "typeof",
    "typeid",
    "const",
    "static",
    "virtual",
    "override",
    "final",
    "public",
    "private",
    "protected"
  ]);
  return keywords.has(name);
}
function extractCppMethods(body) {
  const methods = [];
  const re = new RegExp(CPP_FUNC_RE.source, "g");
  let match;
  while ((match = re.exec(body)) !== null) {
    const name = match[3];
    if (isCppKeyword(name)) continue;
    methods.push({
      name,
      modifiers: extractModifiers2(match[1] || ""),
      returnType: match[2],
      params: parseParams2(match[4])
    });
  }
  return methods;
}
function extractCppConstructors(body, className) {
  const ctors = [];
  const re = new RegExp(
    `(?:explicit\\s+)?${className}\\s*\\(([^)]*)\\)`,
    "g"
  );
  let match;
  while ((match = re.exec(body)) !== null) {
    ctors.push({
      modifiers: body.slice(Math.max(0, match.index - 20), match.index).includes("explicit") ? ["explicit"] : [],
      params: parseParams2(match[1])
    });
  }
  return ctors;
}
function extractCppFields(body) {
  const fields = [];
  const fieldRe = /(\w+(?:<[^>]*>(?:\s*[*&]{1,2})?|[\w:]+))\s+(\w+)\s*;/g;
  let match;
  while ((match = fieldRe.exec(body)) !== null) {
    const name = match[2];
    const type = match[1];
    if (isCppKeyword(name)) continue;
    if (name === "return" || name === "operator") continue;
    fields.push({ name, type, modifiers: [] });
  }
  return fields;
}

// discovery/staticAnalyzer.ts
import { extname as extname2 } from "path";
var EXT_LANG_MAP = {
  ".cs": "csharp",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".c++": "cpp",
  ".hpp": "cpp",
  ".h": "cpp",
  ".hxx": "cpp",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "typescript",
  ".jsx": "typescript",
  ".py": "python"
};
function detectLanguage(filePath) {
  const ext = extname2(filePath).toLowerCase();
  return EXT_LANG_MAP[ext] || "unknown";
}
async function analyzeModule(module) {
  const allParsed = [];
  for (const filePath of module.sourceFiles) {
    const lang = detectLanguage(filePath);
    if (lang === "csharp") {
      allParsed.push(await parseCSharpFile(filePath));
    } else if (lang === "cpp") {
      allParsed.push(await parseCppFile(filePath));
    }
  }
  const publicApi = extractPublicApi(allParsed);
  const dependencies = extractDependencies(allParsed);
  const configuration = extractConfiguration(module, allParsed);
  const usagePatterns = extractUsagePatterns(allParsed);
  const overview = buildOverview(module, allParsed);
  const purpose = buildPurpose(module, allParsed);
  const wiki = {
    name: module.name,
    type: module.type,
    version: "1.0.0",
    sourceHash: computeSourceHash(module),
    analyzedAt: (/* @__PURE__ */ new Date()).toISOString(),
    overview,
    purpose,
    publicApi,
    dependencies,
    dependents: [],
    usagePatterns,
    antiPatterns: [],
    configuration,
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
  };
  return wiki;
}
function extractPublicApi(parsedFiles) {
  const api = [];
  for (const file of parsedFiles) {
    for (const cls of file.classes) {
      if (cls.modifiers.includes("private") || cls.modifiers.includes("protected")) continue;
      api.push({
        name: cls.namespace ? `${cls.namespace}.${cls.name}` : cls.name,
        kind: "class",
        signature: cls.baseTypes.length > 0 ? `class ${cls.name} : ${cls.baseTypes.join(", ")}` : `class ${cls.name}`,
        description: cls.docComment || `${cls.name} class`,
        params: [],
        isExported: true
      });
      for (const ctor of cls.constructors) {
        if (ctor.modifiers.includes("private") || ctor.modifiers.includes("protected")) continue;
        api.push({
          name: `${cls.name}.ctor`,
          kind: "constructor",
          signature: `new ${cls.name}(${ctor.params.map((p) => `${p.type} ${p.name}`).join(", ")})`,
          description: ctor.docComment || `Constructor for ${cls.name}`,
          params: ctor.params,
          isExported: true
        });
      }
      for (const method of cls.methods) {
        if (method.modifiers.includes("private") || method.modifiers.includes("protected")) continue;
        const paramStr = method.params.map((p) => `${p.type} ${p.name}`).join(", ");
        api.push({
          name: `${cls.name}.${method.name}`,
          kind: "method",
          signature: `${method.returnType} ${method.name}(${paramStr})`,
          description: method.docComment || `${method.name} method`,
          params: method.params,
          returnType: method.returnType,
          isExported: true
        });
      }
      for (const prop of cls.properties) {
        if (prop.modifiers.includes("private") || prop.modifiers.includes("protected")) continue;
        api.push({
          name: `${cls.name}.${prop.name}`,
          kind: "property",
          signature: `${prop.type} ${prop.name} { ${prop.hasGetter ? "get; " : ""}${prop.hasSetter ? "set; " : ""}}`,
          description: prop.docComment || `${prop.name} property`,
          params: [],
          returnType: prop.type,
          isExported: true
        });
      }
    }
    for (const func of file.functions) {
      const paramStr = func.params.map((p) => `${p.type} ${p.name}`).join(", ");
      api.push({
        name: func.name,
        kind: "function",
        signature: `${func.returnType} ${func.name}(${paramStr})`,
        description: func.docComment || `${func.name} function`,
        params: func.params,
        returnType: func.returnType,
        isExported: true
      });
    }
    for (const enm of file.enums) {
      api.push({
        name: enm.name,
        kind: "enum",
        signature: `enum ${enm.name} { ${enm.members.map((m) => m.name).join(", ")} }`,
        description: enm.docComment || `${enm.name} enum`,
        params: [],
        isExported: true
      });
    }
  }
  return api;
}
function extractDependencies(parsedFiles) {
  const deps = /* @__PURE__ */ new Set();
  for (const file of parsedFiles) {
    for (const imp of file.imports) {
      const name = imp.source.split(".")[0] || imp.source;
      deps.add(name);
    }
  }
  return [...deps];
}
function extractConfiguration(module, _parsedFiles) {
  const configs = [];
  if (module.manifestFile) {
    configs.push({
      key: "module.manifest",
      type: "string",
      defaultValue: module.manifestFile,
      description: `Module manifest file`,
      required: true
    });
  }
  for (const file of _parsedFiles) {
    for (const cls of file.classes) {
      for (const field of cls.fields) {
        if (field.name.toUpperCase() === field.name) {
          configs.push({
            key: `${cls.name}.${field.name}`,
            type: field.type,
            description: field.docComment || `Static configuration field`,
            required: false
          });
        }
      }
    }
  }
  return configs.slice(0, 20);
}
function extractUsagePatterns(parsedFiles) {
  const patterns = [];
  for (const file of parsedFiles) {
    for (const cls of file.classes) {
      if (cls.constructors.length > 0 && cls.methods.length > 0) {
        const primaryCtor = cls.constructors[0];
        const mainMethod = cls.methods.find(
          (m) => m.name.toLowerCase().includes("run") || m.name.toLowerCase().includes("execute") || m.name.toLowerCase().includes("process") || m.name.toLowerCase() === "main"
        ) || cls.methods[0];
        const ctorParams = primaryCtor.params.map((p) => p.name).join(", ");
        const methodParams = mainMethod.params.map((p) => p.name).join(", ");
        patterns.push({
          title: `Using ${cls.name}`,
          code: [
            `var instance = new ${cls.name}(${ctorParams});`,
            `var result = instance.${mainMethod.name}(${methodParams});`
          ].join("\n"),
          description: `Create an instance of ${cls.name} and call ${mainMethod.name}`
        });
      }
    }
  }
  return patterns.slice(0, 5);
}
function buildOverview(module, parsedFiles) {
  const classCount = parsedFiles.reduce((sum, f) => sum + f.classes.length, 0);
  const funcCount = parsedFiles.reduce((sum, f) => sum + f.functions.length, 0);
  const enumCount = parsedFiles.reduce((sum, f) => sum + f.enums.length, 0);
  const parts = [];
  if (classCount > 0) parts.push(`${classCount} classes`);
  if (funcCount > 0) parts.push(`${funcCount} functions`);
  if (enumCount > 0) parts.push(`${enumCount} enums`);
  return `${module.name} module containing ${parts.join(", ")}`;
}
function buildPurpose(module, parsedFiles) {
  const allDocComments = [];
  for (const file of parsedFiles) {
    for (const cls of file.classes) {
      if (cls.docComment) allDocComments.push(cls.docComment);
    }
  }
  if (allDocComments.length > 0) {
    return allDocComments.slice(0, 3).join("; ");
  }
  return `${module.name} module (${module.language})`;
}
function computeSourceHash(module) {
  const names = [...module.sourceFiles].sort().join(",");
  let hash = 0;
  for (let i = 0; i < names.length; i++) {
    const ch = names.charCodeAt(i);
    hash = (hash << 5) - hash + ch;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

// discovery/moduleToolFactory.ts
function buildActionMap(wiki) {
  const map = /* @__PURE__ */ new Map();
  for (const api of wiki.publicApi) {
    map.set(api.name, {
      description: api.description,
      signature: api.signature
    });
  }
  return map;
}
function buildDescription(actionMap, wiki) {
  const lines = [
    `Module: ${wiki.name}`,
    `Purpose: ${wiki.purpose}`,
    `Type: ${wiki.type}`,
    ``,
    `Overview: ${wiki.overview}`,
    ``,
    `Available actions:`
  ];
  for (const [actionName, actionInfo] of actionMap) {
    lines.push(`  - ${actionName}`);
    lines.push(`    Signature: ${actionInfo.signature}`);
    lines.push(`    ${actionInfo.description}`);
    lines.push(``);
  }
  if (wiki.configuration.length > 0) {
    lines.push(`Configuration:`);
    for (const cfg of wiki.configuration.slice(0, 10)) {
      lines.push(`  - ${cfg.key}: ${cfg.description} (default: ${cfg.defaultValue || "none"})`);
    }
    lines.push(``);
  }
  lines.push(`Usage: call with { action: "<action_name>", params: {...} }`);
  return lines.join("\n");
}
function createModuleTool(wiki) {
  const actionMap = buildActionMap(wiki);
  const descText = buildDescription(actionMap, wiki);
  return {
    name: `${wiki.name}Module`,
    inputSchema: null,
    outputSchema: null,
    async description() {
      return descText;
    },
    async call(args, context, _canUseTool, _parentMessage) {
      const action = actionMap.get(args.action);
      if (!action) {
        return {
          data: {
            moduleName: wiki.name,
            action: args.action || "(none)",
            result: `Unknown action "${args.action}". Available: ${[...actionMap.keys()].join(", ")}`,
            availableActions: [...actionMap.keys()]
          }
        };
      }
      const apiEntry = wiki.publicApi.find((a) => a.name === args.action);
      const resultLines = [
        `Module: ${wiki.name}`,
        `Action: ${args.action}`,
        `Signature: ${action.signature}`,
        `Description: ${apiEntry?.description || action.description}`
      ];
      if (apiEntry?.params && apiEntry.params.length > 0) {
        resultLines.push(``);
        resultLines.push(`Parameters:`);
        for (const p of apiEntry.params) {
          const val = args.params?.[p.name];
          resultLines.push(
            `  - ${p.name}: ${p.type} ${p.required ? "(required)" : `(optional, default: ${p.defaultValue || "none"})`}`
          );
          if (val !== void 0) {
            resultLines.push(`    Provided value: ${JSON.stringify(val)}`);
          }
        }
      }
      if (wiki.usagePatterns.length > 0) {
        resultLines.push(``);
        resultLines.push(`Usage Examples:`);
        for (const pattern of wiki.usagePatterns.slice(0, 3)) {
          resultLines.push(`  ${pattern.title}:`);
          resultLines.push(`    ${pattern.code.replace(/\n/g, "\n    ")}`);
        }
      }
      return {
        data: {
          moduleName: wiki.name,
          action: args.action,
          result: resultLines.join("\n"),
          availableActions: [...actionMap.keys()]
        }
      };
    },
    isReadOnly() {
      return true;
    },
    isConcurrencySafe() {
      return true;
    },
    async validateInput(input3) {
      if (!input3.action || typeof input3.action !== "string") {
        return { result: false, message: `Action is required. Available: ${[...actionMap.keys()].join(", ")}` };
      }
      return { result: true };
    },
    async checkPermissions(_input, _context) {
      return { behavior: "allow" };
    }
  };
}

// discovery/knowledgeExtractor.ts
function extractKnowledgeEntries(moduleWiki) {
  const entries = [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  entries.push({
    id: createId(),
    category: "fact",
    content: [
      `# ${moduleWiki.name}`,
      ``,
      `## Overview`,
      moduleWiki.overview,
      ``,
      `## Purpose`,
      moduleWiki.purpose,
      ``,
      `## Type`,
      `${moduleWiki.type} version ${moduleWiki.version}`,
      ``,
      moduleWiki.dependencies.length > 0 ? `## Dependencies
${moduleWiki.dependencies.map((d) => `- ${d}`).join("\n")}` : ""
    ].filter(Boolean).join("\n"),
    source: "skill_extraction",
    confidence: 0.9,
    usageCount: 0,
    lastUsed: now,
    createdAt: now,
    tags: ["module", moduleWiki.type, moduleWiki.name.toLowerCase()]
  });
  entries.push({
    id: createId(),
    category: "pattern",
    content: [
      `# ${moduleWiki.name} API Reference`,
      ``,
      ...moduleWiki.publicApi.map(
        (api) => [
          `## ${api.kind}: ${api.name}`,
          `**Signature**: \`${api.signature}\``,
          ``,
          api.description,
          ``,
          api.params.length > 0 ? [
            `**Parameters**:`,
            ...api.params.map(
              (p) => `- \`${p.name}: ${p.type}\`${p.required ? " (required)" : p.defaultValue ? ` (default: ${p.defaultValue})` : ""}${p.description ? ` - ${p.description}` : ""}`
            ),
            ``
          ].join("\n") : "",
          api.returnType ? `**Returns**: \`${api.returnType}\`` : "",
          ``
        ].filter(Boolean).join("\n")
      )
    ].join("\n"),
    source: "skill_extraction",
    confidence: 0.9,
    usageCount: 0,
    lastUsed: now,
    createdAt: now,
    tags: ["api", moduleWiki.name.toLowerCase()]
  });
  if (moduleWiki.usagePatterns.length > 0) {
    entries.push({
      id: createId(),
      category: "pattern",
      content: [
        `# Using ${moduleWiki.name}`,
        ``,
        ...moduleWiki.usagePatterns.map(
          (p) => [
            `## ${p.title}`,
            p.description,
            ``,
            "```",
            p.code,
            "```",
            ``
          ].join("\n")
        )
      ].join("\n"),
      source: "skill_extraction",
      confidence: 0.85,
      usageCount: 0,
      lastUsed: now,
      createdAt: now,
      tags: ["usage", "guide", moduleWiki.name.toLowerCase()]
    });
  }
  if (moduleWiki.configuration.length > 0) {
    entries.push({
      id: createId(),
      category: "fact",
      content: [
        `# ${moduleWiki.name} Configuration`,
        ``,
        ...moduleWiki.configuration.map(
          (c) => [
            `## ${c.key}`,
            `- **Type**: ${c.type}`,
            `- **Required**: ${c.required ? "Yes" : "No"}`,
            c.defaultValue ? `- **Default**: ${c.defaultValue}` : "",
            `- **Description**: ${c.description}`,
            ``
          ].filter(Boolean).join("\n")
        )
      ].join("\n"),
      source: "skill_extraction",
      confidence: 0.85,
      usageCount: 0,
      lastUsed: now,
      createdAt: now,
      tags: ["config", moduleWiki.name.toLowerCase()]
    });
  }
  return entries;
}

// discovery/cache.ts
import { mkdir as mkdir11, readFile as readFile13, writeFile as writeFile10 } from "fs/promises";
import { join as join13 } from "path";
import { createHash } from "crypto";
function getCachePath(cwd2) {
  return join13(cwd2, ".irg", "discovery_cache.json");
}
function computeSourceHash2(filePaths) {
  return createHash("md5").update([...filePaths].sort().join("\n")).digest("hex").slice(0, 16);
}
async function loadCache(cwd2) {
  try {
    const content = await readFile13(getCachePath(cwd2), "utf8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}
async function saveCache(cwd2, store) {
  await mkdir11(join13(cwd2, ".irg"), { recursive: true });
  await writeFile10(getCachePath(cwd2), JSON.stringify(store, null, 2), "utf8");
}
async function getCachedWiki(cwd2, moduleName, sourceFiles) {
  const store = await loadCache(cwd2);
  const entry = store[moduleName];
  if (!entry) return null;
  const currentHash = computeSourceHash2(sourceFiles);
  if (entry.sourceHash === currentHash) {
    return entry.wiki;
  }
  return null;
}
async function setCachedWiki(cwd2, wiki, sourceFiles) {
  const store = await loadCache(cwd2);
  store[wiki.name] = {
    sourceHash: computeSourceHash2(sourceFiles),
    wiki,
    cachedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const keys = Object.keys(store);
  if (keys.length > 50) {
    keys.sort((a, b) => new Date(store[a].cachedAt).getTime() - new Date(store[b].cachedAt).getTime());
    for (const key of keys.slice(0, keys.length - 50)) {
      delete store[key];
    }
  }
  await saveCache(cwd2, store);
}

// discovery/pipeline.ts
async function runDiscoveryPipeline(cwd2, targetPaths = []) {
  const result = {
    modulesAnalyzed: 0,
    toolsCreated: [],
    knowledgeEntries: [],
    errors: []
  };
  const modules = await discoverModules(cwd2, targetPaths);
  for (const module of modules) {
    try {
      const cachedWiki = await getCachedWiki(cwd2, module.name, module.sourceFiles);
      let wiki;
      if (cachedWiki) {
        wiki = cachedWiki;
      } else {
        wiki = await analyzeModule(module);
        await setCachedWiki(cwd2, wiki, module.sourceFiles);
      }
      const tool = createModuleTool(wiki);
      result.modulesAnalyzed++;
      result.toolsCreated.push({
        moduleName: module.name,
        wiki,
        toolName: tool.name,
        tool
      });
      const entries = extractKnowledgeEntries(wiki);
      result.knowledgeEntries.push(...entries);
    } catch (err) {
      result.errors.push(
        `${module.name}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return result;
}
async function analyzeSingleModule(cwd2, moduleName, targetPaths = []) {
  const modules = await discoverModules(cwd2, targetPaths);
  const target = modules.find((m) => m.name === moduleName);
  if (!target) return null;
  const wiki = await analyzeModule(target);
  await setCachedWiki(cwd2, wiki, target.sourceFiles);
  const tool = createModuleTool(wiki);
  return {
    moduleName: target.name,
    wiki,
    toolName: tool.name,
    tool
  };
}

// discovery/DiscoveryTool.ts
var DiscoveryTool = {
  name: "ModuleDiscovery",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return [
      "Discover and analyze source code modules to generate Module Wiki, Tools, and Knowledge entries.",
      "",
      "Actions:",
      "  - list: List all discoverable modules without analysis",
      "  - analyze_all: Analyze all modules and generate tools/knowledge",
      "  - analyze_one: Analyze a single module by name (requires moduleName)",
      "",
      "Input: { action: 'list' | 'analyze_all' | 'analyze_one', moduleName?: string, targetPaths?: string[] }"
    ].join("\n");
  },
  async call(args, context, _canUseTool, _parentMessage) {
    const cwd2 = context.cwd;
    if (args.action === "list") {
      const result = await runDiscoveryPipeline(cwd2, args.targetPaths || []);
      return {
        data: {
          action: "list",
          summary: `Found ${result.modulesAnalyzed} modules`,
          modules: result.toolsCreated.map((m) => ({
            name: m.moduleName,
            type: m.wiki.type,
            language: m.wiki.publicApi.length > 0 ? "analyzed" : "unknown",
            apiCount: m.wiki.publicApi.length
          })),
          toolsRegistered: result.toolsCreated.map((m) => m.toolName),
          knowledgeGenerated: result.knowledgeEntries.length
        }
      };
    }
    if (args.action === "analyze_all") {
      const result = await runDiscoveryPipeline(cwd2, args.targetPaths || []);
      for (const entry of result.knowledgeEntries) {
        await addKnowledge(cwd2, entry.category, entry.content, entry.source, entry.tags, entry.confidence);
      }
      return {
        data: {
          action: "analyze_all",
          summary: `Analyzed ${result.modulesAnalyzed} modules, created ${result.toolsCreated.length} tools, generated ${result.knowledgeEntries.length} knowledge entries. Errors: ${result.errors.length}`,
          modules: result.toolsCreated.map((m) => ({
            name: m.moduleName,
            type: m.wiki.type,
            language: m.wiki.publicApi.length > 0 ? "analyzed" : "unknown",
            apiCount: m.wiki.publicApi.length
          })),
          toolsRegistered: result.toolsCreated.map((m) => m.toolName),
          knowledgeGenerated: result.knowledgeEntries.length
        }
      };
    }
    if (args.action === "analyze_one") {
      if (!args.moduleName) {
        return {
          data: {
            action: "analyze_one",
            summary: "Error: moduleName is required for analyze_one action"
          }
        };
      }
      const entry = await analyzeSingleModule(cwd2, args.moduleName, args.targetPaths || []);
      if (!entry) {
        return {
          data: {
            action: "analyze_one",
            summary: `Module "${args.moduleName}" not found`
          }
        };
      }
      return {
        data: {
          action: "analyze_one",
          summary: `Analyzed module "${entry.moduleName}"`,
          wiki: entry.wiki,
          toolsRegistered: [entry.toolName]
        }
      };
    }
    return {
      data: {
        action: args.action,
        summary: `Unknown action: ${args.action}. Use "list", "analyze_all", or "analyze_one".`
      }
    };
  },
  isReadOnly() {
    return true;
  },
  isConcurrencySafe() {
    return false;
  },
  async validateInput(input3) {
    if (!input3.action || !["list", "analyze_all", "analyze_one"].includes(input3.action)) {
      return { result: false, message: "Action must be one of: list, analyze_all, analyze_one" };
    }
    if (input3.action === "analyze_one" && !input3.moduleName) {
      return { result: false, message: "moduleName is required for analyze_one action" };
    }
    return { result: true };
  },
  async checkPermissions(_input, _context) {
    return { behavior: "allow" };
  }
};

// tools/grpc/grpcClientTool.ts
import { join as join14 } from "path";
import { existsSync } from "fs";
import { createRequire } from "module";
var __require = createRequire(import.meta.url);
var grpc = null;
var protoLoader = null;
async function ensureGrpcLoaded() {
  if (!grpc) {
    grpc = __require("@grpc/grpc-js");
  }
  if (!protoLoader) {
    protoLoader = __require("@grpc/proto-loader");
  }
}
var protoCache = /* @__PURE__ */ new Map();
async function loadProto(protoPath) {
  await ensureGrpcLoaded();
  const { stat: stat7 } = await import("fs/promises");
  const fileStat = await stat7(protoPath).catch(() => null);
  const mtimeMs = fileStat?.mtimeMs || 0;
  const cached = protoCache.get(protoPath);
  if (cached && cached.mtimeMs === mtimeMs) return cached.def;
  const packageDef = await protoLoader.load(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });
  protoCache.set(protoPath, { def: packageDef, mtimeMs });
  return packageDef;
}
function getServiceClient(packageDef, serviceName, address) {
  const proto = grpc.loadPackageDefinition(packageDef);
  const parts = serviceName.split(".");
  let current = proto;
  for (const part of parts) {
    if (current[part]) {
      current = current[part];
    } else {
      throw new Error(`Service "${serviceName}" not found in proto definition. Available: ${Object.keys(current).join(", ")}`);
    }
  }
  if (typeof current !== "function") {
    throw new Error(`"${serviceName}" is not a gRPC service constructor`);
  }
  return new current(address, grpc.credentials.createInsecure());
}
function callMethod(client, methodName, payload, metadata, deadlineMs) {
  return new Promise((resolve5, reject) => {
    const method = client[methodName];
    if (typeof method !== "function") {
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(client)).filter((m) => typeof client[m] === "function" && !m.startsWith("_")).filter((m) => !["close", "getChannel", "waitForReady"].includes(m));
      reject(new Error(`Method "${methodName}" not found. Available: ${methods.join(", ")}`));
      return;
    }
    const meta = new grpc.Metadata();
    for (const [key, value] of Object.entries(metadata)) {
      meta.add(key, value);
    }
    const deadline = new Date(Date.now() + deadlineMs);
    const timer = setTimeout(() => {
      reject(new Error(`gRPC call timed out after ${deadlineMs}ms (is this a streaming RPC? Only unary calls are supported)`));
    }, deadlineMs + 1e3);
    method.call(client, payload, meta, { deadline }, (error, response) => {
      clearTimeout(timer);
      if (error) {
        reject(new Error(`gRPC error [${error.code}]: ${error.details || error.message}`));
      } else {
        resolve5(response);
      }
    });
  });
}
var GrpcClientTool = {
  name: "GrpcClient",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Execute a gRPC call to an external microservice. Use this tool (NOT Shell) when a task requires calling a gRPC service. Parameters: protoFile (path to .proto), service (e.g. 'AlgoGRPC.AlgoService'), method (e.g. 'SendMessage'), address (host:port), payload (JSON object). Example: GrpcClient(protoFile='protos/AlgoService.proto', service='AlgoGRPC.AlgoService', method='SendMessage', address='192.168.25.106:9010', payload={Module:'WaferMapTool', Method:'DrawWaferMap', StringParas:['All']})";
  },
  async call(args, context, _canUseTool, _parentMessage) {
    const startTime = Date.now();
    const deadline = args.deadline || 3e5;
    const metadata = args.metadata || {};
    try {
      const protoPath = args.protoFile.startsWith("/") ? args.protoFile : join14(context.cwd, args.protoFile);
      if (!existsSync(protoPath)) {
        throw new Error(`Proto file not found: ${protoPath}`);
      }
      const packageDef = await loadProto(protoPath);
      const client = getServiceClient(packageDef, args.service, args.address);
      try {
        const response = await callMethod(client, args.method, args.payload, metadata, deadline);
        return {
          data: {
            success: true,
            response,
            durationMs: Date.now() - startTime
          }
        };
      } finally {
        client.close();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`gRPC call failed: ${message}`);
    }
  },
  async validateInput(input3) {
    if (!input3.protoFile || typeof input3.protoFile !== "string") {
      return { result: false, message: "protoFile is required" };
    }
    if (!input3.service || typeof input3.service !== "string") {
      return { result: false, message: "service is required" };
    }
    if (!input3.method || typeof input3.method !== "string") {
      return { result: false, message: "method is required" };
    }
    if (!input3.address || typeof input3.address !== "string") {
      return { result: false, message: "address is required (host:port)" };
    }
    if (!input3.address.match(/^[a-zA-Z0-9._-]+:\d+$/)) {
      return { result: false, message: "address must be in format host:port" };
    }
    if (!input3.payload || typeof input3.payload !== "object") {
      return { result: false, message: "payload is required (object)" };
    }
    return { result: true };
  },
  async checkPermissions() {
    return { behavior: "ask", message: "gRPC call requires confirmation" };
  },
  isReadOnly() {
    return false;
  },
  isConcurrencySafe() {
    return false;
  }
};

// tools/workflow/checkpointTool.ts
var pendingResponses = /* @__PURE__ */ new Map();
function getCheckpointResponse(checkpointId) {
  const response = pendingResponses.get(checkpointId);
  if (response) pendingResponses.delete(checkpointId);
  return response;
}
var CheckpointTool = {
  name: "Checkpoint",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Pause execution and wait for user input. Use this for: approval confirmations, error recovery choices (retry/skip/abort), or collecting user-provided data. The workflow will pause until the user responds.";
  },
  async call(args, context, _canUseTool, _parentMessage) {
    const checkpointId = args.__checkpointId;
    if (checkpointId) {
      const stored = getCheckpointResponse(checkpointId);
      if (stored) {
        return { data: stored };
      }
    }
    throw new Error(
      `Checkpoint "${args.type}" has no response and no checkpointId was injected. The permission flow may have failed. Message: ${args.message}`
    );
  },
  async validateInput(input3) {
    if (!input3.type || !["approval", "error_choice", "data_input"].includes(input3.type)) {
      return { result: false, message: "type must be 'approval', 'error_choice', or 'data_input'" };
    }
    if (!input3.message || typeof input3.message !== "string") {
      return { result: false, message: "message is required" };
    }
    if (input3.type === "error_choice" && (!input3.options || input3.options.length === 0)) {
      return { result: false, message: "options are required for error_choice type" };
    }
    return { result: true };
  },
  async checkPermissions(input3) {
    return {
      behavior: "ask",
      message: input3.message || "Waiting for user input...",
      updatedInput: input3
    };
  },
  isReadOnly() {
    return false;
  },
  isConcurrencySafe() {
    return false;
  }
};

// storage/taskIndex.ts
import { mkdir as mkdir12, readFile as readFile14, readdir as readdir8, rm as rm5, writeFile as writeFile11 } from "fs/promises";
import { join as join15 } from "path";
function getTasksDir(cwd2) {
  return join15(cwd2, ".irg", "tasks");
}
function getTaskInfoPath(cwd2, taskId) {
  return join15(getTasksDir(cwd2), `${taskId}.json`);
}
async function createTask(cwd2, task) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const newTask = {
    ...task,
    createdAt: now,
    updatedAt: now,
    activities: [{
      id: `activity-${Date.now()}`,
      action: "created",
      actor: task.createdBy,
      details: `Task created: ${task.title}`,
      timestamp: now
    }],
    statusHistory: [{
      status: task.status || "todo",
      timestamp: now,
      actor: task.createdBy
    }]
  };
  await mkdir12(getTasksDir(cwd2), { recursive: true });
  await writeFile11(
    getTaskInfoPath(cwd2, task.id),
    `${JSON.stringify(newTask, null, 2)}
`,
    "utf8"
  );
  return newTask;
}

// tools/task/taskCreateTool.ts
var TaskCreateTool = {
  name: "TaskCreate",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Create a new task in the task management system";
  },
  async call(args, context, _canUseTool, _parentMessage) {
    if (!args.title?.trim()) {
      throw new Error("Task title is required");
    }
    const task = await createTask(context.cwd, {
      id: createId("task"),
      title: args.title.trim(),
      description: args.description,
      status: "todo",
      priority: args.priority || "medium",
      assignee: args.assignee || "general-purpose",
      dependsOn: args.dependsOn
    });
    return {
      data: {
        taskId: task.id,
        title: task.title,
        status: task.status
      }
    };
  },
  async validateInput(input3) {
    if (!input3?.title || typeof input3.title !== "string" || !input3.title.trim()) {
      return { result: false, message: "Task title is required" };
    }
    return { result: true };
  },
  async checkPermissions(_input, context) {
    if (context.getAppState().permissionContext.mode === "default") {
      return {
        behavior: "ask",
        message: "Create a new task?"
      };
    }
    return { behavior: "allow", updatedInput: _input };
  },
  isReadOnly() {
    return false;
  },
  isConcurrencySafe() {
    return true;
  }
};

// tools/registry.ts
function getTools() {
  return [
    ReadTool,
    WriteTool,
    EditTool,
    ShellTool,
    WebFetchTool,
    WebSearchTool,
    FileTreeTool,
    SearchFilesTool,
    AgentTool,
    TeamTool,
    SkillTool,
    ImageUploadTool,
    ImageAnalyzeTool,
    ImageGenerateTool,
    DiscoveryTool,
    GrpcClientTool,
    CheckpointTool,
    TaskCreateTool
  ];
}

// runtime/query.ts
function stringify3(data) {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}
function createAssistantMessage3(blocks) {
  return {
    id: createId("assistant"),
    type: "assistant",
    content: blocks
  };
}
function createAssistantTextMessage(text) {
  return createAssistantMessage3([
    {
      type: "text",
      text
    }
  ]);
}
function createToolResultMessage3(toolUseId, content, isError = false) {
  return {
    id: createId("tool-result"),
    type: "tool_result",
    toolUseId,
    content,
    isError
  };
}
function planPrompt(prompt) {
  const trimmed = prompt.trim();
  const readMatch = trimmed.match(/^read\s+(.+)$/i);
  if (readMatch) {
    const path = readMatch[1].trim();
    return {
      kind: "tool",
      toolName: "Read",
      input: { path },
      intro: `\u6211\u6765\u8BFB\u53D6 ${path} \u7684\u5185\u5BB9\u3002`,
      summarizeResult: () => `\u8BFB\u53D6\u5B8C\u6210\uFF1A\`${path}\``,
      summarizeError: (message) => `\u8BFB\u53D6 \`${path}\` \u5931\u8D25\uFF1A${message}`
    };
  }
  const writeMatch = trimmed.match(/^write\s+(\S+)\s+(.+)$/s);
  if (writeMatch) {
    const path = writeMatch[1].trim();
    const content = writeMatch[2].trimStart();
    return {
      kind: "tool",
      toolName: "Write",
      input: { path, content },
      intro: `\u6211\u6765\u5199\u5165 ${path}\u3002`,
      summarizeResult: () => `\u5199\u5165\u5B8C\u6210\uFF1A\`${path}\``,
      summarizeError: (message) => `\u5199\u5165 \`${path}\` \u5931\u8D25\uFF1A${message}`
    };
  }
  const editMatch = trimmed.match(/^edit\s+(\S+)\s+(.+?)\s*=>\s*(.+)$/s);
  if (editMatch) {
    const path = editMatch[1].trim();
    const oldString = editMatch[2].trim();
    const newString = editMatch[3].trim();
    return {
      kind: "tool",
      toolName: "Edit",
      input: { path, oldString, newString },
      intro: `\u6211\u6765\u7F16\u8F91 ${path} \u7684\u5185\u5BB9\u3002`,
      summarizeResult: () => `\u7F16\u8F91\u5B8C\u6210\uFF1A\`${path}\` \u5DF2\u66F4\u65B0\u3002`,
      summarizeError: (message) => `\u7F16\u8F91 \`${path}\` \u5931\u8D25\uFF1A${message}`
    };
  }
  const runMatch = trimmed.match(/^run\s+(.+)$/i);
  if (runMatch) {
    const command = runMatch[1].trim();
    return {
      kind: "tool",
      toolName: "Shell",
      input: { command },
      intro: `\u6211\u6765\u6267\u884C \`${command}\`\u3002`,
      summarizeResult: () => `\u6267\u884C\u5B8C\u6210\uFF1A\`${command}\``,
      summarizeError: (message) => `\u6267\u884C \`${command}\` \u5931\u8D25\uFF1A${message}`
    };
  }
  const fetchMatch = trimmed.match(/^fetch\s+(.+?)(?:\s+(.+))?$/i);
  if (fetchMatch) {
    const url = fetchMatch[1].trim();
    const prompt2 = fetchMatch[2]?.trim() ?? "";
    return {
      kind: "tool",
      toolName: "WebFetch",
      input: { url, prompt: prompt2 },
      intro: `\u6211\u6765\u83B7\u53D6 ${url} \u7684\u5185\u5BB9\u3002`,
      summarizeResult: () => `\u83B7\u53D6\u5B8C\u6210\uFF1A${url}`,
      summarizeError: (message) => `\u83B7\u53D6 ${url} \u5931\u8D25\uFF1A${message}`
    };
  }
  return {
    kind: "text",
    text: [
      "\u6211\u73B0\u5728\u652F\u6301\u4E00\u7EC4\u672C\u5730 agent \u52A8\u4F5C\uFF0C\u4F46\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684\u8FDC\u7A0B LLM \u914D\u7F6E\u3002",
      "\u4F60\u53EF\u4EE5\u8BBE\u7F6E\u8FD9\u4E9B\u73AF\u5883\u53D8\u91CF\u6765\u63A5\u5165\u517C\u5BB9 OpenAI Chat Completions \u7684\u6A21\u578B\uFF1A",
      "- `CCL_LLM_API_KEY`",
      "- `CCL_LLM_MODEL`",
      "- `CCL_LLM_BASE_URL` \u53EF\u9009\uFF0C\u9ED8\u8BA4 `https://api.openai.com/v1`",
      "\u5728\u672A\u914D\u7F6E LLM \u65F6\uFF0C\u4E5F\u53EF\u4EE5\u76F4\u63A5\u7ED9\u6211\u8FD9\u4E9B\u683C\u5F0F\u7684\u63D0\u793A\uFF1A",
      "- `read README.md`",
      "- `run pwd`",
      "- `fetch https://example.com`",
      "- `write notes.txt hello world`",
      "- `edit notes.txt hello => hi`",
      "\u4E5F\u53EF\u4EE5\u8F93\u5165 `/help` \u67E5\u770B TUI \u5185\u5EFA\u547D\u4EE4\u3002"
    ].join("\n")
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
      name: "WebSearch",
      description: "Search the web using DuckDuckGo and return results.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query." }
        },
        required: ["query"],
        additionalProperties: false
      }
    },
    {
      name: "FileTree",
      description: "List directory tree structure with configurable depth.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path." },
          maxDepth: { type: "number", description: "Maximum depth to traverse." }
        },
        required: ["path"],
        additionalProperties: false
      }
    },
    {
      name: "SearchFiles",
      description: "Search files by name pattern (glob) or content (regex).",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["files", "content"], description: "'files' for glob match, 'content' for regex search." },
          pattern: { type: "string", description: "Glob pattern or regex." },
          path: { type: "string", description: "Directory to search in." }
        },
        required: ["mode", "pattern"],
        additionalProperties: false
      }
    },
    {
      name: "Agent",
      description: "Launch a subagent for delegated work. The subagent runs in its own context with independent tool access. Available subagent types: 'explore' (read-only codebase search), 'plan' (research for planning), 'reflect' (self-reflection and insight extraction), 'general-purpose' (full capabilities, default). Subagents cannot launch other subagents. Launch multiple agents concurrently when possible to maximize performance.",
      parameters: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "A short (3-5 word) description of the task."
          },
          prompt: {
            type: "string",
            description: "The task for the subagent to perform. Provide a highly detailed task description. Specify exactly what information the subagent should return in its final message."
          },
          subagentType: {
            type: "string",
            description: "Optional subagent type: 'explore' (fast read-only search), 'plan' (research), 'reflect' (self-reflection), or 'general-purpose' (default)."
          }
        },
        required: ["description", "prompt"],
        additionalProperties: false
      }
    },
    {
      name: "Team",
      description: "Launch a team of specialized agents that work in parallel on a complex task. Available teams: 'code-review' (security + performance review), 'research' (codebase + documentation analysis). Team members run concurrently and results are synthesized by a lead agent.",
      parameters: {
        type: "object",
        properties: {
          teamName: {
            type: "string",
            description: "Team to launch: 'code-review' or 'research'."
          },
          task: {
            type: "string",
            description: "The task for the team to work on."
          }
        },
        required: ["teamName", "task"],
        additionalProperties: false
      }
    },
    {
      name: "Skill",
      description: "Execute a named skill within the main conversation. Use when you need to invoke a specific skill by name. Skills provide structured workflows for common tasks. Invoke a skill by its name.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Name of the skill to invoke (e.g. 'recipe-setup', 'github')."
          },
          arguments: {
            type: "string",
            description: "Optional arguments to pass to the skill."
          }
        },
        required: ["command"],
        additionalProperties: false
      }
    },
    {
      name: "ImageUpload",
      description: "Upload an image (base64) and save it locally for analysis.",
      parameters: {
        type: "object",
        properties: {
          data: { type: "string", description: "Base64-encoded image data." },
          filename: { type: "string", description: "Filename to save as." }
        },
        required: ["data", "filename"],
        additionalProperties: false
      }
    },
    {
      name: "ImageAnalyze",
      description: "Analyze an image using vision-capable LLM models. Supports OpenAI and Anthropic providers.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the image file." },
          prompt: { type: "string", description: "What to analyze in the image." }
        },
        required: ["path", "prompt"],
        additionalProperties: false
      }
    },
    {
      name: "ImageGenerate",
      description: "Generate an image using DALL-E or Stability AI.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Description of the image to generate." },
          provider: { type: "string", enum: ["openai", "stability"], description: "Image generation provider." }
        },
        required: ["prompt"],
        additionalProperties: false
      }
    }
  ];
}
async function* executeToolCall(params, toolUseMessage, toolUseBlock) {
  const tool = findToolByName(getTools(), toolUseBlock.name);
  if (!tool) {
    yield createToolResultMessage3(
      toolUseBlock.id,
      stringify3({ error: `Unknown tool ${toolUseBlock.name}` }),
      true
    );
    return;
  }
  let effectiveInput = toolUseBlock.input;
  const permission = await params.canUseTool(
    tool,
    effectiveInput,
    params.toolUseContext,
    toolUseMessage,
    toolUseBlock.id
  );
  if (permission.behavior === "deny") {
    yield createToolResultMessage3(
      toolUseBlock.id,
      stringify3({ error: permission.message }),
      true
    );
    return;
  }
  if (permission.behavior === "ask") {
    const allowed = await params.onPermissionRequest?.({
      toolName: toolUseBlock.name,
      input: effectiveInput,
      message: permission.message
    });
    if (!allowed) {
      yield createToolResultMessage3(
        toolUseBlock.id,
        stringify3({ error: `User rejected ${toolUseBlock.name}` }),
        true
      );
      return;
    }
    if (permission.updatedInput) {
      effectiveInput = permission.updatedInput;
    }
  } else if (permission.updatedInput) {
    effectiveInput = permission.updatedInput;
  }
  try {
    const result = await tool.call(
      effectiveInput,
      params.toolUseContext,
      params.canUseTool,
      toolUseMessage
    );
    yield createToolResultMessage3(toolUseBlock.id, stringify3(result.data));
    if (result.extraMessages) {
      for (const extraMessage of result.extraMessages) {
        yield extraMessage;
      }
    }
    if (result.contextModifier) {
      params.toolUseContext = result.contextModifier(params.toolUseContext);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    yield createToolResultMessage3(
      toolUseBlock.id,
      stringify3({ error: message }),
      true
    );
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
  const toolUseMessage = createAssistantMessage3([
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
    yield createAssistantTextMessage("\u5185\u90E8\u9519\u8BEF\uFF1Atool_use block \u7F3A\u5931\u3002");
    return;
  }
  let toolResultMessage = null;
  for await (const message of executeToolCall(
    params,
    toolUseMessage,
    toolUseBlock
  )) {
    toolResultMessage = message.type === "tool_result" ? message : toolResultMessage;
    yield message;
  }
  if (!toolResultMessage) {
    yield createAssistantTextMessage(
      `\u6267\u884C ${planned.toolName} \u65F6\u6CA1\u6709\u4EA7\u751F\u7ED3\u679C\u3002`
    );
    return;
  }
  if (toolResultMessage.isError) {
    const content = JSON.parse(toolResultMessage.content);
    yield createAssistantTextMessage(
      planned.summarizeError(content.error ?? "Unknown error")
    );
    return;
  }
  const result = JSON.parse(toolResultMessage.content);
  yield createAssistantTextMessage(planned.summarizeResult(result));
}
async function* queryWithLlm(params) {
  const conversation = [...params.messages];
  const maxTurns = params.maxTurns ?? 8;
  const systemPrompt = [...getDefaultSystemPrompt(), ...params.systemPrompt];
  try {
    const memory = await getMemoryForSystemPrompt(params.toolUseContext.cwd);
    if (memory.trim()) {
      systemPrompt.push(memory);
    }
  } catch {
  }
  const skillsMeta = formatSkillMetadataForPrompt(
    detectRelevantSkills(params.prompt).length > 0 ? [] : getLoadedSkills().filter((s) => !s.metadata.disableModelInvocation)
  );
  if (skillsMeta.trim()) {
    systemPrompt.push(skillsMeta);
  }
  for (let turn = 0; turn < maxTurns; turn += 1) {
    const llmResponse = await runLlmTurn({
      messages: conversation,
      systemPrompt,
      tools: getToolDefinitions(),
      onTextDelta: params.onAssistantTextDelta
    });
    if (!llmResponse.text && llmResponse.toolCalls.length === 0) {
      yield createAssistantTextMessage("\u6A21\u578B\u6CA1\u6709\u8FD4\u56DE\u4EFB\u4F55\u5185\u5BB9\u3002");
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
    const assistantMessage = createAssistantMessage3(assistantBlocks);
    conversation.push(assistantMessage);
    yield assistantMessage;
    const toolCalls = assistantBlocks.filter(
      (block) => block.type === "tool_use"
    );
    if (toolCalls.length === 0) {
      return;
    }
    for (const toolCall of toolCalls) {
      for await (const message of executeToolCall(
        params,
        assistantMessage,
        toolCall
      )) {
        conversation.push(message);
        yield message;
      }
    }
  }
  yield createAssistantTextMessage("\u8FBE\u5230\u6700\u5927\u5DE5\u5177\u8F6E\u6B21\u9650\u5236\uFF0C\u5DF2\u505C\u6B62\u7EE7\u7EED\u6267\u884C\u3002");
}
function replaceParams(input3, values) {
  if (typeof input3 === "string") {
    let result = input3;
    for (const [key, value] of Object.entries(values)) {
      const regex = new RegExp(`\\{${key}\\}`, "g");
      result = result.replace(regex, String(value));
    }
    return result;
  } else if (Array.isArray(input3)) {
    return input3.map((item) => replaceParams(item, values));
  } else if (typeof input3 === "object" && input3 !== null) {
    const result = {};
    for (const key of Object.keys(input3)) {
      result[key] = replaceParams(input3[key], values);
    }
    return result;
  }
  return input3;
}
async function* executeWorkMap(workMap, params) {
  yield createAssistantTextMessage(
    `\u{1F9ED} \u68C0\u6D4B\u5230\u6280\u80FD "${workMap.name}"\uFF0C\u6B63\u5728\u751F\u6210\u5DE5\u4F5C\u56FE...

\u5171 ${workMap.phases.length} \u4E2A\u9636\u6BB5\uFF0C${workMap.steps.length} \u4E2A\u6B65\u9AA4`
  );
  if (params.onWorkMapUpdate) {
    params.onWorkMapUpdate(workMap);
  }
  let collectedValues = {};
  if (workMap.globalParams && workMap.globalParams.length > 0) {
    if (params.onSpecRequest) {
      collectedValues = await params.onSpecRequest({
        skillId: workMap.skillName,
        params: workMap.globalParams
      });
      workMap.globalParamValues = collectedValues;
    }
  }
  let completedCount = 0;
  for (const phase of workMap.phases) {
    for (const stepId of phase.stepIds) {
      const step = workMap.steps.find((s) => s.id === stepId);
      if (!step) continue;
      step.status = "running";
      if (params.onWorkMapUpdate) {
        params.onWorkMapUpdate(workMap);
      }
      yield createAssistantTextMessage(
        `[${phase.name}] \u6267\u884C: ${step.name}`
      );
      try {
        if (step.toolName) {
          let toolInput = step.toolInputTemplate || {};
          if (Object.keys(collectedValues).length > 0) {
            toolInput = replaceParams(toolInput, collectedValues);
          }
          const toolUseBlock = {
            type: "tool_use",
            id: createId("tool-use"),
            name: step.toolName,
            input: toolInput
          };
          const toolUseMessage = createAssistantMessage3([toolUseBlock]);
          yield toolUseMessage;
          for await (const message of executeToolCall(params, toolUseMessage, toolUseBlock)) {
            yield message;
          }
        }
        step.status = "completed";
        completedCount++;
      } catch (error) {
        step.status = "failed";
        step.error = error instanceof Error ? error.message : String(error);
        yield createAssistantTextMessage(
          `\u26A0\uFE0F \u6B65\u9AA4 "${step.name}" \u6267\u884C\u5931\u8D25: ${step.error}`
        );
        if (params.onWorkMapUpdate) {
          params.onWorkMapUpdate(workMap);
        }
        break;
      }
      if (params.onWorkMapUpdate) {
        params.onWorkMapUpdate(workMap);
      }
    }
  }
  yield createAssistantTextMessage(
    `
\u{1F389} WorkMap "${workMap.name}" \u6267\u884C\u5B8C\u6210\uFF01

\u2705 \u5171\u5B8C\u6210 ${completedCount} \u4E2A\u6B65\u9AA4`
  );
}
async function* query(params) {
  const relevantSkills = detectRelevantSkills(params.prompt);
  if (relevantSkills.length > 0) {
    const skill = relevantSkills[0];
    try {
      const workMap = { steps: [] };
      if (workMap.steps.length > 0) {
        yield* executeWorkMap(workMap, params);
        return;
      }
    } catch (e) {
      console.error("[WorkMap] Parse failed, falling back", e);
    }
    let enhancedSystemPrompt = [...getDefaultSystemPrompt(), ...params.systemPrompt];
    const instruction = await loadSkillInstruction(skill);
    enhancedSystemPrompt.push(
      `

${formatSkillInstructionForPrompt(skill)}`
    );
    if (instruction.references.length > 0) {
      enhancedSystemPrompt.push(
        "\nReference files available in skill directory (use Read tool if needed): " + instruction.references.join(", ")
      );
    }
    const enhancedParams = {
      ...params,
      systemPrompt: enhancedSystemPrompt
    };
    if (!getLlmConfig()) {
      yield* queryWithPlanner(enhancedParams);
      return;
    }
    try {
      yield* queryWithLlm(enhancedParams);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      yield createAssistantTextMessage(
        `LLM \u8C03\u7528\u5931\u8D25\uFF0C\u5DF2\u56DE\u9000\u5230\u672C\u5730 planner\u3002

${message}`
      );
      yield* queryWithPlanner(enhancedParams);
    }
    return;
  }
  if (!getLlmConfig()) {
    yield* queryWithPlanner(params);
    return;
  }
  try {
    yield* queryWithLlm(params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    yield createAssistantTextMessage(
      `LLM \u8C03\u7528\u5931\u8D25\uFF0C\u5DF2\u56DE\u9000\u5230\u672C\u5730 planner\u3002

${message}`
    );
    yield* queryWithPlanner(params);
  }
}

// app/headless.ts
function parseTranscript(text) {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
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
    const marker = session.status === "error" ? "!" : "-";
    const updated = session.updatedAt || session.createdAt || "-";
    const title = session.title || session.id;
    const model = session.provider || session.model ? ` \xB7 ${session.provider || "?"}/${session.model || "?"}` : "";
    const count = session.messageCount !== void 0 ? ` \xB7 ${session.messageCount} msg` : "";
    const stats = session.toolUseCount !== void 0 || session.errorCount !== void 0 ? ` \xB7 tools:${session.toolUseCount ?? 0} \xB7 errors:${session.errorCount ?? 0}` : "";
    const status = session.status ? ` \xB7 ${session.status}` : "";
    const lastTool = session.lastTool ? `
    last tool: ${session.lastTool}` : "";
    const lastError = session.lastError ? `
    last error: ${session.lastError}` : "";
    const summary = session.summary ? `
    summary: ${session.summary}` : "";
    const prompt = session.lastPrompt ? `
    ${session.lastPrompt}` : "";
    return `${marker} ${session.id} \xB7 ${updated}${count}${stats}${model}${status}
    ${title}${summary}${prompt}${lastTool}${lastError}`;
  }).join("\n");
  const filters = [
    options?.status ? `status=${options.status}` : "",
    options?.limit !== void 0 ? `limit=${options.limit}` : ""
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
  ].join("\n");
}
function clipText(text, maxLength) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}\u2026`;
}
function formatExportMessageEntry(message) {
  if (message.type === "user") {
    const text = typeof message.content === "string" ? message.content : message.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return `user: ${clipText(text, 240)}`;
  }
  if (message.type === "tool_result") {
    const status = message.isError ? "tool_error" : "tool_result";
    return `${status}(${message.toolUseId}): ${summarizeUnknown(message.content, 400)}`;
  }
  return message.content.map(
    (block) => block.type === "text" ? `assistant: ${clipText(block.text, 400)}` : `tool_use(${block.id}): ${block.name} ${summarizeToolInput(block.input)}`
  ).join(" | ");
}
function formatInspectView(cwd2, session, messages, recentCount = 8) {
  const recentMessages = messages.slice(-recentCount);
  const errors = messages.filter(
    (message) => message.type === "tool_result" && Boolean(message.isError)
  );
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
    recentErrors.length > 0 ? recentErrors.map(
      (message, index) => `${index + 1}. ${summarizeUnknown(message.content, 200)}`
    ).join("\n") : "(none)",
    "",
    `metadata file: ${getSessionInfoFilePath(cwd2, session.id)}`,
    `transcript file: ${getTranscriptPath(cwd2, session.id)}`
  ].join("\n");
}
function formatCleanupSummary(removed, skippedCount, dryRun = false) {
  if (removed.length === 0) {
    return skippedCount > 0 ? `No sessions removed. ${skippedCount} session(s) kept.` : "No sessions removed.";
  }
  return [
    `${dryRun ? "Would remove" : "Removed"} ${removed.length} session(s):`,
    ...removed.map((session) => {
      const updated = session.updatedAt || session.createdAt || "-";
      return `- ${session.id} \xB7 ${updated} \xB7 ${session.title || session.id}`;
    }),
    skippedCount > 0 ? `Kept ${skippedCount} session(s).` : ""
  ].filter(Boolean).join("\n");
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
    ...messages.map(
      (message, index) => `${index + 1}. ${formatExportMessageEntry(message)}`
    ),
    ""
  ].join("\n");
}
function formatJsonExport(session, messages) {
  return JSON.stringify(
    {
      session,
      messages: messages.map((message) => ({
        ...message,
        ...message.type === "user" ? { content: clipText(typeof message.content === "string" ? message.content : message.content.filter((b) => b.type === "text").map((b) => b.text).join("\n"), 240) } : message.type === "tool_result" ? { content: summarizeUnknown(message.content, 400) } : {
          content: message.content.map(
            (block) => block.type === "text" ? {
              ...block,
              text: clipText(block.text, 400)
            } : block
          )
        }
      }))
    },
    null,
    2
  );
}
function formatTranscriptEntry(message) {
  if (message.type === "user") {
    return `user: ${message.content}`;
  }
  if (message.type === "tool_result") {
    const status = message.isError ? "tool_error" : "tool_result";
    return `${status}(${message.toolUseId}): ${summarizeUnknown(message.content, 240)}`;
  }
  return message.content.map(
    (block) => block.type === "text" ? `assistant: ${block.text}` : `tool_use(${block.id}): ${block.name} ${summarizeToolInput(block.input)}`
  ).join("\n");
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
      const summary = message.content.map(
        (block) => block.type === "text" ? summarizeUnknown(block.text, 120) : `${block.name} ${summarizeToolInput(block.input)}`
      ).join(" | ");
      return `${index + 1}. assistant: ${summary}`;
    }).join("\n");
  }
  return messages.map((message, index) => `${index + 1}. ${formatTranscriptEntry(message)}`).join("\n\n");
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
        output: "irg 0.1.0"
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
    "IRG CLI",
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
    "  IRG_LLM_PROVIDER   openai | anthropic, defaults to openai",
    "  IRG_LLM_API_KEY",
    "  IRG_LLM_MODEL",
    "  IRG_LLM_BASE_URL   Optional, defaults to https://api.openai.com/v1",
    "  IRG_LLM_SYSTEM_PROMPT   Optional extra system prompt",
    "  IRG_ANTHROPIC_VERSION   Optional, defaults to 2023-06-01"
  ].join("\n");
}
function summarizeUnknown(value, maxLength = 120) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "";
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}\u2026`;
}
function summarizeToolInput(input3) {
  if (typeof input3 !== "object" || input3 === null) {
    return summarizeUnknown(input3, 60);
  }
  if ("path" in input3 && typeof input3.path === "string") {
    return input3.path;
  }
  if ("command" in input3 && typeof input3.command === "string") {
    return summarizeUnknown(input3.command, 60);
  }
  if ("url" in input3 && typeof input3.url === "string") {
    return input3.url;
  }
  if ("description" in input3 && typeof input3.description === "string") {
    return summarizeUnknown(input3.description, 60);
  }
  return summarizeUnknown(input3, 60);
}
function summarizeToolResult(message) {
  if (message.type !== "tool_result") {
    return "";
  }
  return summarizeUnknown(message.content, 80);
}
async function resolveSessionIdArg(cwd2, rawSession) {
  if (!rawSession) {
    return void 0;
  }
  if (rawSession === "latest") {
    const sessions = await listSessions(cwd2);
    return sessions[0]?.id;
  }
  if (rawSession === "failed") {
    const sessions = await listSessions(cwd2);
    return sessions.find((session) => session.status === "error")?.id;
  }
  return rawSession;
}
async function resolveSessionIdForChat(cwd2, rawSession) {
  return resolveSessionIdArg(cwd2, rawSession);
}
async function parseChatCommandOptions(cwd2, args) {
  let sessionRef;
  const promptParts = [];
  for (let index = 0; index < args.length; index += 1) {
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
  const sessionId = await resolveSessionIdForChat(cwd2, sessionRef);
  if (sessionRef && !sessionId) {
    throw new Error("No resumable session found");
  }
  return {
    prompt,
    sessionId
  };
}
async function parseExportCommandOptions(cwd2, args) {
  const rawSession = args[0];
  if (!rawSession) {
    throw new Error("export-session requires a sessionId");
  }
  let format = "markdown";
  let outputPath;
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--format") {
      const value = args[index + 1];
      if (value !== "markdown" && value !== "json") {
        throw new Error(
          'export-session --format requires "markdown" or "json"'
        );
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
  const sessionId = await resolveSessionIdArg(cwd2, rawSession);
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
  if (autoApprove) return;
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
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--keep") {
      const value = Number(args[index + 1]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(
          "cleanup-sessions --keep requires a non-negative number"
        );
      }
      keep = value;
      index += 1;
      continue;
    }
    if (arg === "--older-than") {
      const value = Number(args[index + 1]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(
          "cleanup-sessions --older-than requires a non-negative number"
        );
      }
      olderThanDays = value;
      index += 1;
      continue;
    }
    if (arg === "--status") {
      const value = args[index + 1];
      if (value !== "idle" && value !== "completed" && value !== "error") {
        throw new Error(
          'cleanup-sessions --status requires "idle", "completed", or "error"'
        );
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
  if (keep === void 0 && olderThanDays === void 0) {
    throw new Error("cleanup-sessions requires --keep N or --older-than DAYS");
  }
  return { keep, olderThanDays, dryRun, status };
}
function parseSessionsCommandOptions(args) {
  let limit;
  let status;
  for (let index = 0; index < args.length; index += 1) {
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
      if (value !== "idle" && value !== "completed" && value !== "error") {
        throw new Error(
          'sessions --status requires "idle", "completed", or "error"'
        );
      }
      status = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown sessions option "${arg}"`);
  }
  return { limit, status };
}
async function deleteSessionArtifacts(cwd2, sessionId) {
  await Promise.all([
    deleteSessionInfo(cwd2, sessionId),
    deleteTranscript(cwd2, sessionId)
  ]);
}
async function confirmWithSessionRule(message, autoApprove, tool, inputValue, context) {
  if (autoApprove) return;
  if (!input.isTTY || !output.isTTY) {
    throw new Error(`${message}. Re-run with --yes to auto-approve.`);
  }
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      `${message} [y] once / [a] session / [N] `
    );
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
function createToolContext(cwd2, appStateRef, session, abortController) {
  return {
    cwd: cwd2,
    abortController: abortController ?? new AbortController(),
    messages: session.getMessages(),
    getAppState: () => appStateRef.current,
    setAppState: (updater) => {
      appStateRef.current = updater(appStateRef.current);
    }
  };
}
async function executeCliCommand(cwd2, argv, autoApprove = false, hooks) {
  const parsed = parseCommand(argv);
  if (parsed.kind === "meta") {
    return parsed;
  }
  if (parsed.kind === "utility") {
    if (parsed.utilityName === "sessions") {
      const options = parseSessionsCommandOptions(parsed.args);
      let sessions = await listSessions(cwd2);
      if (options.status) {
        sessions = sessions.filter(
          (session3) => session3.status === options.status
        );
      }
      if (options.limit !== void 0) {
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
        output: formatTranscriptMessages(
          parseTranscript(
            await readTextFile(getTranscriptPath(cwd2, sessionId))
          ),
          compact
        )
      };
    }
    if (parsed.utilityName === "inspect") {
      const sessionId = await resolveSessionIdArg(cwd2, parsed.args[0]);
      if (!sessionId) {
        throw new Error("inspect requires a sessionId");
      }
      const messages = await readTranscriptMessages(cwd2, sessionId).catch(
        () => []
      );
      const info = await readSessionInfo(cwd2, sessionId) || (await listSessions(cwd2)).find((session3) => session3.id === sessionId);
      if (!info) {
        throw new Error(`Session "${sessionId}" not found`);
      }
      return {
        kind: "utility",
        utilityName: "inspect",
        output: formatInspectView(cwd2, info, messages)
      };
    }
    if (parsed.utilityName === "export-session") {
      const options = await parseExportCommandOptions(cwd2, parsed.args);
      const messages = await readTranscriptMessages(
        cwd2,
        options.sessionId
      ).catch(() => []);
      const info = await readSessionInfo(cwd2, options.sessionId) || (await listSessions(cwd2)).find(
        (session3) => session3.id === options.sessionId
      );
      if (!info) {
        throw new Error(`Session "${options.sessionId}" not found`);
      }
      const content = options.format === "json" ? formatJsonExport(info, messages) : formatMarkdownExport(info, messages);
      if (options.outputPath) {
        await writeFile12(options.outputPath, `${content}
`, "utf8");
      }
      return {
        kind: "utility",
        utilityName: "export-session",
        output: options.outputPath ? `Exported ${options.sessionId} to ${options.outputPath}` : content
      };
    }
    if (parsed.utilityName === "rm-session") {
      const sessionId = await resolveSessionIdArg(cwd2, parsed.args[0]);
      if (!sessionId) {
        throw new Error("rm-session requires a sessionId");
      }
      await confirmOrThrow(
        `Delete session ${sessionId} and its transcript`,
        autoApprove
      );
      const info = await readSessionInfo(cwd2, sessionId) || (await listSessions(cwd2)).find((session3) => session3.id === sessionId) || { id: sessionId };
      await deleteSessionArtifacts(cwd2, sessionId);
      return {
        kind: "utility",
        utilityName: "rm-session",
        output: `Removed session ${sessionId}${info.title ? ` \xB7 ${info.title}` : ""}`
      };
    }
    if (parsed.utilityName === "cleanup-sessions") {
      const options = parseCleanupCommandOptions(parsed.args);
      const sessions = await listSessions(cwd2);
      const now = Date.now();
      const candidates = sessions.filter((session3, index) => {
        if (options.status && session3.status !== options.status) {
          return false;
        }
        const byKeep = options.keep !== void 0 ? index >= options.keep : false;
        const timestamp = session3.updatedAt || session3.createdAt;
        const ageMs = timestamp ? now - Date.parse(timestamp) : 0;
        const byAge = options.olderThanDays !== void 0 ? ageMs >= options.olderThanDays * 24 * 60 * 60 * 1e3 : false;
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
        await confirmOrThrow(
          `Remove ${candidates.length} session(s) matching cleanup rule`,
          autoApprove
        );
        for (const candidate of candidates) {
          await deleteSessionArtifacts(cwd2, candidate.id);
        }
      }
      return {
        kind: "utility",
        utilityName: "cleanup-sessions",
        output: formatCleanupSummary(
          candidates,
          Math.max(sessions.length - candidates.length, 0),
          options.dryRun
        )
      };
    }
    const chat = await parseChatCommandOptions(cwd2, parsed.args);
    const session2 = new SessionEngine({
      id: chat.sessionId ?? createId("session"),
      cwd: cwd2
    });
    if (chat.sessionId) {
      session2.hydrateMessages(
        await readTranscriptMessages(cwd2, chat.sessionId)
      );
    }
    const appStateRef2 = { current: createInitialAppState() };
    const context2 = createToolContext(
      cwd2,
      appStateRef2,
      session2,
      hooks?.abortController
    );
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
        await confirmWithSessionRule(
          request.message,
          autoApprove,
          tool2,
          request.input,
          context2
        );
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
    cwd: cwd2
  });
  const appStateRef = { current: createInitialAppState() };
  const context = createToolContext(
    cwd2,
    appStateRef,
    session,
    hooks?.abortController
  );
  const assistantMessage = buildSyntheticAssistant(toolName, toolInput);
  const toolUseId = assistantMessage.content[0].id;
  await session.recordMessages([assistantMessage]);
  const permissionDecision = await canUseTool(
    tool,
    toolInput,
    context,
    assistantMessage,
    toolUseId
  );
  if (permissionDecision.behavior === "deny") {
    throw new Error(permissionDecision.message);
  }
  if (permissionDecision.behavior === "ask") {
    await confirmWithSessionRule(
      permissionDecision.message,
      autoApprove,
      tool,
      toolInput,
      context
    );
  }
  const effectiveInput = permissionDecision.behavior === "allow" && permissionDecision.updatedInput ? permissionDecision.updatedInput : toolInput;
  const result = await tool.call(
    effectiveInput,
    context,
    canUseTool,
    assistantMessage
  );
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
  const toolSummaries = /* @__PURE__ */ new Map();
  const abortController = new AbortController();
  let interrupted = false;
  const onSigint = () => {
    interrupted = true;
    abortController.abort(new Error("User interrupted current turn"));
  };
  process.on("SIGINT", onSigint);
  try {
    const result = await executeCliCommand(
      options.cwd,
      options.args,
      options.autoApprove ?? false,
      shouldStream ? {
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
            const toolUses = message.content.filter(
              (block) => block.type === "tool_use"
            );
            if (toolUses.length > 0) {
              if (lastAssistantText) {
                output.write("\n");
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
            output.write(
              `[tool:error] ${summary} \xB7 ${summarizeToolResult(message)}
`
            );
            toolSummaries.delete(message.toolUseId);
            return;
          }
          if (message.type === "tool_result") {
            const summary = toolSummaries.get(message.toolUseId) || message.toolUseId;
            output.write(
              `[tool:done] ${summary} \xB7 ${summarizeToolResult(message)}
`
            );
            toolSummaries.delete(message.toolUseId);
            return;
          }
        }
      } : { abortController }
    );
    if (result.kind === "meta") {
      output.write(`${result.output}
`);
      return;
    }
    if (result.kind === "utility") {
      if (shouldStream && result.utilityName === "chat") {
        const transcriptPath = typeof result.output === "object" && result.output !== null && "transcriptPath" in result.output && typeof result.output.transcriptPath === "string" ? result.output.transcriptPath : void 0;
        if (lastAssistantText) {
          output.write("\n");
        }
        if (interrupted) {
          output.write("[interrupt] current turn aborted\n");
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
        output.write("\n");
      }
      output.write("[interrupt] current turn aborted\n");
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
  return `${normalized.slice(0, maxLength - 1)}\u2026`;
}
function summarizeToolInput2(input3) {
  if (typeof input3 !== "object" || input3 === null) {
    return summarizeUnknown2(input3, 60);
  }
  if ("path" in input3 && typeof input3.path === "string") {
    return input3.path;
  }
  if ("command" in input3 && typeof input3.command === "string") {
    return summarizeUnknown2(input3.command, 60);
  }
  if ("url" in input3 && typeof input3.url === "string") {
    return input3.url;
  }
  if ("description" in input3 && typeof input3.description === "string") {
    return summarizeUnknown2(input3.description, 60);
  }
  return summarizeUnknown2(input3, 60);
}
function createContext(cwd2, session, appStateRef, abortController) {
  return {
    cwd: cwd2,
    abortController,
    messages: session.getMessages(),
    getAppState: () => appStateRef.current,
    setAppState: (updater) => {
      appStateRef.current = updater(appStateRef.current);
    }
  };
}
async function resolveResumeTarget(cwd2, raw) {
  if (!raw) {
    return void 0;
  }
  if (raw === "latest") {
    const sessions = await listSessions(cwd2);
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
  stdout.write(
    [
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
    ].join("\n")
  );
  const onSigint = () => {
    if (activeAbortController) {
      interrupted = true;
      activeAbortController.abort(new Error("User interrupted current turn"));
      stdout.write("\n[interrupt] abort requested\n");
      return;
    }
    rl.close();
  };
  process.on("SIGINT", onSigint);
  try {
    for (; ; ) {
      const line = await rl.question(`cc-lite:${session.sessionId}> `);
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed === "exit" || trimmed === "quit" || trimmed === "/quit") {
        break;
      }
      if (trimmed === "/help") {
        stdout.write(
          [
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
          ].join("\n")
        );
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
        const result = await executeCliCommand(
          options.cwd,
          ["sessions"],
          options.autoApprove ?? false
        );
        stdout.write(
          `${typeof result.output === "string" ? result.output : JSON.stringify(result.output, null, 2)}
`
        );
        continue;
      }
      if (trimmed.startsWith("/resume")) {
        const [, rawTarget] = trimmed.split(/\s+/, 2);
        const target = await resolveResumeTarget(options.cwd, rawTarget);
        if (!target) {
          stdout.write("no resumable session found\n");
          continue;
        }
        appStateRef.current = createInitialAppState();
        session = new SessionEngine({
          id: target,
          cwd: options.cwd
        });
        session.hydrateMessages(
          await readTranscriptMessages(options.cwd, target)
        );
        stdout.write(`resumed ${target}
`);
        continue;
      }
      try {
        if (trimmed.startsWith("/")) {
          const result = await executeCliCommand(
            options.cwd,
            trimmed.slice(1).trim().split(/\s+/),
            options.autoApprove ?? false
          );
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
        const toolSummaries = /* @__PURE__ */ new Map();
        activeAbortController = new AbortController();
        interrupted = false;
        for await (const message of query({
          prompt: trimmed,
          messages: session.getMessages(),
          systemPrompt: [],
          toolUseContext: createContext(
            options.cwd,
            session,
            appStateRef,
            activeAbortController
          ),
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
            const answer = await rl.question(
              `${request.message} [y] once / [a] session / [N] `
            );
            const normalized = answer.trim().toLowerCase();
            if (normalized === "a" || normalized === "always") {
              rememberPermissionRule(
                createContext(
                  options.cwd,
                  session,
                  appStateRef,
                  activeAbortController ?? new AbortController()
                ),
                tool,
                request.input
              );
              return true;
            }
            return normalized === "y" || normalized === "yes";
          }
        })) {
          await session.recordMessages([message]);
          if (message.type === "assistant") {
            const toolUses = message.content.filter(
              (block) => block.type === "tool_use"
            );
            if (toolUses.length > 0) {
              if (lastAssistantText) {
                stdout.write("\n");
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
              stdout.write(
                `[tool:error] ${summary} \xB7 ${summarizeUnknown2(message.content, 80)}
`
              );
            } else {
              stdout.write(
                `[tool:done] ${summary} \xB7 ${summarizeUnknown2(message.content, 80)}
`
              );
            }
            toolSummaries.delete(message.toolUseId);
          }
        }
        if (lastAssistantText) {
          stdout.write("\n");
        }
        if (interrupted) {
          stdout.write("[interrupt] current turn aborted\n");
        }
        stdout.write(`[transcript] ${session.getTranscriptPath()}
`);
      } catch (error) {
        const interruptedNow = activeAbortController?.signal.aborted ?? false;
        const message = error instanceof Error ? error.message : String(error);
        stdout.write(
          interruptedNow ? "[interrupt] current turn aborted\n" : `${message}
`
        );
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
function tokenizeCommandLine(input3) {
  const tokens = [];
  let current = "";
  let quote = null;
  let escaped = false;
  for (const char of input3) {
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
var import_picocolors = __toESM(require_picocolors(), 1);
var import_is_dark = __toESM(require_dist(), 1);

// runtime/workmap/parser.ts
function parseSkillToWorkMap(skill) {
  const phases = [];
  const steps = [];
  const globalParams = skill.frontmatter?.params || [];
  const content = skill.content || "";
  const phaseRegex = /###\s+Phase\s+\d+:\s+(.+)/g;
  const phaseMatches = [...content.matchAll(phaseRegex)];
  if (phaseMatches.length > 0) {
    for (let i = 0; i < phaseMatches.length; i++) {
      const phaseMatch = phaseMatches[i];
      const phaseName = phaseMatch[1];
      const phaseStart = phaseMatch.index || 0;
      const nextPhaseStart = phaseMatches[i + 1]?.index || content.length;
      const phaseContent = content.substring(phaseStart, nextPhaseStart);
      const phase = parsePhase(phaseName, phaseContent, i, steps.length);
      phases.push(phase.phase);
      steps.push(...phase.steps);
    }
  } else {
    const fallbackSteps = parseFallbackSteps(content);
    steps.push(...fallbackSteps);
    phases.push({
      id: "phase-default",
      name: "\u6267\u884C\u6D41\u7A0B",
      description: "\u5B8C\u6574\u6267\u884C\u6D41\u7A0B",
      stepIds: fallbackSteps.map((s) => s.id)
    });
  }
  return {
    id: createId("workmap"),
    name: skill.frontmatter.name || skill.name,
    description: skill.frontmatter.description || "",
    skillName: skill.name,
    phases,
    steps,
    globalParams,
    globalParamValues: {},
    createdAt: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  };
}
function parsePhase(phaseName, phaseContent, phaseIndex, startStepIndex) {
  const phaseId = `phase-${phaseIndex + 1}`;
  const steps = [];
  const stepRegex = /(\d+)\.\s+([^\n]+)/g;
  const stepMatches = [...phaseContent.matchAll(stepRegex)];
  for (let i = 0; i < stepMatches.length; i++) {
    const stepMatch = stepMatches[i];
    const stepNum = parseInt(stepMatch[1]);
    const stepName = stepMatch[2].trim();
    const stepStart = stepMatch.index || 0;
    const nextStepStart = stepMatches[i + 1]?.index || phaseContent.length;
    const stepDetail = phaseContent.substring(stepStart + stepMatch[0].length, nextStepStart);
    const step = parseStep(stepName, stepDetail, startStepIndex + i, phaseId);
    steps.push(step);
  }
  return {
    phase: {
      id: phaseId,
      name: phaseName,
      description: phaseName,
      stepIds: steps.map((s) => s.id)
    },
    steps
  };
}
function parseStep(stepName, stepDetail, stepIndex, phaseId) {
  const stepId = `step-${stepIndex + 1}`;
  let toolName;
  const toolMatch1 = stepDetail.match(/使用\s+`?(\w+_tool)`?/);
  const toolMatch2 = stepDetail.match(/示例[：:]\s*`?(\w+_tool)/);
  toolName = toolMatch1 ? toolMatch1[1] : toolMatch2 ? toolMatch2[1] : void 0;
  let exampleCmd;
  const exampleMatch1 = stepDetail.match(/示例[：:]\s*`([^`]+)`/);
  const exampleMatch2 = stepDetail.match(/示例[：:]\s*([^\n]+)/);
  exampleCmd = exampleMatch1 ? exampleMatch1[1] : exampleMatch2 ? exampleMatch2[1].trim() : void 0;
  return {
    id: stepId,
    name: stepName,
    description: stepDetail.trim(),
    toolName,
    toolInputTemplate: exampleCmd ? parseExampleInput(exampleCmd) : void 0,
    phase: phaseId,
    status: "pending",
    dependencies: stepIndex > 0 ? [`step-${stepIndex}`] : void 0
  };
}
function parseExampleInput(command) {
  const parts = command.split(/\s+/);
  if (parts.length === 0) return void 0;
  const toolName = parts[0];
  const input3 = {};
  for (let i = 1; i < parts.length; i++) {
    if (parts[i].startsWith("-")) {
      const key = parts[i].substring(1);
      let value = "";
      if (i + 1 < parts.length && !parts[i + 1].startsWith("-")) {
        value = parts[i + 1];
        if (value.startsWith('"') || value.startsWith("'")) {
          const quote = value[0];
          let fullValue = value.substring(1);
          let j = i + 2;
          while (j < parts.length && !parts[j].endsWith(quote)) {
            fullValue += " " + parts[j];
            j++;
          }
          if (j < parts.length && parts[j].endsWith(quote)) {
            fullValue += " " + parts[j].substring(0, parts[j].length - 1);
            value = fullValue;
            i = j;
          } else {
            value = value.substring(1);
          }
        }
        i++;
      }
      input3[key] = value;
    }
  }
  return { command };
}
function parseFallbackSteps(content) {
  const stepRegex = /(\d+)\.\s+([^\n]+)/g;
  const stepMatches = [...content.matchAll(stepRegex)];
  return stepMatches.map((match, i) => ({
    id: `step-${i + 1}`,
    name: match[2].trim(),
    description: "",
    status: "pending"
  }));
}

// app/tui.ts
var helpMessagesAll = [
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
  "  /quit"
];
var loadedSkillsForCompletion = [];
function getPermissionMode(state, runtimeRef) {
  return runtimeRef.current.toolContext.getAppState().permissionContext.mode;
}
function wrapText(text, width) {
  const normalized = text.replace(/\r\n/g, "\n");
  const rawLines = normalized.split("\n");
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
function trimText(text, width) {
  const plain = text.replace(/\x1b\[[0-9;]*m/g, "");
  if (plain.length <= width) {
    return text + " ".repeat(Math.max(0, width - plain.length));
  }
  return `${plain.slice(0, Math.max(0, width - 1))}\u2026`;
}
function formatUnknown(value) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
function summarizeText2(text, maxLength = 48) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized || "(empty)";
  }
  return `${normalized.slice(0, maxLength - 1)}\u2026`;
}
function shouldCollapse(text) {
  return text.includes("\n") || text.length > 160;
}
function makeConversationEntries(state, message) {
  if (message.type === "user") {
    const text = typeof message.content === "string" ? message.content : message.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return [{ kind: "user", text }];
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
        collapseKey: collapsible ? state.nextCollapseKey++ : void 0,
        summary: collapsible ? summarizeText2(text) : void 0
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
function createRuntime(cwd2, appStateRef, sessionId) {
  const session = new SessionEngine({
    id: sessionId ?? createId("session"),
    cwd: cwd2
  });
  const toolContext = {
    cwd: cwd2,
    abortController: new AbortController(),
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
    at: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8),
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
    at: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8),
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
function getStepStatusIcon(status) {
  switch (status) {
    case "completed":
      return import_picocolors.default.green("\u2713");
    case "failed":
      return import_picocolors.default.red("\u2715");
    case "running":
      return import_picocolors.default.yellow("\u25B6");
    case "skipped":
      return import_picocolors.default.gray("\u2192");
    default:
      return import_picocolors.default.gray("\u25CB");
  }
}
function renderWorkMap(state, width) {
  if (!state.workMap) return [];
  const lines = [];
  const workMap = state.workMap;
  const statusText = workMap.isPaused ? " [\u23F8]" : workMap.error ? " [\u274C]" : "";
  lines.push(import_picocolors.default.bold(import_picocolors.default.cyan(`[WorkMap] ${workMap.name}${statusText}`)));
  let stepLine = "";
  for (const step of workMap.steps) {
    const icon = getStepStatusIcon(step.status);
    stepLine += `${icon} `;
  }
  if (stepLine.trim()) {
    lines.push(import_picocolors.default.gray(trimText(stepLine, width - 2)));
  }
  return lines;
}
function updateFoldState(state, target, expanded) {
  let affected = 0;
  for (const entry of state.entries) {
    if (!entry.collapsible || entry.collapseKey === void 0) {
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
  const boxWidth = Math.min(width - 6, Math.max(40, Math.floor(width * 0.7)));
  const innerWidth = boxWidth - 4;
  function stripAnsi(text) {
    return text.replace(/\x1b\[[0-9;]*m/g, "");
  }
  function padTextPlain(text, targetWidth) {
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
  const YELLOW = "\x1B[33m";
  const RESET = "\x1B[0m";
  const BOLD = "\x1B[1m";
  const CYAN = "\x1B[36m";
  const borderHorizontal = "\u2500".repeat(boxWidth - 2);
  let boxLines;
  if ("phase" in modal) {
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
        `> ${modal.currentValue}\u2588`
      ];
      boxLines = [
        `${BOLD}${YELLOW}\u250C${borderHorizontal}\u2510${RESET}`,
        `${BOLD}${YELLOW}\u2502${RESET} ${padTextPlain(modal.title, innerWidth)} ${BOLD}${YELLOW}\u2502${RESET}`,
        `${YELLOW}\u251C${borderHorizontal}\u2524${RESET}`,
        ...contentLines.map((line) => `${YELLOW}\u2502${RESET} ${padTextPlain(line, innerWidth)} ${YELLOW}\u2502${RESET}`),
        `${YELLOW}\u251C${borderHorizontal}\u2524${RESET}`,
        `${YELLOW}\u2502${RESET} ${padTextPlain("[Enter] confirm   [Esc] use defaults", innerWidth)} ${YELLOW}\u2502${RESET}`,
        `${YELLOW}\u2514${borderHorizontal}\u2518${RESET}`
      ];
    } else {
      const specLines = Object.entries(modal.collectedValues).map(
        ([key, value]) => `${key}: ${CYAN}${value}${RESET}`
      );
      const contentLines = [
        "Final Configuration:",
        "",
        ...specLines
      ];
      boxLines = [
        `${BOLD}${YELLOW}\u250C${borderHorizontal}\u2510${RESET}`,
        `${BOLD}${YELLOW}\u2502${RESET} ${padTextPlain(modal.title, innerWidth)} ${BOLD}${YELLOW}\u2502${RESET}`,
        `${YELLOW}\u251C${borderHorizontal}\u2524${RESET}`,
        ...contentLines.map((line) => `${YELLOW}\u2502${RESET} ${padTextPlain(line, innerWidth)} ${YELLOW}\u2502${RESET}`),
        `${YELLOW}\u251C${borderHorizontal}\u2524${RESET}`,
        `${YELLOW}\u2502${RESET} ${padTextPlain("[y/Enter] execute   [n/Esc] edit   [\u2191/\u2193] prev/next", innerWidth)} ${YELLOW}\u2502${RESET}`,
        `${YELLOW}\u2514${borderHorizontal}\u2518${RESET}`
      ];
    }
  } else {
    const contentLines = wrapText(modal.message, innerWidth);
    boxLines = [
      `${BOLD}${YELLOW}\u250C${borderHorizontal}\u2510${RESET}`,
      `${BOLD}${YELLOW}\u2502${RESET} ${padTextPlain(modal.title, innerWidth)} ${BOLD}${YELLOW}\u2502${RESET}`,
      `${YELLOW}\u251C${borderHorizontal}\u2524${RESET}`,
      ...contentLines.map((line) => `${YELLOW}\u2502${RESET} ${padTextPlain(line, innerWidth)} ${YELLOW}\u2502${RESET}`),
      `${YELLOW}\u251C${borderHorizontal}\u2524${RESET}`,
      `${YELLOW}\u2502${RESET} ${padTextPlain("[y] allow   [a] session   [n] cancel", innerWidth)} ${YELLOW}\u2502${RESET}`,
      `${YELLOW}\u2514${borderHorizontal}\u2518${RESET}`
    ];
  }
  const startY = Math.max(1, Math.floor((height - boxLines.length) / 2));
  const startX = Math.max(0, Math.floor((width - boxWidth) / 2));
  const next = [...lines];
  while (next.length < height) {
    next.push(" ".repeat(width));
  }
  for (let i = 0; i < boxLines.length; i += 1) {
    const targetIndex = startY + i;
    if (targetIndex >= next.length) {
      break;
    }
    const original = next[targetIndex].padEnd(width, " ");
    const overlay = boxLines[i];
    const leftMargin = " ".repeat(startX);
    const rightMargin = " ".repeat(Math.max(0, width - startX - boxWidth));
    next[targetIndex] = leftMargin + overlay + rightMargin;
  }
  return next;
}
function renderScreen(state, runtimeRef) {
  const width = Math.max(60, output2.columns ?? 80);
  const height = Math.max(20, output2.rows ?? 24);
  const mainWidth = width - 4;
  const contentHeight = Math.max(8, height - 10);
  const mode = getPermissionMode(state, runtimeRef);
  function setCenteredTerminalTitle(title, totalWidth = 10) {
    const titleLength = [...title].length;
    const spaces = Math.max(0, totalWidth - titleLength);
    const leftPad = " ".repeat(Math.min(Math.floor(spaces / 2), totalWidth > titleLength ? spaces : 0));
    process.stdout.write(`\x1B]0;${leftPad}${title}\x07`);
  }
  setCenteredTerminalTitle("\u{1F680} Siok Cli");
  const header = [
    `${import_picocolors.default.bold(import_picocolors.default.magenta(`Mode: ${mode}`) + `  \xB7  ` + import_picocolors.default.blue(`Session: ${state.currentSessionId}`))}`,
    ""
  ];
  const workMapLines = renderWorkMap(state, mainWidth);
  const messageLines = state.entries.flatMap((entry) => {
    let text = entry.text;
    if (entry.collapsible && entry.expanded === false) {
      text = `[#${entry.collapseKey}] ${entry.summary ?? "collapsed result"} (collapsed)`;
    }
    let coloredText = text;
    switch (entry.kind) {
      case "user":
        coloredText = `${state.theme === "dark" ? import_picocolors.default.bgCyan(import_picocolors.default.black("Siok")) + import_picocolors.default.cyan(` ${text}`) : import_picocolors.default.bgCyan(import_picocolors.default.white("Siok")) + import_picocolors.default.cyan(` ${text}`)}`;
        break;
      case "assistant":
        coloredText = `${state.theme === "dark" ? import_picocolors.default.bgBlack(import_picocolors.default.white("SLI")) + import_picocolors.default.black(` ${text}`) : import_picocolors.default.bgWhite(import_picocolors.default.black("SLI")) + import_picocolors.default.white(` ${text}`)}`;
        break;
      case "tool":
        coloredText = `${state.theme === "dark" ? import_picocolors.default.bgYellow(import_picocolors.default.black("Tool")) + import_picocolors.default.yellow(` ${text}`) : import_picocolors.default.bgYellow(import_picocolors.default.white("Tool")) + import_picocolors.default.yellow(` ${text}`)}`;
        break;
      case "result":
        coloredText = `${state.theme === "dark" ? import_picocolors.default.bgBlack(import_picocolors.default.white("Out")) + import_picocolors.default.black(` ${text}`) : import_picocolors.default.bgWhite(import_picocolors.default.black("Out")) + import_picocolors.default.white(` ${text}`)}`;
        break;
      case "error":
        coloredText = `${state.theme === "dark" ? import_picocolors.default.bgRed(import_picocolors.default.black("Err")) + import_picocolors.default.red(` ${text}`) : import_picocolors.default.bgRed(import_picocolors.default.white("Err")) + import_picocolors.default.red(` ${text}`)}`;
        break;
      case "system":
        coloredText = `${state.theme === "dark" ? import_picocolors.default.bgBlack(import_picocolors.default.white("Sys")) + import_picocolors.default.black(` ${text}`) : import_picocolors.default.bgWhite(import_picocolors.default.black("Sys")) + import_picocolors.default.white(` ${text}`)}`;
        break;
    }
    return wrapText(coloredText, Math.max(20, mainWidth - 4));
  });
  if (state.streamingAssistantText.trim()) {
    const streamingText = `${state.streamingAssistantText}\u258C`;
    messageLines.push(
      ...wrapText(
        `${state.theme === "dark" ? import_picocolors.default.bgBlack(import_picocolors.default.white("SLI")) + import_picocolors.default.black(` ${streamingText}`) : import_picocolors.default.bgWhite(import_picocolors.default.black("SLI")) + import_picocolors.default.white(` ${streamingText}`)}`,
        Math.max(20, mainWidth - 4)
      )
    );
  }
  const maxScroll = Math.max(0, messageLines.length - contentHeight);
  if (state.scrollOffset > maxScroll) {
    state.scrollOffset = maxScroll;
  }
  const start = Math.max(
    0,
    messageLines.length - contentHeight - state.scrollOffset
  );
  const visibleMessages = messageLines.slice(start + 2, start + contentHeight);
  let helpMessages = [];
  if (state.isSearching && state.searchMatches.length > 0) {
    for (let i = state.selectedMatchIndex - 2; i < state.selectedMatchIndex + 3; i++) {
      const actualIndex = (i % state.searchMatches.length + state.searchMatches.length) % state.searchMatches.length;
      if (actualIndex === state.selectedMatchIndex) {
        helpMessages.push(`${state.theme === "dark" ? import_picocolors.default.bgCyan(import_picocolors.default.black(state.searchMatches[actualIndex])) : import_picocolors.default.bgCyan(import_picocolors.default.white(state.searchMatches[actualIndex]))}`);
      } else
        helpMessages.push(state.searchMatches[actualIndex]);
    }
  }
  let lines = [
    ...header,
    ...workMapLines,
    // Add WorkMap visualization
    ...visibleMessages,
    "",
    `${state.theme === "dark" ? import_picocolors.default.gray("\u2500".repeat(width)) : import_picocolors.default.gray("\u2500".repeat(width))}`,
    state.status.includes("Error") || state.status.includes("failed") ? `${state.theme === "dark" ? import_picocolors.default.red(`Status: ${state.status}`) : import_picocolors.default.redBright(`Status: ${state.status}`)}` : state.busy ? `${state.theme === "dark" ? import_picocolors.default.yellow(`Status: ${state.status}`) : import_picocolors.default.yellowBright(`Status: ${state.status}`)}` : `${state.theme === "dark" ? import_picocolors.default.green(`Status: ${state.status}`) : import_picocolors.default.greenBright(`Status: ${state.status}`)}`,
    `${import_picocolors.default.gray(`Keys: Enter submit \xB7 Up/Down backtrace/forward \xB7 PgUp/PgDn page \xB7 Left/Right move cursor \xB7 Ctrl+E expand \xB7 Ctrl+G collapse \xB7 Ctrl+F filter \xB7 Esc clear \xB7 Ctrl+C quit`)}`,
    state.modal ? `${state.theme === "dark" ? import_picocolors.default.yellow(`Modal active`) : import_picocolors.default.yellowBright(`Modal active`)}` : (() => {
      const prefix = state.inputBuffer.slice(0, state.cursorPosition);
      const cursorChar = state.inputBuffer[state.cursorPosition] || " ";
      const afterCursor = state.inputBuffer.slice(state.cursorPosition + 1);
      const prompt = state.theme === "dark" ? import_picocolors.default.bgCyan(import_picocolors.default.black("Siok>")) : import_picocolors.default.bgCyan(import_picocolors.default.white("Siok>"));
      const ESC = String.fromCharCode(27);
      const cursorHighlight = state.theme === "dark" ? `${ESC}[47m${ESC}[30m${cursorChar}${ESC}[0m` : `${ESC}[40m${ESC}[37m${cursorChar}${ESC}[0m`;
      return `${prompt} ${import_picocolors.default.cyan(prefix)}${cursorHighlight}${import_picocolors.default.cyan(afterCursor)}`;
    })(),
    // 渲染搜索匹配的命令，并高亮当前选中的命令
    ...helpMessages.length > 0 ? helpMessages : ""
  ];
  if (state.modal) {
    lines = applyModalOverlay(lines, state.modal, width, height);
  }
  lines = lines.slice(0, height);
  output2.write("\x1B[2J\x1B[H");
  output2.write(lines.join("\n"));
}
async function restoreSession(cwd2, appStateRef, state, runtimeRef, sessionId) {
  const messages = await readTranscriptMessages(cwd2, sessionId);
  const runtime = createRuntime(cwd2, appStateRef, sessionId);
  runtime.session.hydrateMessages(messages);
  runtimeRef.current = runtime;
  state.entries = messages.flatMap(
    (message) => makeConversationEntries(state, message)
  );
  state.currentSessionId = sessionId;
  state.scrollOffset = 0;
  state.status = `Resumed ${sessionId}`;
  addToolStep(state, `resumed ${sessionId}`);
}
async function runSlashCommand(line, options, state, runtimeRef, appStateRef, requestPermission, requestSpec) {
  const commandLine = line.slice(1).trim();
  if (!commandLine) {
    state.entries.push({
      kind: "system",
      text: "\u53EF\u7528\u547D\u4EE4\uFF1A/help /tools /skills /sessions [--limit N] [--status idle|completed|error] /inspect <id> /export-session <id> [--format markdown|json] [--output path] /transcript <id> /rm-session <id> /cleanup-sessions --keep N [--dry-run] /expand [n|all] /collapse [n|all] /filter [all|failed|tools] /resume [id|latest|failed] /new /clear /quit"
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
        text: "\u5DF2\u521B\u5EFA\u65B0\u4F1A\u8BDD\u3002"
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
        "  /skills",
        "  /sessions [--limit N] [--status idle|completed|error]",
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
      ].join("\n")
    });
    return;
  }
  if (commandLine === "skills") {
    const skills = getLoadedSkills();
    if (skills.length === 0) {
      state.entries.push({
        kind: "system",
        text: "\u5F53\u524D\u6CA1\u6709\u52A0\u8F7D\u4EFB\u4F55\u6280\u80FD\u3002"
      });
    } else {
      const skillsText = skills.map((skill) => {
        const triggerText = skill.trigger.length > 0 ? ` (\u89E6\u53D1\u8BCD: ${skill.trigger.join(", ")})` : "";
        return `  \u2022 ${skill.name}${triggerText}`;
      }).join("\n");
      state.entries.push({
        kind: "system",
        text: `\u5DF2\u52A0\u8F7D ${skills.length} \u4E2A\u6280\u80FD:
${skillsText}`
      });
    }
    return;
  }
  if (commandLine.startsWith("workmap")) {
    const parts = commandLine.split(/\s+/);
    const subCommand = parts[1];
    const skillName = parts.slice(2).join(" ");
    if (subCommand === "load" || !state.workMap && (!subCommand || subCommand === "help")) {
      const skills = getLoadedSkills();
      if (skills.length === 0) {
        state.entries.push({ kind: "system", text: "\u6CA1\u6709\u52A0\u8F7D\u4EFB\u4F55\u6280\u80FD" });
        return;
      }
      let selectedSkill = skills[0];
      if (skillName) {
        const match = skills.find(
          (s) => s.name.toLowerCase().includes(skillName.toLowerCase()) || s.trigger.some((t) => t.toLowerCase().includes(skillName.toLowerCase()))
        );
        if (match) selectedSkill = match;
      }
      try {
        const workMap = parseSkillToWorkMap(selectedSkill);
        state.workMap = workMap;
        state.status = `WorkMap \u5DF2\u52A0\u8F7D: ${workMap.name}`;
        state.entries.push({
          kind: "system",
          text: `\u52A0\u8F7D\u5DE5\u4F5C\u56FE: ${workMap.name} (${workMap.phases.length} \u9636\u6BB5, ${workMap.steps.length} \u6B65\u9AA4)`
        });
        renderScreen(state, runtimeRef);
        for await (const message of executeWorkMap(workMap, {
          prompt: "",
          messages: runtimeRef.current.session.getMessages(),
          systemPrompt: [],
          toolUseContext: runtimeRef.current.toolContext,
          canUseTool,
          onPermissionRequest: requestPermission,
          onSpecRequest: requestSpec,
          onWorkMapUpdate: (workMapUpdate) => {
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
        state.status = `\u6267\u884C\u5931\u8D25: ${e}`;
      }
      return;
    }
    if (!state.workMap) {
      state.entries.push({
        kind: "system",
        text: "\u6CA1\u6709\u6D3B\u52A8\u7684 WorkMap\u3002\u4F7F\u7528 /workmap load [skillName] \u52A0\u8F7D\u3002"
      });
      return;
    }
    switch (subCommand) {
      case "pause":
        state.workMap.isPaused = true;
        state.status = "WorkMap \u5DF2\u6682\u505C";
        break;
      case "resume":
        state.workMap.isPaused = false;
        state.status = "WorkMap \u5DF2\u6062\u590D";
        if (state.workMapExecutor) {
          await state.workMapExecutor.handleCommand({ type: "resume" });
        }
        break;
      case "reset":
        state.workMap.steps.forEach((s) => {
          s.status = "pending";
          s.error = void 0;
          s.result = void 0;
          s.startedAt = void 0;
          s.completedAt = void 0;
        });
        state.workMap.isPaused = false;
        state.workMap.error = void 0;
        state.workMap.currentStepId = void 0;
        state.status = "WorkMap \u5DF2\u91CD\u7F6E";
        if (state.workMapExecutor) {
          await state.workMapExecutor.handleCommand({ type: "reset" });
        }
        break;
      case "clear":
      case "close":
        state.workMap = null;
        state.workMapExecutor = null;
        state.selectedWorkMapStep = null;
        state.status = "WorkMap \u5DF2\u5173\u95ED";
        break;
      default:
        state.entries.push({
          kind: "system",
          text: [
            "WorkMap \u547D\u4EE4:",
            "  /workmap load [skillName] - \u52A0\u8F7D\u6280\u80FD\u7684\u5DE5\u4F5C\u56FE",
            "  /workmap pause            - \u6682\u505C\u6267\u884C",
            "  /workmap resume           - \u6062\u590D\u6267\u884C",
            "  /workmap reset            - \u91CD\u7F6E\u6240\u6709\u6B65\u9AA4",
            "  /workmap clear            - \u5173\u95ED\u5DE5\u4F5C\u56FE"
          ].join("\n")
        });
    }
    return;
  }
  if (commandLine.startsWith("expand")) {
    const [, rawTarget] = commandLine.split(/\s+/, 2);
    const target = !rawTarget || rawTarget === "all" ? "all" : Number(rawTarget);
    const count = updateFoldState(
      state,
      target === "all" || Number.isNaN(target) ? "all" : target,
      true
    );
    state.status = `Expanded ${count} result block(s)`;
    return;
  }
  if (commandLine.startsWith("collapse")) {
    const [, rawTarget] = commandLine.split(/\s+/, 2);
    const target = !rawTarget || rawTarget === "all" ? "all" : Number(rawTarget);
    const count = updateFoldState(
      state,
      target === "all" || Number.isNaN(target) ? "all" : target,
      false
    );
    state.status = `Collapsed ${count} result block(s)`;
    return;
  }
  if (commandLine.startsWith("filter")) {
    const [, rawTarget] = commandLine.split(/\s+/, 2);
    if (rawTarget !== "all" && rawTarget !== "failed" && rawTarget !== "tools") {
      state.entries.push({
        kind: "error",
        text: "filter \u53EA\u652F\u6301 all\u3001failed\u3001tools\u3002"
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
    const target = !rawTarget || rawTarget === "latest" ? sessions[0]?.id : rawTarget === "failed" ? sessions.find((session) => session.status === "error")?.id : rawTarget;
    if (!target) {
      state.entries.push({
        kind: "error",
        text: "\u6CA1\u6709\u53EF\u6062\u590D\u7684\u4F1A\u8BDD\u3002"
      });
      return;
    }
    await restoreSession(options.cwd, appStateRef, state, runtimeRef, target);
    return;
  }
  const result = await executeCliCommand(
    options.cwd,
    tokenizeCommandLine(commandLine),
    options.autoApprove ?? false
  );
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
    text: `\u76F4\u63A5\u6267\u884C\u5DE5\u5177 ${result.tool} \u5B8C\u6210\u3002
${formatUnknown(result.output)}`
  });
  addToolStep(state, `slash tool ${result.tool}`);
}
function autoCompleteSlashCommand(input3) {
  const trimmed = input3.trim();
  const normalized = trimmed.toLowerCase();
  if (!normalized.startsWith("/")) {
    return null;
  }
  if (normalized.startsWith("/workmap")) {
    const parts = trimmed.split(/\s+/);
    const commandPart = parts[0];
    const subCommand = parts[1];
    const argPart = parts.slice(2).join(" ");
    if (!subCommand) {
      return [
        "  /workmap load [skillName]",
        "  /workmap pause",
        "  /workmap resume",
        "  /workmap reset",
        "  /workmap clear"
      ];
    }
    if (subCommand === "load") {
      const skills = loadedSkillsForCompletion;
      if (skills.length === 0) {
        return ["  /workmap load"];
      }
      const skillMatches = skills.filter((s) => {
        const searchTerm = argPart.toLowerCase();
        return s.name.toLowerCase().includes(searchTerm) || s.frontmatter.trigger?.some(
          (t) => t.toLowerCase().includes(searchTerm)
        ) || searchTerm === "";
      }).map((s) => `  /workmap load ${s.name}`);
      return skillMatches.length > 0 ? skillMatches : null;
    }
    return [
      "  /workmap load [skillName]",
      "  /workmap pause",
      "  /workmap resume",
      "  /workmap reset",
      "  /workmap clear"
    ].filter((msg) => msg.toLowerCase().includes(normalized));
  }
  const command = normalized.slice(1);
  const matches = helpMessagesAll.filter(
    (msg) => msg.toLowerCase().includes(command)
  );
  return matches.length > 0 ? matches : null;
}
async function getTerminalTheme() {
  try {
    const systemDark = await (0, import_is_dark.default)();
    if (systemDark) return "dark";
  } catch (e) {
  }
  const colorFgBg = process.env.COLORFGBG;
  if (colorFgBg) {
    const [fg, bg] = colorFgBg.split(";");
    if (bg && !isNaN(Number(bg))) {
      return Number(bg) > 7 ? "light" : "dark";
    }
  }
  const term = process.env.TERM || "";
  const termProgram = process.env.TERM_PROGRAM || "";
  if (term.includes("256color") || termProgram.includes("iTerm") || termProgram.includes("WindowsTerminal") || termProgram.includes("vscode")) {
    return "dark";
  }
  return "unknown";
}
async function startTui(options) {
  if (!input2.isTTY || !output2.isTTY) {
    throw new Error("TUI \u6A21\u5F0F\u9700\u8981\u5728\u4EA4\u4E92\u5F0F\u7EC8\u7AEF\u4E2D\u8FD0\u884C\u3002");
  }
  const appStateRef = { current: createInitialAppState() };
  const runtimeRef = { current: createRuntime(options.cwd, appStateRef) };
  const sysTheme = await getTerminalTheme();
  const state = {
    entries: [
      {
        kind: "system",
        text: "\u8F93\u5165\u81EA\u7136\u8BED\u8A00\u8BA9\u6211\u6267\u884C\u672C\u5730\u52A8\u4F5C\uFF0C\u6216\u8F93\u5165 /help \u67E5\u770B\u547D\u4EE4\u3002"
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
    timelineFilter: "all",
    isSearching: false,
    searchMatches: [],
    selectedMatchIndex: -1,
    theme: sysTheme === "dark" ? "light" : "dark",
    history: [],
    historyIndex: -1,
    workMap: null,
    workMapExecutor: null,
    selectedWorkMapStep: null,
    cursorPosition: 0
  };
  const availableSessions = await listSessions(options.cwd);
  if (availableSessions.length > 0) {
    state.entries.push({
      kind: "system",
      text: `\u53D1\u73B0\u6700\u8FD1\u4F1A\u8BDD ${availableSessions[0].id}\u3002\u8F93\u5165 /resume latest \u53EF\u6062\u590D\uFF1B\u82E5\u8981\u56DE\u5230\u5F02\u5E38\u4F1A\u8BDD\uFF0C\u4F7F\u7528 /resume failed\u3002`
    });
  }
  const skills = await loadSkills();
  loadedSkillsForCompletion = skills;
  if (skills.length > 0) {
    state.entries.push({
      kind: "system",
      text: `\u5DF2\u52A0\u8F7D ${skills.length} \u4E2A\u6280\u80FD: ${skills.map((s) => s.name).join(", ")}`
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
  const validateParamValue = (param, value) => {
    if (!value.trim()) {
      return { valid: true };
    }
    switch (param.type) {
      case "string":
        return { valid: true };
      case "number":
        const num = Number(value);
        if (isNaN(num)) {
          return { valid: false, error: "\u8BF7\u8F93\u5165\u6709\u6548\u7684\u6570\u5B57" };
        }
        return { valid: true };
      case "enum":
        if (param.options && !param.options.includes(value)) {
          return { valid: false, error: `\u8BF7\u4ECE\u4EE5\u4E0B\u9009\u9879\u4E2D\u9009\u62E9: ${param.options.join(", ")}` };
        }
        return { valid: true };
    }
    return { valid: true };
  };
  const requestSpec = async (request) => {
    state.status = `Configuring: ${request.skillId}`;
    setCurrentActivity(state, {
      phase: "approval",
      detail: "collecting parameters"
    });
    addActivityStep(
      state,
      `configure ${request.skillId}`,
      "permission",
      "info"
    );
    renderScreen(state, runtimeRef);
    return new Promise((resolve5) => {
      state.modal = {
        title: `Configure \xB7 ${request.skillId}`,
        skillId: request.skillId,
        params: request.params,
        currentParamIndex: 0,
        currentValue: String(request.params[0].default),
        collectedValues: {},
        phase: "collecting",
        resolve: (spec) => {
          state.modal = null;
          state.status = `Configured ${request.skillId}`;
          setCurrentActivity(state, {
            phase: "done",
            detail: "parameters collected",
            lastResult: "configured"
          });
          addActivityStep(
            state,
            `configured ${request.skillId}`,
            "permission",
            "done"
          );
          resolve5(spec);
        }
      };
      renderScreen(state, runtimeRef);
    });
  };
  const requestPermission = async (request) => {
    if (options.autoApprove) {
      setCurrentActivity(state, {
        phase: "approval",
        toolName: request.toolName,
        detail: "auto-approved",
        lastResult: "approved"
      });
      addActivityStep(
        state,
        `auto-approved ${request.toolName}`,
        "permission",
        "done"
      );
      return true;
    }
    state.status = `Waiting for permission: ${request.toolName}`;
    setCurrentActivity(state, {
      phase: "approval",
      toolName: request.toolName,
      detail: request.message
    });
    addActivityStep(
      state,
      `permission ${request.toolName}`,
      "permission",
      "info"
    );
    renderScreen(state, runtimeRef);
    return new Promise((resolve5) => {
      state.modal = {
        title: `Permission \xB7 ${request.toolName}`,
        message: request.message,
        toolName: request.toolName,
        inputValue: request.input,
        resolve: (decision) => {
          state.modal = null;
          const allowed = decision !== "deny";
          if (decision === "allow-session") {
            const tool = findToolByName(getTools(), request.toolName);
            if (tool) {
              rememberPermissionRule(
                runtimeRef.current.toolContext,
                tool,
                request.input
              );
            }
          }
          state.status = allowed ? `Approved ${request.toolName}` : `Rejected ${request.toolName}`;
          setCurrentActivity(state, {
            phase: allowed ? "done" : "failed",
            toolName: request.toolName,
            detail: allowed ? "permission granted" : "permission denied",
            lastResult: allowed ? "approved" : "rejected"
          });
          addActivityStep(
            state,
            `${allowed ? "approved" : "rejected"} ${request.toolName}`,
            "permission",
            allowed ? "done" : "failed"
          );
          resolve5(allowed);
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
    runtimeRef.current.toolContext.abortController = new AbortController();
    setCurrentActivity(
      state,
      trimmed.startsWith("/") ? {
        phase: "planning",
        detail: "running slash command"
      } : {
        phase: "planning",
        detail: "planning response"
      }
    );
    state.entries.push({
      kind: trimmed.startsWith("/") ? "system" : "user",
      text: trimmed
    });
    state.scrollOffset = 0;
    if (!trimmed.startsWith("/")) {
      addActivityStep(
        state,
        `prompt ${trimmed.slice(0, 32)}`,
        "prompt",
        "info"
      );
    }
    renderScreen(state, runtimeRef);
    try {
      if (trimmed.startsWith("/")) {
        await runSlashCommand(trimmed, options, state, runtimeRef, appStateRef, requestPermission, requestSpec);
        state.isSearching = false;
        state.searchMatches = [];
        state.selectedMatchIndex = -1;
        renderScreen(state, runtimeRef);
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
          onPermissionRequest: requestPermission,
          onSpecRequest: requestSpec,
          onWorkMapUpdate: (workMap) => {
            state.workMap = workMap;
            renderScreen(state, runtimeRef);
          }
        })) {
          if (message.type === "assistant" && message.content.some((block) => block.type === "text")) {
            state.streamingAssistantText = "";
          }
          await runtimeRef.current.session.recordMessages([message]);
          const wasAtBottom = state.scrollOffset === 0;
          state.entries.push(...makeConversationEntries(state, message));
          if (message.type === "assistant") {
            const toolUse = message.content.find(
              (block) => block.type === "tool_use"
            );
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
            const durationMs = state.activityStartedAt === null ? void 0 : Date.now() - state.activityStartedAt;
            setCurrentActivity(state, {
              phase: message.isError ? "failed" : "done",
              toolName: previousToolName,
              detail: message.isError ? "tool returned error" : "tool completed",
              lastResult: message.isError ? "error" : "ok"
            });
            addActivityStep(
              state,
              `${message.isError ? "error" : "done"} ${previousToolName ?? (message.toolUseId?.slice(0, 10) ?? "unknown-tool")}`,
              message.isError ? "error" : "tool",
              message.isError ? "failed" : "done",
              durationMs
            );
          }
          if (wasAtBottom) {
            state.scrollOffset = 0;
          }
          renderScreen(state, runtimeRef);
        }
      }
      state.status = `Ready \xB7 transcript: ${runtimeRef.current.session.getTranscriptPath()}`;
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
        text: interrupted ? "\u5F53\u524D turn \u5DF2\u4E2D\u65AD\u3002" : message
      });
      state.status = interrupted ? "Interrupted" : "Error";
      state.streamingAssistantText = "";
      state.isSearching = false;
      state.searchMatches = [];
      state.selectedMatchIndex = -1;
      const durationMs = state.activityStartedAt === null ? void 0 : Date.now() - state.activityStartedAt;
      setCurrentActivity(state, {
        phase: "failed",
        detail: interrupted ? "interrupted by user" : message,
        lastResult: interrupted ? "interrupted" : "error"
      });
      addActivityStep(
        state,
        interrupted ? "interrupted current turn" : `error ${message.slice(0, 24)}`,
        interrupted ? "session" : "error",
        "failed",
        durationMs
      );
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
      if ("phase" in state.modal) {
        const modal = state.modal;
        if (modal.phase === "collecting") {
          if (key.name === "return" || key.name === "enter") {
            const param = modal.params[modal.currentParamIndex];
            const validation = validateParamValue(param, modal.currentValue);
            if (!validation.valid) {
              state.status = validation.error || "Invalid value";
              renderScreen(state, runtimeRef);
              return;
            }
            const finalValue = modal.currentValue.trim() ? modal.currentValue : String(param.default);
            let typedValue = finalValue;
            if (param.type === "number") {
              typedValue = Number(finalValue);
            }
            modal.collectedValues[param.name] = typedValue;
            if (modal.currentParamIndex < modal.params.length - 1) {
              modal.currentParamIndex++;
              modal.currentValue = String(modal.params[modal.currentParamIndex].default);
            } else {
              modal.phase = "confirming";
            }
          } else if (key.name === "backspace") {
            modal.currentValue = modal.currentValue.slice(0, -1);
          } else if (key.name === "escape") {
            const defaultSpec = {};
            for (const p of modal.params) {
              defaultSpec[p.name] = p.default;
            }
            modal.resolve(defaultSpec);
          } else if (str && str.length > 0 && !key.ctrl && !key.meta) {
            modal.currentValue += str;
          }
        } else if (modal.phase === "confirming") {
          if (key.name === "y" || key.name === "return" || key.name === "enter") {
            modal.resolve(modal.collectedValues);
          } else if (key.name === "n" || key.name === "escape") {
            modal.phase = "collecting";
            modal.currentParamIndex = 0;
            modal.currentValue = String(modal.params[0].default);
            modal.collectedValues = {};
          } else if (key.name === "arrowup" || key.name === "arrowdown") {
            const direction = key.name === "arrowup" ? -1 : 1;
            modal.currentParamIndex = Math.max(0, Math.min(modal.params.length - 1, modal.currentParamIndex + direction));
            modal.currentValue = String(modal.params[modal.currentParamIndex].default);
            modal.phase = "collecting";
          }
        }
        renderScreen(state, runtimeRef);
        return;
      } else {
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
    if (str === "/" && state.busy === false) {
      state.inputBuffer += "/";
      state.isSearching = true;
      state.status = "\u6B63\u5728\u5339\u914D\u547D\u4EE4";
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
          new Error("User interrupted current turn")
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
      output2.write("\x1B[2J\x1B[H");
      renderScreen(state, runtimeRef);
      return;
    }
    if (state.busy) {
      return;
    }
    if (key.name === "return") {
      const current = state.inputBuffer;
      state.isSearching = false;
      state.searchMatches = [];
      state.selectedMatchIndex = -1;
      state.cursorPosition = 0;
      state.inputBuffer = "";
      void submitPrompt(current);
      state.history.push(current);
      state.historyIndex = state.history.length;
      return;
    }
    if (key.name === "backspace") {
      if (state.cursorPosition > 0) {
        const chars = Array.from(state.inputBuffer);
        chars.splice(state.cursorPosition - 1, 1);
        state.inputBuffer = chars.join("");
        state.cursorPosition -= 1;
      }
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
        const matches = autoCompleteSlashCommand(state.inputBuffer);
        if (matches) {
          state.searchMatches = matches;
          state.selectedMatchIndex = 0;
          state.status = `\u6B63\u5728\u5339\u914D\u547D\u4EE4`;
        } else {
          state.searchMatches = [];
          state.selectedMatchIndex = -1;
          state.status = "\u65E0\u5339\u914D\u547D\u4EE4";
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
      if (key.name === "up") {
        state.selectedMatchIndex = state.selectedMatchIndex - 1 < 0 ? state.searchMatches.length - 1 : state.selectedMatchIndex - 1;
        renderScreen(state, runtimeRef);
        return;
      }
      if (key.name === "down") {
        state.selectedMatchIndex = state.selectedMatchIndex + 1 >= state.searchMatches.length ? 0 : state.selectedMatchIndex + 1;
        renderScreen(state, runtimeRef);
        return;
      }
    } else {
      if (key.name === "up") {
        state.historyIndex = Math.max(0, state.historyIndex - 1);
        state.inputBuffer = state.history[state.historyIndex];
        renderScreen(state, runtimeRef);
        return;
      }
      if (key.name === "down") {
        state.historyIndex = state.historyIndex == state.history.length ? state.historyIndex : state.historyIndex + 1;
        state.inputBuffer = state.historyIndex < state.history.length ? state.history[state.historyIndex] : "";
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
      const selected = state.searchMatches[state.selectedMatchIndex];
      if (selected) {
        const command = selected.trim().slice(1);
        state.inputBuffer = `/${command.split(" ")[0]}`;
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
    if (state.inputBuffer.startsWith("/")) {
      state.isSearching = true;
      const matches = autoCompleteSlashCommand(state.inputBuffer);
      if (matches) {
        state.searchMatches = matches;
        state.selectedMatchIndex = 0;
        state.status = "\u6B63\u5728\u5339\u914D\u547D\u4EE4";
      } else {
        state.searchMatches = [];
        state.selectedMatchIndex = -1;
        state.status = "\u65E0\u5339\u914D\u547D\u4EE4";
      }
    } else {
      state.isSearching = false;
      state.searchMatches = [];
      state.selectedMatchIndex = -1;
      state.status = "Ready";
    }
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
    await new Promise((resolve5) => setTimeout(resolve5, 50));
  }
  cleanup();
}

// tools/hooks.ts
var registeredHooks = {};
function registerHooks(hooks) {
  registeredHooks = { ...registeredHooks, ...hooks };
}

// tools/knowledgeHook.ts
var ERROR_PATTERNS = [
  { pattern: /ENOENT.*no such file/i, insight: "File not found errors often indicate wrong path or missing file" },
  { pattern: /EACCES.*permission denied/i, insight: "Permission denied errors indicate insufficient access rights" },
  { pattern: /timeout/i, insight: "Timeout errors may indicate network issues or overloaded services" },
  { pattern: /ECONNREFUSED/i, insight: "Connection refused errors indicate service is not running or wrong address" },
  { pattern: /gRPC.*failed/i, insight: "gRPC failures should be checked for service availability and correct proto definitions" }
];
var toolErrorCounts = /* @__PURE__ */ new Map();
var toolUsageCounts = /* @__PURE__ */ new Map();
function registerKnowledgeHook(cwd2) {
  registerHooks({
    afterToolCall: async (ctx, result, error) => {
      try {
        if (error) {
          await handleError(cwd2, ctx, error);
        } else {
          await handleSuccess(cwd2, ctx);
        }
      } catch (hookError) {
        console.error("[KnowledgeHook] Error:", hookError);
      }
      return {};
    }
  });
}
async function handleError(cwd2, ctx, error) {
  const errorMessage = error.message;
  const toolKey = ctx.toolName;
  toolErrorCounts.set(toolKey, (toolErrorCounts.get(toolKey) || 0) + 1);
  for (const { pattern, insight } of ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      await addKnowledge(
        cwd2,
        "anti_pattern",
        `${ctx.toolName}: ${insight} (Error: ${errorMessage.slice(0, 100)})`,
        "user_implicit",
        [ctx.toolName.toLowerCase(), "error"],
        0.7
      );
      break;
    }
  }
  const errorCount = toolErrorCounts.get(toolKey) || 0;
  if (errorCount >= 3) {
    await addKnowledge(
      cwd2,
      "anti_pattern",
      `Tool "${ctx.toolName}" has failed ${errorCount} times in this session. Consider alternative approaches.`,
      "user_implicit",
      [ctx.toolName.toLowerCase(), "recurring-error"],
      0.8
    );
    toolErrorCounts.set(toolKey, 0);
  }
  await rebuildMemoryFromKnowledge(cwd2).catch(() => {
  });
}
async function handleSuccess(cwd2, ctx) {
  const toolKey = ctx.toolName;
  toolUsageCounts.set(toolKey, (toolUsageCounts.get(toolKey) || 0) + 1);
  const usageCount = toolUsageCounts.get(toolKey) || 0;
  if (usageCount === 15) {
    await addKnowledge(
      cwd2,
      "pattern",
      `Tool "${ctx.toolName}" used 15+ times in session - complex workflow detected`,
      "user_implicit",
      [ctx.toolName.toLowerCase(), "efficiency"],
      0.6
    );
    await rebuildMemoryFromKnowledge(cwd2).catch(() => {
    });
  }
}

// app/main.ts
async function main(argv = process.argv.slice(2)) {
  registerKnowledgeHook(cwd());
  const autoApprove = argv.includes("--yes");
  const streamOutput = argv.includes("--stream") ? true : argv.includes("--no-stream") ? false : void 0;
  const filteredArgs = argv.filter(
    (arg) => arg !== "--yes" && arg !== "--stream" && arg !== "--no-stream"
  );
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
var isDirectExecution = typeof process !== "undefined" && process.argv[1] !== void 0 && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}
`);
    process.exitCode = 1;
  });
}
export {
  main
};
