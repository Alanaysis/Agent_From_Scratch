export const SpecCollectorTool = {
    name: 'spec_collector',
    inputSchema: {
        type: 'object',
        properties: {
            skillId: { type: 'string' },
            params: { type: 'array' }
        },
        required: ['skillId', 'params']
    },
    async description(input) {
        return `收集 ${input.skillId} 的执行参数`;
    },
    async call(args, context, canUseTool, parentMessage) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`[配置确认] ${args.skillId}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        const spec = {};
        for (const param of args.params) {
            console.log(`\n[${param.name}] ${param.description}`);
            console.log(`─────────────────────────────────────────────────────────────`);
            if (param.type === 'enum' && param.options) {
                console.log(`选项: ${param.options.join(' | ')}`);
            }
            console.log(`推荐值: ${param.default}`);
            if (param.required) {
                console.log(`(必填)`);
            }
            else {
                console.log(`(可选)`);
            }
            // 简单的同步输入 - 实际项目中需要用异步 readline
            // 这里先用一个简单实现，后续可以完善
            const userInput = param.default;
            spec[param.name] = userInput;
            console.log(`✓ 使用: ${userInput}`);
        }
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[最终配置]');
        console.log(JSON.stringify(spec, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // 这里暂时自动确认，后续可以添加用户确认交互
        console.log('\n✓ 配置已确认，开始执行...\n');
        return {
            data: {
                spec
            }
        };
    },
    isReadOnly() {
        return false;
    },
    isConcurrencySafe() {
        return false;
    }
};
