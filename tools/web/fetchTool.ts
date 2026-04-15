import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";
import { firefox } from 'playwright';

// 清洗 HTML，提取主要内容
function cleanHtml(html: string): string {
  // 移除不需要的元素
  const tagsToRemove = [
    'script', 'style', 'noscript', 'iframe', 'object', 'embed', 
    'svg', 'math', 'nav', 'footer', 'header', 'aside'
  ];
  
  let cleaned = html;
  
  // 移除这些标签及其内容
  for (const tag of tagsToRemove) {
    const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gis');
    cleaned = cleaned.replace(regex, '');
  }
  
  // 提取主要内容区域（article, main, content 等）
  const contentSelectors = ['article', 'main', '.content', '#content', '.post'];
  for (const selector of contentSelectors) {
    try {
      const regex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)</${selector}>`, 'gis');
      const match = cleaned.match(regex);
      if (match && match[1].length > cleaned.length * 0.3) {
        cleaned = match[1];
        break;
      }
    } catch {}
  }
  
  // 移除所有标签，只保留文本内容
  const textOnly = cleaned.replace(/<[^>]*>/g, '');
  
  // 清理多余空白和换行
  const normalized = textOnly
    .replace(/\s+/g, ' ')
    .trim();
  
  return normalized;
}

async function web_fetch(url: string) {
  let browser;
  try {
    browser = await firefox.launch({ headless: true });
    const page = await browser.newPage();

    // 设置超时
    page.setDefaultTimeout(30000);

    console.log(`[WebFetch] Fetching URL: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');

    // 自动滚动加载懒加载内容
    await page.evaluate(`
      window.scrollTo(0, document.body.scrollHeight);
    `);

    const html = await page.content();
    
    console.log(`[WebFetch] Successfully fetched ${html.length} bytes from ${url}`);
    
    return html;
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    throw new Error(`WebFetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function cleanAndExtract(html: string, maxLen: number = 50000): Promise<string> {
  const cleaned = cleanHtml(html);
  
  // 如果清洗后的内容仍然太长，进行截断
  if (cleaned.length > maxLen) {
    return cleaned.substring(0, maxLen) + '\n\n... [truncated] ...';
  }
  
  return cleaned;
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
    try {
      const html = await web_fetch(args.url);
      
      // 清洗 HTML 并提取主要内容
      const cleanedContent = await cleanAndExtract(html);
      
      console.log(`[WebFetch] Cleaned content: ${cleanedContent.length} characters`);
      
      const result = args.prompt.trim()
        ? `Prompt: ${args.prompt}\n\nFetched and cleaned content:\n${cleanedContent}`
        : cleanedContent;
        
      return {
        data: {
          result,
        },
      };
    } catch (error) {
      // 返回错误结果而不是抛出异常，这样可以让调用者知道发生了什么
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[WebFetch] Call failed for ${args.url}: ${errorMsg}`);
      
      return {
        data: {
          result: `Error fetching URL:\n${errorMsg}`,
        },
      };
    }
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
