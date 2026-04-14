import type { Tools } from "./Tool";
import { AgentTool } from "./agent/agentTool";
import { EditTool } from "./files/editTool";
import { ReadTool } from "./files/readTool";
import { WriteTool } from "./files/writeTool";
import { ShellTool } from "./shell/shellTool";
import { WebFetchTool } from "./web/fetchTool";

export function getTools(): Tools {
  return [ReadTool, WriteTool, EditTool, ShellTool, WebFetchTool, AgentTool];
}
