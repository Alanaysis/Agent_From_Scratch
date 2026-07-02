import { readFile, readdir } from "fs/promises";
import { join } from "path";
import * as yaml from "js-yaml";
import { parseWorkflowYaml, type WorkflowDefinition, type WorkflowStep } from "./workflowIndex";

export type TemplateParam = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  options?: string[];
  required?: boolean;
  default?: unknown;
};

export type WorkflowTemplate = {
  id: string;
  filename: string;
  name: string;
  description?: string;
  tags: string[];
  useCase?: string;
  triggers: string[];
  params: TemplateParam[];
  workflow: WorkflowDefinition;
  rawYaml: string;
};

function getTemplatesDirs(cwd: string): string[] {
  return [
    join(cwd, ".irg", "templates"),
  ];
}

function extractTriggers(template: any, name: string, tags: string[]): string[] {
  const triggers = new Set<string>();
  triggers.add(name.toLowerCase());
  for (const tag of tags) triggers.add(tag.toLowerCase());
  if (Array.isArray(template.triggers)) {
    for (const t of template.triggers) triggers.add(String(t).toLowerCase());
  }
  return [...triggers];
}

function extractParams(template: any): TemplateParam[] {
  if (!Array.isArray(template.required_params)) return [];
  return template.required_params.map((p: any) => ({
    name: p.name,
    label: p.label || p.name,
    type: p.type || "text",
    options: p.options,
    required: p.required !== false,
    default: p.default,
  }));
}

export async function listTemplates(cwd: string): Promise<WorkflowTemplate[]> {
  const templates: WorkflowTemplate[] = [];
  const seen = new Set<string>();
  for (const dir of getTemplatesDirs(cwd)) {
    try {
      const entries = await readdir(dir);
      for (const entry of entries) {
        if (!entry.endsWith(".yaml") && !entry.endsWith(".yml")) continue;
        if (seen.has(entry)) continue;
        seen.add(entry);
        const t = await readTemplate(cwd, entry);
        if (t) templates.push(t);
      }
    } catch {
      // dir may not exist
    }
  }
  return templates;
}

export async function readTemplate(cwd: string, filename: string): Promise<WorkflowTemplate | null> {
  for (const dir of getTemplatesDirs(cwd)) {
    try {
      const filePath = join(dir, filename);
      const rawYaml = await readFile(filePath, "utf8");
      const parsed = yaml.load(rawYaml, { schema: yaml.JSON_SCHEMA }) as any;
      if (!parsed || !parsed.name || !Array.isArray(parsed.steps)) return null;

      const tags: string[] = Array.isArray(parsed.tags) ? parsed.tags.map(String) : [];
      const triggers = extractTriggers(parsed, parsed.name, tags);
      const params = extractParams(parsed);
      const workflow = parseWorkflowYaml(rawYaml);

      return {
        id: filename.replace(/\.(ya?ml)$/, ""),
        filename,
        name: parsed.name,
        description: parsed.description,
        tags,
        useCase: parsed.use_case,
        triggers,
        params,
        workflow,
        rawYaml,
      };
    } catch {
      // try next dir
    }
  }
  return null;
}

export async function findTemplateByIntent(cwd: string, userMessage: string): Promise<WorkflowTemplate | null> {
  const templates = await listTemplates(cwd);
  if (templates.length === 0) return null;

  const message = userMessage.toLowerCase();
  const scored = templates.map((t) => {
    let score = 0;
    for (const trigger of t.triggers) {
      if (message.includes(trigger)) {
        score += trigger.length > 3 ? 3 : 1;
      }
    }
    if (t.useCase && message.includes(t.useCase.toLowerCase())) score += 2;
    return { template: t, score };
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

  return scored[0]?.template ?? null;
}

export type TemplateNode = {
  id: string;
  name: string;
  description?: string;
  agent?: string;
  dependsOn?: string[];
  grpc?: WorkflowStep["grpc"];
  shell?: string;
  requiresApproval?: boolean;
  checkpointAfter?: boolean;
  condition?: WorkflowStep["condition"];
  loop?: WorkflowStep["loop"];
};

export function extractTemplateNodes(template: WorkflowTemplate): TemplateNode[] {
  return template.workflow.steps.map((step) => ({
    id: step.id,
    name: step.name,
    description: step.description || generateFallbackDescription(step),
    agent: step.agent,
    dependsOn: step.dependsOn,
    grpc: step.grpc,
    shell: step.shell,
    requiresApproval: step.requiresApproval,
    checkpointAfter: step.checkpointAfter,
    condition: step.condition,
    loop: step.loop,
  }));
}

function generateFallbackDescription(step: WorkflowStep): string {
  if (step.grpc) {
    const method = step.grpc.method || "unknown";
    const service = step.grpc.service || "";
    const module = step.grpc.payload?.Module || "";
    const action = step.grpc.payload?.Method || "";
    if (module && action) return `${module}.${action} via ${service}.${method}`;
    return `${service}.${method}`;
  }
  if (step.shell) return `Shell: ${step.shell.slice(0, 80)}`;
  return step.name;
}
