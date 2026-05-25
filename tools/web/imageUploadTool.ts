import type { Tool, ToolResult, ToolUseContext, CanUseToolFn } from "../Tool";
import type { AssistantMessage } from "../../runtime/messages";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

export type ImageUploadInput = {
  data: string;
  mimeType?: string;
  description?: string;
};

export type ImageUploadOutput = {
  path: string;
  mimeType: string;
  size: number;
  description: string;
};

export const ImageUploadTool: Tool<ImageUploadInput, ImageUploadOutput> = {
  name: "ImageUpload",
  inputSchema: null,
  outputSchema: null,
  async description() {
    return "Upload an image (base64) for storage and later analysis. Supports common image formats (PNG, JPG, GIF, WebP).";
  },
  async call(
    args: ImageUploadInput,
    context: ToolUseContext,
    _canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
  ): Promise<ToolResult<ImageUploadOutput>> {
    const imageData = args.data;
    const mimeType = args.mimeType || "image/png";
    const description = args.description || "Uploaded image";

    // Determine extension from mime type
    let ext = "png";
    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = "jpg";
    else if (mimeType.includes("gif")) ext = "gif";
    else if (mimeType.includes("webp")) ext = "webp";
    else if (mimeType.includes("png")) ext = "png";

    // Generate filename
    const timestamp = Date.now();
    const filename = `image_${timestamp}.${ext}`;
    const imageDir = join(context.cwd, ".claude-code-lite", "images");

    await mkdir(imageDir, { recursive: true });
    const filePath = join(imageDir, filename);

    // Decode base64 and write file
    const buffer = Buffer.from(imageData, "base64");
    await writeFile(filePath, buffer);

    return {
      data: {
        path: filePath,
        mimeType,
        size: buffer.length,
        description,
      },
    };
  },
  async validateInput(input) {
    if (!input.data || typeof input.data !== "string") {
      return { result: false, message: "Image data (base64) is required" };
    }
    if (input.mimeType !== undefined && typeof input.mimeType !== "string") {
      return { result: false, message: "mimeType must be a string" };
    }
    if (input.description !== undefined && typeof input.description !== "string") {
      return { result: false, message: "description must be a string" };
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
