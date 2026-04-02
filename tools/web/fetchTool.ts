import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";

export type WebFetchInput = {
  url: string;
  prompt: string;
};

export type WebFetchOutput = {
  result: string;
};

export const WebFetchTool: Tool<WebFetchInput, WebFetchOutput> = {
  name: "WebFetch",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Fetch and process a URL";
  },
  async call(
    args: WebFetchInput,
    _context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
  ): Promise<ToolResult<WebFetchOutput>> {
    const response = await fetch(args.url);
    const content = await response.text();
    const snippet = content.slice(0, 1200);
    const result = args.prompt.trim()
      ? `Prompt: ${args.prompt}\n\nFetched snippet:\n${snippet}`
      : snippet;
    return {
      data: {
        result,
      },
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
      updatedInput: input,
    };
  },
  isReadOnly() {
    return true;
  },
  isConcurrencySafe() {
    return true;
  },
};
