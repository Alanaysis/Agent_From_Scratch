import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";
import { readdir, readFile, stat } from "fs/promises";
import { join, relative } from "path";
import { getLlmConfigFromEnv } from "../../runtime/llm";

export type ImageAnalyzeInput = {
  imagePath?: string;
  imageId?: string;
  prompt?: string;
};

export type ImageAnalyzeOutput = {
  analysis: string;
  imageUrl: string;
  provider: string;
  model: string;
};

async function analyzeWithAnthropic(
  imageData: string,
  mimeType: string,
  prompt: string,
  config: any,
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": config.anthropicVersion || "2023-06-01",
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
                data: imageData,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const payload: any = await response.json();
    throw new Error(payload.error?.message || `Anthropic API error: ${response.status}`);
  }

  // Read the response (non-streaming for simplicity)
  const data: any = await response.json();
  return data.content?.[0]?.text || "No analysis returned.";
}

async function analyzeWithOpenAI(
  imageData: string,
  mimeType: string,
  prompt: string,
  config: ReturnType<typeof getLlmConfigFromEnv>,
): Promise<string> {
  // Convert base64 to data URL
  const dataUrl = `data:${mimeType};base64,${imageData}`;

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: prompt || "Describe this image in detail.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt || "Describe this image in detail." },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "No analysis returned.";
}

export const ImageAnalyzeTool: Tool<ImageAnalyzeInput, ImageAnalyzeOutput> = {
  name: "ImageAnalyze",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Analyze an image using LLM vision capabilities. Upload an image first with ImageUpload, then analyze it.";
  },
  async call(
    args: ImageAnalyzeInput,
    context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
  ): Promise<ToolResult<ImageAnalyzeOutput>> {
    const llmConfig = getLlmConfigFromEnv();
    if (!llmConfig) {
      return {
        data: {
          analysis: "Cannot analyze image: no LLM configured. Set CCL_LLM_API_KEY and CCL_LLM_MODEL.",
          imageUrl: "",
          provider: "none",
          model: "none",
        },
      };
    }

    let imageData: string;
    let mimeType: string;
    let imageUrl: string;

    if (args.imagePath) {
      const filePath = args.imagePath.startsWith("/")
        ? args.imagePath
        : join(context.cwd, args.imagePath);
      const fileStat = await stat(filePath).catch(() => null);
      if (!fileStat) {
        return {
          data: {
            analysis: `Image not found: ${args.imagePath}`,
            imageUrl: "",
            provider: "none",
            model: "none",
          },
        };
      }
      const buffer = await readFile(filePath);
      imageData = buffer.toString("base64");
      mimeType = fileStat.mode & 0o77777 ? "image/png" : "image/png";
      imageUrl = filePath;
    } else if (args.imageId) {
      const imageDir = join(context.cwd, ".claude-code-lite", "images");
      const files = await readdir(imageDir).catch(() => []);
      const matchingFile = files.find((f) => f.startsWith(args.imageId!));
      if (!matchingFile) {
        return {
          data: {
            analysis: `Image not found: ${args.imageId}`,
            imageUrl: "",
            provider: "none",
            model: "none",
          },
        };
      }
      const filePath = join(imageDir, matchingFile);
      const buffer = await readFile(filePath);
      imageData = buffer.toString("base64");
      mimeType = matchingFile.endsWith(".jpg") || matchingFile.endsWith(".jpeg") ? "image/jpeg" : "image/png";
      imageUrl = filePath;
    } else {
      return {
        data: {
          analysis: "Provide imagePath or imageId to analyze.",
          imageUrl: "",
          provider: "none",
          model: "none",
        },
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
        model: llmConfig.model,
      },
    };
  },
  async validateInput(input) {
    if (input.imagePath !== undefined && typeof input.imagePath !== "string") {
      return { result: false, message: "imagePath must be a string" };
    }
    if (input.imageId !== undefined && typeof input.imageId !== "string") {
      return { result: false, message: "imageId must be a string" };
    }
    if (input.prompt !== undefined && typeof input.prompt !== "string") {
      return { result: false, message: "prompt must be a string" };
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
