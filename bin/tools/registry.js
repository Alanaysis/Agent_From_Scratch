import { AgentTool } from "./agent/agentTool";
import { TeamTool } from "./agent/teamTool";
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
import { SkillTool } from "../skills/skillTool";
import { DiscoveryTool } from "../discovery/DiscoveryTool";
import { GrpcClientTool } from "./grpc/grpcClientTool";
import { CheckpointTool } from "./workflow/checkpointTool";
import { TaskCreateTool } from "./task/taskCreateTool";
export function getTools() {
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
        TeamTool,
        SkillTool,
        ImageUploadTool,
        ImageAnalyzeTool,
        ImageGenerateTool,
        DiscoveryTool,
        GrpcClientTool,
        CheckpointTool,
        TaskCreateTool,
    ];
}
