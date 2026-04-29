import type { Tools } from "./Tool";
import { AgentTool } from "./agent/agentTool";
import { EditTool } from "./files/editTool";
import { ReadTool } from "./files/readTool";
import { WriteTool } from "./files/writeTool";
import { ShellTool } from "./shell/shellTool";
import { WebFetchTool } from "./web/fetchTool";
import { FileTreeTool } from "./files/fileTreeTool";
import { SearchFilesTool } from "./files/searchFilesTool";
import { WebSearchTool } from "./web/webSearchTool";
import { ImageUploadTool } from "./web/imageUploadTool";
import { ImageAnalyzeTool } from "./web/imageAnalyzeTool";
import { ImageGenerateTool } from "./web/imageGenerateTool";

export function getTools(): Tools {
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
    ImageUploadTool,
    ImageAnalyzeTool,
    ImageGenerateTool,
  ];
}
