export function createInitialAppState() {
    return {
        permissionContext: {
            mode: 'default',
            allowRules: [],
            denyRules: [],
            askRules: [],
        },
        messages: [],
        tasks: {},
    };
}
