import type { Message, AssistantMessage } from "../../runtime/messages";

export function compressSubagentResult(messages: Message[]): string {
  const assistantTexts: string[] = [];

  for (const msg of messages) {
    if (msg.type !== "assistant") continue;
    const aMsg = msg as AssistantMessage;
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
