/**
 * WorkMap 执行引擎
 * 支持灵活的工作图执行、暂停、回退
 */
import { EventEmitter } from 'events';
import { getTools } from '../../tools/registry';
import { findToolByName } from '../../tools/Tool';
import { createId } from '../../shared/ids';
export class WorkMapExecutor extends EventEmitter {
    workMap;
    params;
    isRunning = false;
    shouldPause = false;
    constructor(workMap, params) {
        super();
        this.workMap = workMap;
        this.params = params;
    }
    getWorkMap() {
        return { ...this.workMap };
    }
    /**
     * 执行 WorkMap
     */
    async execute() {
        if (this.isRunning) {
            throw new Error('WorkMap is already running');
        }
        this.isRunning = true;
        this.shouldPause = false;
        try {
            // 先收集全局参数
            if (this.workMap.globalParams && this.workMap.globalParams.length > 0) {
                await this.collectGlobalParams();
            }
            // 按阶段执行
            for (const phase of this.workMap.phases) {
                if (this.shouldPause)
                    break;
                await this.executePhase(phase);
            }
            if (!this.shouldPause) {
                this.emit('completed');
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.workMap.error = errorMsg;
            this.emit('error', { type: 'error', error: errorMsg });
        }
        finally {
            this.isRunning = false;
            this.workMap.updatedAt = new Date();
        }
        return this.workMap;
    }
    /**
     * 收集全局参数（通过 TUI 回调）
     */
    async collectGlobalParams() {
        if (!this.params.onSpecRequest || !this.workMap.globalParams)
            return;
        const values = await this.params.onSpecRequest({
            skillId: this.workMap.skillName,
            params: this.workMap.globalParams,
        });
        this.workMap.globalParamValues = values;
    }
    /**
     * 执行单个阶段
     */
    async executePhase(phase) {
        for (const stepId of phase.stepIds) {
            if (this.shouldPause)
                break;
            const step = this.workMap.steps.find(s => s.id === stepId);
            if (!step)
                continue;
            // 检查依赖是否完成
            if (step.dependencies && step.dependencies.length > 0) {
                const allDepsCompleted = step.dependencies.every(depId => {
                    const depStep = this.workMap.steps.find(s => s.id === depId);
                    return depStep?.status === 'completed';
                });
                if (!allDepsCompleted) {
                    continue; // 跳过，等依赖完成
                }
            }
            // 执行步骤
            await this.executeStep(step);
            // 检查是否失败并需要暂停
            if (step.status === 'failed') {
                this.shouldPause = true;
                this.emit('stepFailed', { step, error: step.error || 'Unknown error' });
            }
        }
    }
    /**
     * 执行单个步骤
     */
    async executeStep(step) {
        this.workMap.currentStepId = step.id;
        step.status = 'running';
        step.startedAt = new Date();
        this.workMap.updatedAt = new Date();
        this.emit('stepStarted', { step });
        try {
            if (step.toolName) {
                const result = await this.executeToolCall(step);
                step.status = 'completed';
                step.result = result;
                this.emit('stepCompleted', { step, result });
            }
            else {
                // 没有工具，只是一个标记步骤
                step.status = 'completed';
                this.emit('stepCompleted', { step, result: undefined });
            }
        }
        catch (error) {
            step.status = 'failed';
            step.error = error instanceof Error ? error.message : String(error);
            this.emit('stepFailed', { step, error: step.error });
        }
        step.completedAt = new Date();
        this.workMap.updatedAt = new Date();
    }
    /**
     * 执行工具调用
     */
    async executeToolCall(step) {
        const tool = findToolByName(getTools(), step.toolName);
        if (!tool) {
            throw new Error(`Tool not found: ${step.toolName}`);
        }
        // 构建输入（应用参数替换）
        let input = step.toolInputTemplate;
        if (input && this.workMap.globalParamValues) {
            input = this.replaceParams(input, this.workMap.globalParamValues);
        }
        if (input && step.paramValues) {
            input = this.replaceParams(input, step.paramValues);
        }
        // 使用现有 executeToolCall 逻辑
        const toolUseBlock = {
            type: 'tool_use',
            id: createId('tool-use'),
            name: step.toolName,
            input,
        };
        const toolUseMessage = {
            type: 'assistant',
            content: [toolUseBlock],
            id: createId('msg'),
        };
        // 这里简化，实际应该调用 query.ts 中的 executeToolCall
        // 暂时模拟执行
        console.log(`[WorkMap] Executing tool: ${step.toolName}`);
        // 模拟成功
        return { success: true, tool: step.toolName, input };
    }
    replaceParams(input, values) {
        if (typeof input === 'string') {
            let result = input;
            for (const [key, value] of Object.entries(values)) {
                result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
            }
            return result;
        }
        else if (Array.isArray(input)) {
            return input.map(item => this.replaceParams(item, values));
        }
        else if (typeof input === 'object' && input !== null) {
            const result = {};
            for (const key of Object.keys(input)) {
                result[key] = this.replaceParams(input[key], values);
            }
            return result;
        }
        return input;
    }
    /**
     * 处理命令
     */
    async handleCommand(command) {
        switch (command.type) {
            case 'pause':
                this.shouldPause = true;
                this.workMap.isPaused = true;
                this.emit('paused', { reason: command.reason });
                break;
            case 'resume':
                this.workMap.isPaused = false;
                this.shouldPause = false;
                this.emit('resumed');
                await this.execute();
                break;
            case 'skip':
                const skipStep = this.workMap.steps.find(s => s.id === command.stepId);
                if (skipStep) {
                    skipStep.status = 'skipped';
                    this.workMap.updatedAt = new Date();
                }
                break;
            case 'retry':
                const retryStep = this.workMap.steps.find(s => s.id === command.stepId);
                if (retryStep) {
                    retryStep.status = 'pending';
                    retryStep.error = undefined;
                    retryStep.result = undefined;
                    this.workMap.updatedAt = new Date();
                    // 如果是暂停状态，恢复执行
                    if (this.workMap.isPaused) {
                        await this.handleCommand({ type: 'resume' });
                    }
                }
                break;
            case 'reset':
                this.workMap.steps.forEach(s => {
                    s.status = 'pending';
                    s.error = undefined;
                    s.result = undefined;
                    s.startedAt = undefined;
                    s.completedAt = undefined;
                });
                this.workMap.currentStepId = undefined;
                this.workMap.isPaused = false;
                this.workMap.error = undefined;
                this.workMap.updatedAt = new Date();
                break;
        }
    }
}
