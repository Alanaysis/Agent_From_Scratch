import { mkdir, readFile, readdir, writeFile, rm, access } from "fs/promises";
import { join } from "path";
import type { SkillFrontmatter } from "./frontmatter";

function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export type SkillEvolutionRecord = {
  version: number;
  timestamp: string;
  changeType: "created" | "refined" | "patched" | "merged" | "deprecated";
  description: string;
  trigger: "auto" | "user" | "cron";
};

export type EvolvableSkill = {
  name: string;
  trigger: string[];
  frontmatter: SkillFrontmatter & {
    version?: number;
    createdAt?: string;
    updatedAt?: string;
    usageCount?: number;
    successCount?: number;
    failCount?: number;
    lastUsed?: string;
    parentSkillId?: string;
    evolutionHistory?: SkillEvolutionRecord[];
  };
  content: string;
};

function getUserSkillsDir(cwd: string): string {
  return join(cwd, ".claude-code-lite", "skills");
}

async function ensureSkillsDir(cwd: string): Promise<void> {
  await mkdir(getUserSkillsDir(cwd), { recursive: true });
}

function serializeSkill(skill: EvolvableSkill): string {
  const fm: Record<string, unknown> = {
    name: skill.name,
    trigger: skill.trigger,
    ...skill.frontmatter,
  };

  const fmLines = Object.entries(fm)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${JSON.stringify(value)}`;
      }
      if (typeof value === "object" && value !== null) {
        return `${key}: ${JSON.stringify(value)}`;
      }
      return `${key}: ${value}`;
    })
    .join("\n");

  return `---\n${fmLines}\n---\n\n${skill.content}\n`;
}

export async function createSkill(
  cwd: string,
  name: string,
  content: string,
  trigger: string[],
  allowedTools?: string[],
  source: "auto" | "user" | "cron" = "auto",
): Promise<EvolvableSkill> {
  await ensureSkillsDir(cwd);

  const now = new Date().toISOString();
  const safeName = sanitizeName(name);
  const fileName = `${safeName}.md`;

  const skill: EvolvableSkill = {
    name: safeName,
    trigger,
    frontmatter: {
      name: safeName,
      trigger,
      description: content.slice(0, 100),
      allowedTools,
      version: 1,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      successCount: 0,
      failCount: 0,
      lastUsed: now,
      evolutionHistory: [
        {
          version: 1,
          timestamp: now,
          changeType: "created",
          description: `Skill created from ${source} trigger`,
          trigger: source,
        },
      ],
    },
    content,
  };

  const filePath = join(getUserSkillsDir(cwd), fileName);
  await writeFile(filePath, serializeSkill(skill), "utf8");
  return skill;
}

export async function patchSkill(
  cwd: string,
  name: string,
  patch: {
    content?: string;
    trigger?: string[];
    allowedTools?: string[];
    description?: string;
  },
  changeDescription: string,
  source: "auto" | "user" | "cron" = "auto",
): Promise<EvolvableSkill | null> {
  const existing = await readSkill(cwd, name);
  if (!existing) return null;

  const now = new Date().toISOString();
  const newVersion = (existing.frontmatter.version ?? 1) + 1;

  if (patch.content) existing.content = patch.content;
  if (patch.trigger) existing.trigger = patch.trigger;
  if (patch.allowedTools) existing.frontmatter.allowedTools = patch.allowedTools;
  if (patch.description) existing.frontmatter.description = patch.description;

  existing.frontmatter.version = newVersion;
  existing.frontmatter.updatedAt = now;

  if (!existing.frontmatter.evolutionHistory) {
    existing.frontmatter.evolutionHistory = [];
  }
  existing.frontmatter.evolutionHistory.push({
    version: newVersion,
    timestamp: now,
    changeType: "patched",
    description: changeDescription,
    trigger: source,
  });

  const safeName = sanitizeName(name);
  const filePath = join(getUserSkillsDir(cwd), `${safeName}.md`);
  await writeFile(filePath, serializeSkill(existing), "utf8");
  return existing;
}

export async function readSkill(
  cwd: string,
  name: string,
): Promise<EvolvableSkill | null> {
  const safeName = sanitizeName(name);
  const filePath = join(getUserSkillsDir(cwd), `${safeName}.md`);

  try {
    const raw = await readFile(filePath, "utf8");
    return parseSkillContent(raw);
  } catch {
    return null;
  }
}

export async function listUserSkills(cwd: string): Promise<EvolvableSkill[]> {
  const skillsDir = getUserSkillsDir(cwd);
  const skills: EvolvableSkill[] = [];

  try {
    const entries = await readdir(skillsDir);
    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      try {
        const raw = await readFile(join(skillsDir, entry), "utf8");
        const skill = parseSkillContent(raw);
        if (skill) skills.push(skill);
      } catch {
        // skip malformed
      }
    }
  } catch {
    // directory doesn't exist
  }

  return skills;
}

export async function deprecateSkill(
  cwd: string,
  name: string,
  reason: string,
): Promise<boolean> {
  const skill = await readSkill(cwd, name);
  if (!skill) return false;

  const now = new Date().toISOString();
  skill.frontmatter.updatedAt = now;

  if (!skill.frontmatter.evolutionHistory) {
    skill.frontmatter.evolutionHistory = [];
  }
  skill.frontmatter.evolutionHistory.push({
    version: skill.frontmatter.version ?? 1,
    timestamp: now,
    changeType: "deprecated",
    description: reason,
    trigger: "auto",
  });

  skill.content = `[DEPRECATED] ${reason}\n\n${skill.content}`;

  const safeName = sanitizeName(name);
  const filePath = join(getUserSkillsDir(cwd), `${safeName}.md`);
  await writeFile(filePath, serializeSkill(skill), "utf8");
  return true;
}

export async function deleteSkill(cwd: string, name: string): Promise<boolean> {
  const safeName = sanitizeName(name);
  const filePath = join(getUserSkillsDir(cwd), `${safeName}.md`);
  try {
    await rm(filePath, { force: true });
    return true;
  } catch {
    return false;
  }
}

export async function recordSkillUsage(
  cwd: string,
  name: string,
  success: boolean,
): Promise<void> {
  const skill = await readSkill(cwd, name);
  if (!skill) return;

  skill.frontmatter.usageCount = (skill.frontmatter.usageCount ?? 0) + 1;
  if (success) {
    skill.frontmatter.successCount = (skill.frontmatter.successCount ?? 0) + 1;
  } else {
    skill.frontmatter.failCount = (skill.frontmatter.failCount ?? 0) + 1;
  }
  skill.frontmatter.lastUsed = new Date().toISOString();

  const safeName = sanitizeName(name);
  const filePath = join(getUserSkillsDir(cwd), `${safeName}.md`);
  await writeFile(filePath, serializeSkill(skill), "utf8");
}

function parseSkillContent(raw: string): EvolvableSkill | null {
  const parts = raw.split("---");
  if (parts.length < 3) return null;

  const frontmatterRaw = parts[1].trim();
  const body = parts.slice(2).join("---").trim();

  const fm: Record<string, unknown> = {};
  for (const line of frontmatterRaw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;
    const key = trimmed.slice(0, colonIndex).trim();
    let value: unknown = trimmed.slice(colonIndex + 1).trim();
    if (typeof value === "string") {
      if (value.startsWith("[") && value.endsWith("]")) {
        try {
          value = JSON.parse(value);
        } catch {
          // keep as string
        }
      } else if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value === "true") {
        value = true;
      } else if (value === "false") {
        value = false;
      } else if (/^\d+$/.test(value as string)) {
        value = Number(value);
      }
    }
    fm[key] = value;
  }

  return {
    name: (fm.name as string) || "",
    trigger: Array.isArray(fm.trigger) ? (fm.trigger as string[]) : [],
    frontmatter: fm as EvolvableSkill["frontmatter"],
    content: body,
  };
}
