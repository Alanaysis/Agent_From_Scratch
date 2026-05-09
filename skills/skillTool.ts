import type { Tool, ToolResult, ToolUseContext, ToolDescribeContext, CanUseToolFn } from "../tools/Tool";
import type { AssistantMessage } from "../runtime/messages";
import {
  findSkillByName,
  loadSkillInstruction,
  formatSkillInstructionForPrompt,
  formatSkillMetadataForPrompt,
  getLoadedSkills,
} from "../skills/loader";

export type SkillToolInput = {
  command: string;
  arguments?: string;
};

export type SkillToolOutput = {
  status: "invoked" | "not_found";
  skillName?: string;
  instruction?: string;
};

export const SkillTool: Tool<SkillToolInput, SkillToolOutput> = {
  name: "Skill",
  inputSchema: null,
  outputSchema: null,
  async description(_input: SkillToolInput, _context: ToolDescribeContext): Promise<string> {
    const skills = getLoadedSkills();
    const metaList = formatSkillMetadataForPrompt(
      skills.filter((s) => !s.metadata.disableModelInvocation),
    );
    return [
      "Execute a skill within the main conversation. Use this tool when you need to invoke a specific skill by name.",
      metaList,
    ].join('\n\n');
  },
  async call(
    args: SkillToolInput,
    context: ToolUseContext,
    canUseTool: CanUseToolFn,
    _parentMessage: AssistantMessage,
  ): Promise<ToolResult<SkillToolOutput>> {
    const skill = findSkillByName(args.command);

    if (!skill) {
      return {
        data: {
          status: "not_found",
        },
      };
    }

    const instruction = await loadSkillInstruction(skill);
    const formatted = formatSkillInstructionForPrompt(skill);

    let fullInstruction = formatted;
    if (args.arguments?.trim()) {
      fullInstruction += `\n\nUser arguments: ${args.arguments}`;
    }

    if (instruction.references.length > 0) {
      fullInstruction += "\n\nAvailable reference files (read them if needed):";
      for (const ref of instruction.references) {
        fullInstruction += `\n- ${ref}`;
      }
    }

    return {
      data: {
        status: "invoked",
        skillName: skill.name,
        instruction: fullInstruction,
      },
      contextModifier: (ctx: ToolUseContext) => {
        return {
          ...ctx,
          agentType: skill.metadata.agent || ctx.agentType,
        };
      },
    };
  },
  async validateInput(input: SkillToolInput) {
    if (!input.command?.trim()) {
      return { result: false, message: "Skill command name is required" };
    }
    return { result: true };
  },
  async checkPermissions(_input: SkillToolInput, _context: ToolUseContext) {
    return { behavior: "allow" as const };
  },
  isReadOnly() {
    return true;
  },
  isConcurrencySafe() {
    return true;
  },
};
