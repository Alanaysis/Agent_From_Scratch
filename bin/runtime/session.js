import { appendTranscript, getTranscriptPath } from "../storage/transcript";
import { updateSessionInfo } from "../storage/sessionIndex";
import { emptyUsage } from "./usage";
import { addKnowledge } from "../storage/knowledge";
import { rebuildMemoryFromKnowledge } from "../storage/memory";
function extractKnowledgeFromMessages(messages) {
    const insights = [];
    let errorCount = 0;
    let toolUseCount = 0;
    const toolsUsed = new Set();
    const errorTools = new Set();
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
                tags: ["error", tool, "anti-pattern"],
            });
        }
    }
    if (toolUseCount > 15) {
        insights.push({
            category: "pattern",
            content: `High tool usage (${toolUseCount} calls) suggests complex task. Consider using sub-agents or teams for similar tasks to reduce context pollution.`,
            tags: ["efficiency", "tool-usage"],
        });
    }
    const userMessages = messages.filter((m) => m.type === "user");
    if (userMessages.length > 3) {
        const userContents = userMessages.map((m) => m.type === "user" ? m.content : "");
        const hasCorrection = userContents.some((c, i) => {
            if (i === 0)
                return false;
            const lower = c.toLowerCase();
            return (lower.includes("no,") ||
                lower.includes("not like that") ||
                lower.includes("wrong") ||
                lower.includes("try again") ||
                lower.includes("different"));
        });
        if (hasCorrection) {
            insights.push({
                category: "anti_pattern",
                content: "User had to correct the assistant multiple times. Initial approach may not match user expectations. Ask clarifying questions earlier.",
                tags: ["user-correction", "communication"],
            });
        }
    }
    return insights;
}
export class SessionEngine {
    config;
    messages = [];
    usage = emptyUsage();
    knowledgeExtracted = false;
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
        if (this.config.autoExtractKnowledge && !this.knowledgeExtracted) {
            const hasAssistantText = messages.some((m) => m.type === "assistant" && m.content.some((b) => b.type === "text" && b.text.trim().length > 0));
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
    async extractAndPersistKnowledge() {
        const insights = extractKnowledgeFromMessages(this.messages);
        let added = 0;
        for (const insight of insights) {
            const entry = await addKnowledge(this.cwd, insight.category, insight.content, "user_implicit", insight.tags);
            if (entry)
                added += 1;
        }
        if (added > 0) {
            await rebuildMemoryFromKnowledge(this.cwd);
        }
        return added;
    }
}
