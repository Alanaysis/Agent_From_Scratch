export const BUILTIN_TEAMS = {
    "code-review": {
        name: "code-review",
        description: "A code review team with specialized reviewers for security, performance, and style.",
        lead: {
            name: "review-coordinator",
            role: "coordinator",
            description: "Coordinates the code review process and synthesizes findings.",
            systemPrompt: [
                "You are the coordinator of a code review team.",
                "Your job is to synthesize the findings from all reviewers into a coherent, actionable report.",
                "Prioritize findings by severity: critical bugs > security issues > performance > style.",
                "Provide clear, actionable recommendations.",
            ],
            allowedTools: ["Read", "FileTree", "SearchFiles"],
            isReadOnly: true,
        },
        members: [
            {
                name: "security-reviewer",
                role: "reviewer",
                description: "Reviews code for security vulnerabilities and best practices.",
                systemPrompt: [
                    "You are a security-focused code reviewer.",
                    "Look for: injection vulnerabilities, authentication issues, data exposure, insecure defaults.",
                    "Rate each finding as critical, high, medium, or low severity.",
                    "Provide specific remediation advice for each finding.",
                ],
                allowedTools: ["Read", "SearchFiles"],
                isReadOnly: true,
            },
            {
                name: "performance-reviewer",
                role: "reviewer",
                description: "Reviews code for performance issues and optimization opportunities.",
                systemPrompt: [
                    "You are a performance-focused code reviewer.",
                    "Look for: inefficient algorithms, unnecessary re-renders, memory leaks, N+1 queries, blocking operations.",
                    "Suggest specific optimizations with expected impact.",
                ],
                allowedTools: ["Read", "SearchFiles"],
                isReadOnly: true,
            },
        ],
    },
    "research": {
        name: "research",
        description: "A research team for comprehensive analysis of codebases or topics.",
        lead: {
            name: "research-lead",
            role: "coordinator",
            description: "Leads research efforts and synthesizes findings from team members.",
            systemPrompt: [
                "You are the lead researcher coordinating a research team.",
                "Synthesize findings from all researchers into a comprehensive report.",
                "Identify patterns, contradictions, and gaps in the research.",
                "Provide clear conclusions and actionable next steps.",
            ],
            allowedTools: ["Read", "FileTree", "SearchFiles", "WebFetch", "WebSearch"],
            isReadOnly: true,
        },
        members: [
            {
                name: "codebase-analyst",
                role: "researcher",
                description: "Analyzes the codebase structure, patterns, and dependencies.",
                systemPrompt: [
                    "You are a codebase analyst.",
                    "Focus on understanding the architecture, module dependencies, and code patterns.",
                    "Map out the key components and their relationships.",
                    "Identify potential areas of concern or improvement.",
                ],
                allowedTools: ["Read", "FileTree", "SearchFiles"],
                isReadOnly: true,
            },
            {
                name: "documentation-analyst",
                role: "researcher",
                description: "Analyzes documentation and external resources.",
                systemPrompt: [
                    "You are a documentation and external resource analyst.",
                    "Search for relevant documentation, API references, and external resources.",
                    "Cross-reference findings with the codebase analysis.",
                    "Identify documentation gaps and inconsistencies.",
                ],
                allowedTools: ["Read", "WebFetch", "WebSearch"],
                isReadOnly: true,
            },
        ],
    },
};
export function getTeamDefinition(teamName) {
    if (!teamName?.trim())
        return null;
    return BUILTIN_TEAMS[teamName.toLowerCase()] ?? null;
}
export function getToolDefsForTeamMember(member, allToolDefs) {
    const blockedTools = ["Agent", "Team", "Reflect", "Skill"];
    if (member.allowedTools === "*") {
        return allToolDefs.filter((t) => !blockedTools.includes(t.name));
    }
    return allToolDefs.filter((t) => member.allowedTools.includes(t.name) && !blockedTools.includes(t.name));
}
