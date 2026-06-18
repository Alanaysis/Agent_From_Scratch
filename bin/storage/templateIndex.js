/**
 * Template Library for PM Agent
 *
 * Stores reusable workflow templates that PM can reference when creating proposals.
 * Templates are YAML files in .irg/templates/ with metadata.
 */
import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import { join } from "path";
import * as yaml from "js-yaml";
function getTemplatesDir(cwd) {
    return join(cwd, ".irg", "templates");
}
function getTemplatePath(cwd, templateId) {
    return join(getTemplatesDir(cwd), `${templateId}.yaml`);
}
/** Load all templates from .irg/templates/ */
export async function listTemplates(cwd) {
    const templates = [];
    try {
        const dir = getTemplatesDir(cwd);
        await mkdir(dir, { recursive: true });
        const entries = await readdir(dir);
        for (const entry of entries) {
            if (!entry.endsWith(".yaml") && !entry.endsWith(".yml"))
                continue;
            try {
                const content = await readFile(join(dir, entry), "utf8");
                const parsed = yaml.load(content, { schema: yaml.JSON_SCHEMA });
                if (parsed && parsed.name) {
                    templates.push({
                        id: entry.replace(/\.(yaml|yml)$/, ""),
                        name: parsed.name,
                        description: parsed.description || "",
                        tags: parsed.tags || [],
                        steps: parsed.steps || [],
                        useCase: parsed.use_case || parsed.useCase,
                        requiredParams: parsed.required_params || parsed.requiredParams || [],
                        createdAt: parsed.createdAt || "",
                        updatedAt: parsed.updatedAt || "",
                    });
                }
            }
            catch {
                // Skip invalid template files
            }
        }
    }
    catch {
        // Directory doesn't exist yet
    }
    return templates.sort((a, b) => a.name.localeCompare(b.name));
}
/** Find templates matching a query (keyword match on name, description, tags) */
export async function findTemplates(cwd, query) {
    const all = await listTemplates(cwd);
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/).filter(Boolean);
    return all
        .map((t) => {
        let score = 0;
        const searchText = `${t.name} ${t.description} ${t.tags.join(" ")} ${t.useCase || ""}`.toLowerCase();
        for (const word of words) {
            if (searchText.includes(word))
                score += 2;
            if (t.tags.some((tag) => tag.toLowerCase().includes(word)))
                score += 1;
        }
        // Exact name match bonus
        if (t.name.toLowerCase() === lowerQuery)
            score += 10;
        return { template: t, score };
    })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.template);
}
/** Get a single template by ID */
export async function getTemplate(cwd, templateId) {
    try {
        const content = await readFile(getTemplatePath(cwd, templateId), "utf8");
        const parsed = yaml.load(content, { schema: yaml.JSON_SCHEMA });
        if (!parsed || !parsed.name)
            return null;
        return {
            id: templateId,
            name: parsed.name,
            description: parsed.description || "",
            tags: parsed.tags || [],
            steps: parsed.steps || [],
            useCase: parsed.use_case || parsed.useCase,
            requiredParams: parsed.required_params || parsed.requiredParams || [],
            createdAt: parsed.createdAt || "",
            updatedAt: parsed.updatedAt || "",
        };
    }
    catch {
        return null;
    }
}
/** Save a template */
export async function saveTemplate(cwd, template) {
    const dir = getTemplatesDir(cwd);
    await mkdir(dir, { recursive: true });
    const now = new Date().toISOString();
    const data = {
        name: template.name,
        description: template.description,
        tags: template.tags,
        use_case: template.useCase,
        required_params: template.requiredParams,
        steps: template.steps,
        createdAt: template.createdAt || now,
        updatedAt: now,
    };
    await writeFile(getTemplatePath(cwd, template.id), yaml.dump(data, { lineWidth: 120 }), "utf8");
}
/** Format templates for prompt injection */
export function formatTemplatesForPrompt(templates) {
    if (templates.length === 0)
        return "";
    const parts = ["<available_templates>"];
    for (const t of templates) {
        parts.push(`## ${t.name} (${t.id})`);
        parts.push(`Description: ${t.description}`);
        if (t.tags.length > 0)
            parts.push(`Tags: ${t.tags.join(", ")}`);
        if (t.useCase)
            parts.push(`Use when: ${t.useCase}`);
        parts.push(`Steps: ${t.steps.length}`);
        parts.push("");
    }
    parts.push("</available_templates>");
    return parts.join("\n");
}
