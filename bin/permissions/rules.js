export function addAllowRule(context, rule) {
    return {
        ...context,
        allowRules: [...context.allowRules, rule],
    };
}
