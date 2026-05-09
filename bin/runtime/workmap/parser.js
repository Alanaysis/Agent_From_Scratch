/**
 * 从 Skill 描述解析 WorkMap
 */
import { createId } from '../../shared/ids';
/**
 * 从 Markdown skill 内容解析步骤
 */
export function parseSkillToWorkMap(skill) {
    const phases = [];
    const steps = [];
    // 先解析 frontmatter 中的 params
    const globalParams = skill.frontmatter?.params || [];
    // 解析 Markdown 内容
    const content = skill.content || '';
    // 查找阶段标题（例如：### Phase 1: 初始化）
    const phaseRegex = /###\s+Phase\s+\d+:\s+(.+)/g;
    const phaseMatches = [...content.matchAll(phaseRegex)];
    if (phaseMatches.length > 0) {
        // 按阶段解析
        for (let i = 0; i < phaseMatches.length; i++) {
            const phaseMatch = phaseMatches[i];
            const phaseName = phaseMatch[1];
            const phaseStart = phaseMatch.index || 0;
            const nextPhaseStart = phaseMatches[i + 1]?.index || content.length;
            const phaseContent = content.substring(phaseStart, nextPhaseStart);
            const phase = parsePhase(phaseName, phaseContent, i, steps.length);
            phases.push(phase.phase);
            steps.push(...phase.steps);
        }
    }
    else {
        // 如果没有明确的 Phase，尝试直接查找编号步骤
        const fallbackSteps = parseFallbackSteps(content);
        steps.push(...fallbackSteps);
        phases.push({
            id: 'phase-default',
            name: '执行流程',
            description: '完整执行流程',
            stepIds: fallbackSteps.map(s => s.id),
        });
    }
    return {
        id: createId('workmap'),
        name: skill.frontmatter.name || skill.name,
        description: skill.frontmatter.description || '',
        skillName: skill.name,
        phases,
        steps,
        globalParams,
        globalParamValues: {},
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}
function parsePhase(phaseName, phaseContent, phaseIndex, startStepIndex) {
    const phaseId = `phase-${phaseIndex + 1}`;
    const steps = [];
    // 查找该阶段内的编号步骤
    const stepRegex = /(\d+)\.\s+([^\n]+)/g;
    const stepMatches = [...phaseContent.matchAll(stepRegex)];
    for (let i = 0; i < stepMatches.length; i++) {
        const stepMatch = stepMatches[i];
        const stepNum = parseInt(stepMatch[1]);
        const stepName = stepMatch[2].trim();
        const stepStart = stepMatch.index || 0;
        const nextStepStart = stepMatches[i + 1]?.index || phaseContent.length;
        const stepDetail = phaseContent.substring(stepStart + stepMatch[0].length, nextStepStart);
        const step = parseStep(stepName, stepDetail, startStepIndex + i, phaseId);
        steps.push(step);
    }
    return {
        phase: {
            id: phaseId,
            name: phaseName,
            description: phaseName,
            stepIds: steps.map(s => s.id),
        },
        steps,
    };
}
function parseStep(stepName, stepDetail, stepIndex, phaseId) {
    const stepId = `step-${stepIndex + 1}`;
    // 尝试从详细内容中提取工具名和示例 - 多种匹配方式
    let toolName;
    // 匹配 "使用 xxx_tool"
    const toolMatch1 = stepDetail.match(/使用\s+`?(\w+_tool)`?/);
    // 匹配 "示例: xxx_tool" 或 "示例: `xxx_tool"
    const toolMatch2 = stepDetail.match(/示例[：:]\s*`?(\w+_tool)/);
    toolName = toolMatch1 ? toolMatch1[1] : (toolMatch2 ? toolMatch2[1] : undefined);
    // 查找示例命令 - 支持多种格式
    let exampleCmd;
    const exampleMatch1 = stepDetail.match(/示例[：:]\s*`([^`]+)`/);
    const exampleMatch2 = stepDetail.match(/示例[：:]\s*([^\n]+)/);
    exampleCmd = exampleMatch1 ? exampleMatch1[1] : (exampleMatch2 ? exampleMatch2[1].trim() : undefined);
    return {
        id: stepId,
        name: stepName,
        description: stepDetail.trim(),
        toolName,
        toolInputTemplate: exampleCmd ? parseExampleInput(exampleCmd) : undefined,
        phase: phaseId,
        status: 'pending',
        dependencies: stepIndex > 0 ? [`step-${stepIndex}`] : undefined,
    };
}
function parseExampleInput(command) {
    // 简单解析命令行参数
    // 例如：recipe_tool -c "name" -o down
    const parts = command.split(/\s+/);
    if (parts.length === 0)
        return undefined;
    const toolName = parts[0];
    const input = {};
    for (let i = 1; i < parts.length; i++) {
        if (parts[i].startsWith('-')) {
            const key = parts[i].substring(1);
            let value = '';
            if (i + 1 < parts.length && !parts[i + 1].startsWith('-')) {
                value = parts[i + 1];
                // 处理带引号的值
                if (value.startsWith('"') || value.startsWith("'")) {
                    const quote = value[0];
                    let fullValue = value.substring(1);
                    let j = i + 2;
                    while (j < parts.length && !parts[j].endsWith(quote)) {
                        fullValue += ' ' + parts[j];
                        j++;
                    }
                    if (j < parts.length && parts[j].endsWith(quote)) {
                        fullValue += ' ' + parts[j].substring(0, parts[j].length - 1);
                        value = fullValue;
                        i = j;
                    }
                    else {
                        value = value.substring(1);
                    }
                }
                i++;
            }
            input[key] = value;
        }
    }
    return { command };
}
function parseFallbackSteps(content) {
    // 简单版本：查找所有编号步骤
    const stepRegex = /(\d+)\.\s+([^\n]+)/g;
    const stepMatches = [...content.matchAll(stepRegex)];
    return stepMatches.map((match, i) => ({
        id: `step-${i + 1}`,
        name: match[2].trim(),
        description: '',
        status: 'pending',
    }));
}
