export function findToolByName(tools, name) {
    return tools.find(tool => tool.name === name);
}
