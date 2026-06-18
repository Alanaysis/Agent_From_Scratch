/** Extract text content from a message, handling both string and multimodal formats */
export function getMessageText(message) {
    if (message.type === 'user') {
        if (typeof message.content === 'string')
            return message.content;
        return message.content
            .filter((b) => b.type === 'text')
            .map(b => b.text)
            .join('\n');
    }
    if (message.type === 'assistant') {
        return message.content
            .filter((b) => b.type === 'text')
            .map(b => b.text)
            .join('\n');
    }
    if (message.type === 'tool_result')
        return message.content;
    return '';
}
/** Check if a message has image content */
export function hasImages(message) {
    if (message.type !== 'user')
        return false;
    if (typeof message.content === 'string')
        return false;
    return message.content.some(b => b.type === 'image');
}
