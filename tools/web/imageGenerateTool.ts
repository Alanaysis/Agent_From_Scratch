import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

export type ImageGenerateInput = {
  prompt: string;
  size?: "256x256" | "512x512" | "1024x1024" | "1024x1792" | "1792x1024";
  model?: "dall-e-3" | "dall-e-2";
  quality?: "standard" | "hd";
  n?: number;
};

export type ImageGenerateOutput = {
  images: Array<{
    url?: string;
    path?: string;
    b64_json?: string;
  }>;
  model: string;
  size: string;
};

async function generateWithOpenAI(
  prompt: string,
  size: string,
  model: string,
  quality: string,
  apiKey: string,
  n: number,
): Promise<Array<{ url?: string; b64_json?: string }>> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      quality,
      n,
    }),
  });

  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.error?.message || `OpenAI DALL-E error: ${response.status}`);
  }

  const data = await response.json();
  return data.data || [];
}

async function generateWithStabilityAI(
  prompt: string,
  size: string,
  apiKey: string,
): Promise<Array<{ b64_json: string }>> {
  const [width, height] = size.split("x").map(Number);

  const response = await fetch("https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Accept": "application/json",
    },
    body: JSON.stringify({
      text_prompts: [{ text: prompt, weight: 1 }],
      cfg_scale: 7,
      width,
      height,
      steps: 30,
      samples: 1,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stability AI error: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return (data.artifacts || []).map((art: any) => ({ b64_json: art.base64 }));
}

export const ImageGenerateTool: Tool<ImageGenerateInput, ImageGenerateOutput> = {
  name: "ImageGenerate",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Generate images using AI. Supports OpenAI DALL-E and Stability AI. Set IMAGE_GENERATION_PROVIDER (openai or stability) and the corresponding API key.";
  },
  async call(
    args: ImageGenerateInput,
    context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
  ): Promise<ToolResult<ImageGenerateOutput>> {
    const provider = process.env.IMAGE_GENERATION_PROVIDER || "openai";
    const apiKey =
      provider === "openai"
        ? process.env.IMAGE_GENERATION_API_KEY || process.env.OPENAI_API_KEY
        : process.env.STABILITY_AI_KEY || process.env.IMAGE_GENERATION_API_KEY;

    if (!apiKey) {
      return {
        data: {
          images: [],
          model: "none",
          size: "1024x1024",
        },
      };
    }

    const size = args.size || "1024x1024";
    const model = args.model || "dall-e-3";
    const quality = args.quality || "standard";
    const n = args.n || 1;

    const imageDir = join(context.cwd, ".claude-code-lite", "images");
    await mkdir(imageDir, { recursive: true });

    let images: Array<{ url?: string; b64_json?: string }> = [];

    if (provider === "openai") {
      images = await generateWithOpenAI(
        args.prompt,
        size,
        model,
        quality,
        apiKey,
        n,
      );
    } else {
      images = await generateWithStabilityAI(args.prompt, size, apiKey);
    }

    // Save generated images
    const savedImages = await Promise.all(
      images.map(async (img, i) => {
        if (img.b64_json) {
          const timestamp = Date.now();
          const filename = `generated_${timestamp}_${i}.png`;
          const filePath = join(imageDir, filename);
          const buffer = Buffer.from(img.b64_json, "base64");
          await writeFile(filePath, buffer);
          return { path: filePath, b64_json: img.b64_json };
        }
        return { url: img.url };
      }),
    );

    return {
      data: {
        images: savedImages,
        model: provider === "openai" ? model : "stable-diffusion-xl",
        size,
      },
    };
  },
  async validateInput(input) {
    if (!input.prompt || typeof input.prompt !== "string" || !input.prompt.trim()) {
      return { result: false, message: "Prompt is required" };
    }
    if (input.size !== undefined && !/^\d+x\d+$/.test(input.size)) {
      return { result: false, message: "size must be in format WxH (e.g., 1024x1024)" };
    }
    if (input.model !== undefined && !["dall-e-3", "dall-e-2"].includes(input.model)) {
      return { result: false, message: "model must be 'dall-e-3' or 'dall-e-2'" };
    }
    if (input.quality !== undefined && !["standard", "hd"].includes(input.quality)) {
      return { result: false, message: "quality must be 'standard' or 'hd'" };
    }
    if (input.n !== undefined && (input.n < 1 || input.n > 10)) {
      return { result: false, message: "n must be between 1 and 10" };
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
    return false;
  },
  isConcurrencySafe() {
    return true;
  },
};
