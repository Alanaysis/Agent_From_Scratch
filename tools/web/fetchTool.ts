import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";
import { firefox } from 'playwright';

async function web_fetch(url: string) {
  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForLoadState('domcontentloaded');

  // 自动滚动加载懒加载内容
  await page.evaluate(`
    window.scrollTo(0, document.body.scrollHeight);
  `);

  const html = await page.content();
  await browser.close();

  return html;
}

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
    const content = await web_fetch(args.url);
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
