import { findSkillByName, loadSkillInstruction, formatSkillInstructionForPrompt, formatSkillMetadataForPrompt, getLoadedSkills, } from "../skills/loader";
export const SkillTool = {
    name: "Skill",
    inputSchema: null,
    outputSchema: null,
    async description(_input, _context) {
        const skills = getLoadedSkills();
        const metaList = formatSkillMetadataForPrompt(skills.filter((s) => !s.metadata.disableModelInvocation));
        return [
            "Execute a skill within the main conversation. Use this tool when you need to invoke a specific skill by name.",
            metaList,
        ].join('\n\n');
    },
    async call(args, context, canUseTool, _parentMessage) {
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
            contextModifier: (ctx) => {
                return {
                    ...ctx,
                    agentType: skill.metadata.agent || ctx.agentType,
                };
            },
        };
    },
    async validateInput(input) {
        if (!input.command?.trim()) {
            return { result: false, message: "Skill command name is required" };
        }
        return { result: true };
    },
    async checkPermissions(_input, _context) {
        return { behavior: "allow" };
    },
    isReadOnly() {
        return true;
    },
    isConcurrencySafe() {
        return true;
    },
};
