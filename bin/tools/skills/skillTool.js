import { loadSkills, getLoadedSkills } from "../../skills/loader";
// 技能描述
async function describeSkill(input, context) {
    if (input.action === 'list') {
        return "列出所有可用的技能";
    }
    else if (input.action === 'use') {
        return `使用技能: ${input.skillName}`;
    }
    return "技能工具 - 用于访问和使用预定义的技能";
}
// 技能工具实现
export const SkillTool = {
    name: "skill",
    inputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["list", "use"],
                description: "操作类型：list列出技能，use使用技能"
            },
            skillName: {
                type: "string",
                description: "要使用的技能名称"
            },
            prompt: {
                type: "string",
                description: "用户的原始输入，用于触发技能识别"
            }
        },
        required: ["action"]
    },
    description: describeSkill,
    async call(input, context) {
        // 确保技能已加载
        let skills = getLoadedSkills();
        if (skills.length === 0) {
            await loadSkills();
            skills = getLoadedSkills();
        }
        if (input.action === 'list') {
            // 列出所有可用技能
            return {
                data: {
                    message: `找到 ${skills.length} 个可用技能`,
                    skills: skills
                }
            };
        }
        else if (input.action === 'use') {
            if (!input.skillName) {
                return {
                    data: {
                        message: "必须指定要使用的技能名称"
                    }
                };
            }
            // 查找指定的技能
            const skill = skills.find(s => s.name.toLowerCase() === input.skillName?.toLowerCase());
            if (!skill) {
                return {
                    data: {
                        message: `未找到名为 "${input.skillName}" 的技能`
                    }
                };
            }
            return {
                data: {
                    message: `已激活技能: ${skill.name}`,
                    skillContent: skill.content
                }
            };
        }
        return {
            data: {
                message: "无效的操作类型"
            }
        };
    },
    isReadOnly(input) {
        return true;
    },
    isConcurrencySafe(input) {
        return true;
    },
    validateInput(input) {
        if (input.action !== 'list' && input.action !== 'use') {
            return Promise.resolve({
                result: false,
                message: "action必须是'list'或'use'"
            });
        }
        if (input.action === 'use' && !input.skillName) {
            return Promise.resolve({
                result: false,
                message: "use操作必须指定skillName"
            });
        }
        return Promise.resolve({ result: true });
    }
};
