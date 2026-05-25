import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";
import { createReadStream } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

// DuckDuckGo Instant Answer API (free, no key needed)
async function duckduckgoSearch(query: string, maxResults: number = 10): Promise<Array<{
  title: string;
  url: string;
  snippet: string;
}>> {
  // Use the HTML search endpoint with a simple fetch
  const encodedQuery = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AgentFromScratch/1.0)",
      "Accept": "text/html",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed: ${response.status}`);
  }

  const html = await response.text();

  // Parse results from HTML
  const results: Array<{ title: string; url: string; snippet: string }> = [];

  // Extract result blocks - DuckDuckGo uses <a class="result__a" href="..."> and <a class="result__snippet" href="...">
  const titleRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  const snippetRegex = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]+href="[^"]+"[^>]*>([^<]+)<\/a>/g;

  let titleMatch;
  while ((titleMatch = titleRegex.exec(html)) !== null && results.length < maxResults) {
    const href = titleMatch[1].replace(/^https?:\/\/duckduckgo\.com\/l\/\?u=(.+)$/, (_, u) => {
      try {
        return decodeURIComponent(u);
      } catch {
        return titleMatch[1];
      }
    });
    results.push({
      title: titleMatch[2].trim(),
      url: href,
      snippet: "",
    });
  }

  // Extract snippets
  let snippetMatch;
  while ((snippetMatch = snippetRegex.exec(html)) !== null && results.length < maxResults) {
    if (results.length > 0 && results[results.length - 1].snippet === "") {
      results[results.length - 1].snippet = snippetMatch[1].trim();
    } else {
      results.push({
        title: "",
        url: "",
        snippet: snippetMatch[1].trim(),
      });
    }
  }

  // If we got URLs but no snippets, add a note
  if (results.length > 0 && results[0].snippet === "") {
    for (const r of results) {
      if (!r.snippet) {
        r.snippet = "Click the link for more details.";
      }
    }
  }

  return results.slice(0, maxResults);
}

// Alternative: use html.duckduckgo.com's JavaScript-less API
async function duckduckgoInstantAnswer(query: string): Promise<Array<{
  text: string;
  url: string;
  icon: string;
}>> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const data = await response.json();

    const results: Array<{ text: string; url: string; icon: string }> = [];

    // Related topics
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics) {
        if (topic.Text && topic.URL) {
          results.push({
            text: topic.Text,
            url: topic.URL,
            icon: topic.Icon?.URL || "",
          });
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

export type WebSearchInput = {
  query: string;
  maxResults?: number;
};

export type WebSearchOutput = {
  results: WebSearchResult[];
  totalResults: number;
  truncated: boolean;
};

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export const WebSearchTool: Tool<WebSearchInput, WebSearchOutput> = {
  name: "WebSearch",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Search the web using DuckDuckGo. Returns titles, URLs, and snippets. Useful for finding information, documentation, and current events.";
  },
  async call(
    args: WebSearchInput,
    context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
  ): Promise<ToolResult<WebSearchOutput>> {
    const maxResults = args.maxResults ?? 10;

    // Try instant answer first, then fall back to HTML search
    let results: WebSearchResult[] = [];

    // Method 1: DuckDuckGo Instant Answer API
    const instantResults = await duckduckgoInstantAnswer(args.query);
    if (instantResults.length > 0) {
      results = instantResults.map((r) => ({
        title: r.text.split("\n")[0],
        url: r.url,
        snippet: r.text.split("\n").slice(1).join("\n").trim(),
      }));
    }

    // Method 2: HTML search (fallback/enrichment)
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
        truncated,
      },
    };
  },
  async validateInput(input) {
    if (!input.query || typeof input.query !== "string" || !input.query.trim()) {
      return { result: false, message: "Query is required" };
    }
    if (input.maxResults !== undefined && (input.maxResults < 1 || !Number.isInteger(input.maxResults))) {
      return { result: false, message: "maxResults must be a positive integer" };
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
