export type RunAgentParams = {
  description: string;
  prompt: string;
  subagentType?: string;
};

export async function runAgent(params: RunAgentParams): Promise<string> {
  const subagentType = params.subagentType ?? "general-purpose";
  return [
    `Subagent "${subagentType}" accepted the task.`,
    `Description: ${params.description}`,
    `Prompt length: ${params.prompt.length} characters`,
    "This educational runtime does not call a model yet; it only exercises the delegation path.",
  ].join("\n");
}
