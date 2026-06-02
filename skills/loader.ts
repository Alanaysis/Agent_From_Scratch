import type { SkillFrontmatter, SkillMetadata, SkillInstruction, SkillResource, SkillGating } from './frontmatter'
import { readFile, readdir, access, stat } from 'fs/promises';
import { join, dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { platform } from 'os';

export type LoadedSkill = {
  name: string;
  trigger: string[];
  paths: string[];
  frontmatter: SkillFrontmatter;
  content: string;
  dirPath?: string;
  metadata: SkillMetadata;
  _instructionCache?: SkillInstruction;
  _resourceCache?: SkillResource[];
};

let LoadedSkills: LoadedSkill[] = [];

const KEBAB_CAMEL_MAP: Record<string, string> = {
  'user-invocable': 'userInvocable',
  'disable-model-invocation': 'disableModelInvocation',
  'argument-hint': 'argumentHint',
  'allowed-tools': 'allowedTools',
  'command-dispatch': 'commandDispatch',
  'command-tool': 'commandTool',
  'command-arg-mode': 'commandArgMode',
};

function normalizeKeys(parsed: any): any {
  const result: any = {};
  for (const [key, value] of Object.entries(parsed)) {
    const normalizedKey = KEBAB_CAMEL_MAP[key] || key;
    result[normalizedKey] = value;
  }
  return result;
}

function parseSimpleYaml(yamlContent: string): any {
  const result: any = {};
  const lines = yamlContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    let value: any = trimmed.slice(colonIndex + 1).trim();

    if (value.startsWith('{')) {
      try {
        value = JSON.parse(value);
        result[key] = value;
        continue;
      } catch {
        // not valid JSON, treat as string
      }
    }

    if (value.startsWith('[')) {
      let jsonStr = value;
      let openBrackets = (value.match(/\[/g) || []).length;
      let closeBrackets = (value.match(/\]/g) || []).length;

      let j = i + 1;
      while (j < lines.length && openBrackets > closeBrackets) {
        const nextLine = lines[j];
        jsonStr += '\n' + nextLine;
        openBrackets += (nextLine.match(/\[/g) || []).length;
        closeBrackets += (nextLine.match(/\]/g) || []).length;
        j++;
      }

      try {
        result[key] = JSON.parse(jsonStr);
        i = j - 1;
        continue;
      } catch (e) {
        console.warn('Failed to parse array JSON:', e);
      }
    }

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    } else if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    } else if (/^\d+$/.test(value)) {
      value = Number(value);
    }

    result[key] = value;
  }

  return normalizeKeys(result);
}

function extractGating(parsed: any): SkillGating | undefined {
  if (parsed.metadata && typeof parsed.metadata === 'object') {
    const meta = parsed.metadata;
    const openclaw = meta.openclaw || meta;
    return {
      always: openclaw.always === true,
      os: Array.isArray(openclaw.os) ? openclaw.os : undefined,
      requires: openclaw.requires ? {
        bins: Array.isArray(openclaw.requires.bins) ? openclaw.requires.bins : undefined,
        anyBins: Array.isArray(openclaw.requires.anyBins) ? openclaw.requires.anyBins : undefined,
        env: Array.isArray(openclaw.requires.env) ? openclaw.requires.env : undefined,
        config: Array.isArray(openclaw.requires.config) ? openclaw.requires.config : undefined,
      } : undefined,
      primaryEnv: openclaw.primaryEnv,
      emoji: openclaw.emoji,
      homepage: openclaw.homepage || parsed.homepage,
    };
  }
  return undefined;
}

function checkGating(gating: SkillGating | undefined): boolean {
  if (!gating) return true;
  if (gating.always) return true;

  if (gating.os && gating.os.length > 0) {
    const currentOs = platform();
    if (!gating.os.includes(currentOs)) return false;
  }

  if (gating.requires) {
    if (gating.requires.bins) {
      for (const bin of gating.requires.bins) {
        try {
          execSync(`which ${bin} 2>/dev/null`, { stdio: 'pipe' });
        } catch {
          return false;
        }
      }
    }

    if (gating.requires.anyBins && gating.requires.anyBins.length > 0) {
      let found = false;
      for (const bin of gating.requires.anyBins) {
        try {
          execSync(`which ${bin} 2>/dev/null`, { stdio: 'pipe' });
          found = true;
          break;
        } catch {
          // continue
        }
      }
      if (!found) return false;
    }

    if (gating.requires.env) {
      for (const envVar of gating.requires.env) {
        if (!process.env[envVar]) return false;
      }
    }
  }

  return true;
}

function toMetadata(parsed: any, name: string, trigger: string[]): SkillMetadata {
  const gating = extractGating(parsed);
  return {
    name,
    description: parsed.description || '',
    trigger,
    paths: Array.isArray(parsed.paths) ? parsed.paths : [],
    userInvocable: parsed.userInvocable !== false,
    disableModelInvocation: parsed.disableModelInvocation === true,
    argumentHint: parsed.argumentHint,
    context: parsed.context === 'inline' || parsed.context === 'fork' ? parsed.context : undefined,
    agent: parsed.agent,
    allowedTools: Array.isArray(parsed.allowedTools) ? parsed.allowedTools : undefined,
    model: parsed.model,
    params: Array.isArray(parsed.params) ? parsed.params : undefined,
    homepage: parsed.homepage,
    commandDispatch: parsed.commandDispatch === 'tool' ? 'tool' : undefined,
    commandTool: parsed.commandTool,
    commandArgMode: parsed.commandArgMode === 'raw' ? 'raw' : undefined,
    gating,
  };
}

function replaceBaseDir(content: string, dirPath: string | undefined): string {
  if (!dirPath || !content.includes('{baseDir}')) return content;
  return content.replace(/\{baseDir\}/g, dirPath);
}

async function parseSkillFile(skillPath: string, dirPath?: string): Promise<LoadedSkill | null> {
  try {
    const content = await readFile(skillPath, 'utf-8');
    const parts = content.split('---');

    if (parts.length < 3) {
      console.error(`Invalid skill file format: ${skillPath}`);
      return null;
    }

    const frontmatterRaw = parts[1].trim();
    const rawBody = parts.slice(2).join('---').trim();

    const parsed = parseSimpleYaml(frontmatterRaw);
    const frontmatterObj: SkillFrontmatter = {};

    const name = parsed.name || '';
    const trigger: string[] = Array.isArray(parsed.trigger) ? parsed.trigger : [];

    if (parsed.description) frontmatterObj.description = parsed.description;
    if (parsed.model) frontmatterObj.model = parsed.model;
    if (parsed.context === 'inline' || parsed.context === 'fork') {
      frontmatterObj.context = parsed.context;
    }
    if (Array.isArray(parsed.allowedTools)) frontmatterObj.allowedTools = parsed.allowedTools;
    if (Array.isArray(parsed.params)) frontmatterObj.params = parsed.params;
    if (Array.isArray(parsed.paths)) frontmatterObj.paths = parsed.paths;
    if (parsed.userInvocable !== undefined) frontmatterObj.userInvocable = parsed.userInvocable;
    if (parsed.disableModelInvocation !== undefined) frontmatterObj.disableModelInvocation = parsed.disableModelInvocation;
    if (parsed.argumentHint) frontmatterObj.argumentHint = parsed.argumentHint;
    if (parsed.agent) frontmatterObj.agent = parsed.agent;
    if (parsed.homepage) frontmatterObj.homepage = parsed.homepage;
    if (parsed.commandDispatch) frontmatterObj.commandDispatch = parsed.commandDispatch;
    if (parsed.commandTool) frontmatterObj.commandTool = parsed.commandTool;
    if (parsed.commandArgMode) frontmatterObj.commandArgMode = parsed.commandArgMode;

    const gating = extractGating(parsed);
    if (gating) frontmatterObj.metadata = gating;

    const metadata = toMetadata(parsed, name, trigger);

    if (!checkGating(metadata.gating)) {
      return null;
    }

    const body = replaceBaseDir(rawBody, dirPath);

    return {
      name,
      trigger,
      paths: metadata.paths,
      frontmatter: frontmatterObj,
      content: body,
      dirPath,
      metadata,
    };
  } catch (error) {
    console.error(`Error parsing skill ${skillPath}:`, error);
    return null;
  }
}

async function registerSkill(skillPath: string, dirPath?: string) {
  const skill = await parseSkillFile(skillPath, dirPath);
  if (skill) {
    LoadedSkills.push(skill);
  }
}

async function registerSkillsFromDirectory(dirPath: string) {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const skillMdPath = join(fullPath, 'SKILL.md');
        try {
          await access(skillMdPath);
          await registerSkill(skillMdPath, fullPath);
        } catch {
          const altMdPath = join(fullPath, entry.name + '.md');
          try {
            await access(altMdPath);
            await registerSkill(altMdPath, fullPath);
          } catch {
            // directory without skill file, skip
          }
        }
      } else if (entry.name.endsWith('.md')) {
        await registerSkill(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading skills directory ${dirPath}:`, error);
  }
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function loadSkills(): Promise<LoadedSkill[]> {
  LoadedSkills = [];

  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFilePath);

  const possiblePaths = [
    join(currentDir, 'bundled'),
    join(dirname(dirname(currentDir)), 'skills', 'bundled'),
    join(process.cwd(), 'skills', 'bundled'),
  ];

  let skillsLoaded = false;
  for (const skillsPath of possiblePaths) {
    if (await directoryExists(skillsPath)) {
      console.log(`Loading skills from: ${skillsPath}`);
      await registerSkillsFromDirectory(skillsPath);
      skillsLoaded = true;
      break;
    }
  }

  if (!skillsLoaded) {
    console.warn('Could not find skills directory in any of the expected locations');
    console.warn('Tried paths:', possiblePaths);
  }

  const userSkillsPath = join(process.cwd(), '.irg', 'skills');
  if (await directoryExists(userSkillsPath)) {
    console.log(`Loading user skills from: ${userSkillsPath}`);
    await registerSkillsFromDirectory(userSkillsPath);
  }

  return LoadedSkills;
}

export function getLoadedSkills(): LoadedSkill[] {
  return LoadedSkills;
}

export function setLoadedSkills(skills: LoadedSkill[]): void {
  LoadedSkills = skills;
}

export async function loadSkillsFromPath(dirPath: string, reset = true): Promise<LoadedSkill[]> {
  if (reset) LoadedSkills = [];
  await registerSkillsFromDirectory(dirPath);
  return LoadedSkills;
}

export function getSkillMetadataList(): SkillMetadata[] {
  return LoadedSkills.map((s) => s.metadata);
}

function shouldTriggerByKeyword(skill: LoadedSkill, prompt: string): boolean {
  if (!skill.trigger || skill.trigger.length === 0) return false;
  const lowerPrompt = prompt.toLowerCase();
  return skill.trigger.some((t) => lowerPrompt.includes(t.toLowerCase()));
}

function simpleGlobMatch(str: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{DOUBLESTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{DOUBLESTAR}}/g, '.*')
    .replace(/\?/g, '[^/]');
  try {
    const regex = new RegExp(`^${regexStr}$`, 'i');
    return regex.test(str);
  } catch {
    return false;
  }
}

function shouldTriggerByPaths(skill: LoadedSkill, prompt: string): boolean {
  if (!skill.paths || skill.paths.length === 0) return false;
  const lowerPrompt = prompt.toLowerCase();
  for (const pattern of skill.paths) {
    const fileRefs = lowerPrompt.match(/[\w/.-]+\.\w+/g) || [];
    for (const ref of fileRefs) {
      if (simpleGlobMatch(ref, pattern)) return true;
    }
  }
  return false;
}

function shouldTriggerByDescription(skill: LoadedSkill, prompt: string): boolean {
  if (!skill.metadata.description) return false;
  const descLower = skill.metadata.description.toLowerCase();
  const promptWords = prompt.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  let matchCount = 0;
  for (const word of promptWords) {
    if (descLower.includes(word)) matchCount += 1;
  }
  return matchCount >= Math.max(1, Math.ceil(promptWords.length * 0.3));
}

export function detectRelevantSkills(prompt: string): LoadedSkill[] {
  const skills = getLoadedSkills();
  return skills.filter((skill) => {
    if (skill.metadata.disableModelInvocation) return false;
    return (
      shouldTriggerByKeyword(skill, prompt) ||
      shouldTriggerByPaths(skill, prompt) ||
      shouldTriggerByDescription(skill, prompt)
    );
  });
}

export function detectUserInvocableSkills(): LoadedSkill[] {
  return LoadedSkills.filter((s) => s.metadata.userInvocable);
}

export function findSkillByName(name: string): LoadedSkill | undefined {
  const lowerName = name.toLowerCase();
  return LoadedSkills.find(
    (s) => s.name.toLowerCase() === lowerName || s.name.toLowerCase().replace(/\s+/g, '-') === lowerName,
  );
}

export async function loadSkillInstruction(skill: LoadedSkill): Promise<SkillInstruction> {
  if (skill._instructionCache) return skill._instructionCache;

  const references: string[] = [];

  if (skill.dirPath) {
    try {
      const refDir = join(skill.dirPath, 'references');
      const entries = await readdir(refDir);
      for (const entry of entries) {
        if (entry.endsWith('.md') || entry.endsWith('.txt')) {
          references.push(join(refDir, entry));
        }
      }
    } catch {
      // no references directory
    }
  }

  const instruction: SkillInstruction = {
    content: skill.content,
    references,
  };

  skill._instructionCache = instruction;
  return instruction;
}

export async function loadSkillResources(skill: LoadedSkill): Promise<SkillResource[]> {
  if (skill._resourceCache) return skill._resourceCache;

  const resources: SkillResource[] = [];

  if (skill.dirPath) {
    try {
      const scriptsDir = join(skill.dirPath, 'scripts');
      const entries = await readdir(scriptsDir);
      for (const entry of entries) {
        resources.push({
          name: entry,
          path: join(scriptsDir, entry),
          type: 'script',
        });
      }
    } catch {
      // no scripts directory
    }

    try {
      const templatesDir = join(skill.dirPath, 'templates');
      const entries = await readdir(templatesDir);
      for (const entry of entries) {
        resources.push({
          name: entry,
          path: join(templatesDir, entry),
          type: 'file',
        });
      }
    } catch {
      // no templates directory
    }

    try {
      const examplesDir = join(skill.dirPath, 'examples');
      const entries = await readdir(examplesDir);
      for (const entry of entries) {
        resources.push({
          name: entry,
          path: join(examplesDir, entry),
          type: 'file',
        });
      }
    } catch {
      // no examples directory
    }

    try {
      const assetsDir = join(skill.dirPath, 'assets');
      const entries = await readdir(assetsDir);
      for (const entry of entries) {
        resources.push({
          name: entry,
          path: join(assetsDir, entry),
          type: 'file',
        });
      }
    } catch {
      // no assets directory
    }
  }

  skill._resourceCache = resources;
  return resources;
}

export function formatSkillMetadataForPrompt(skills: LoadedSkill[]): string {
  if (skills.length === 0) return '';

  const lines: string[] = ['<available_skills>'];

  for (const skill of skills) {
    if (skill.metadata.disableModelInvocation) continue;

    let line = `- ${skill.name}: ${skill.metadata.description || 'No description'}`;
    if (skill.metadata.argumentHint) {
      line += ` (Usage: /${skill.name} ${skill.metadata.argumentHint})`;
    }
    lines.push(line);
  }

  lines.push('</available_skills>');
  return lines.join('\n');
}

export function formatSkillInstructionForPrompt(skill: LoadedSkill): string {
  const parts: string[] = [];

  parts.push(`=== SKILL: ${skill.name} ===`);
  if (skill.metadata.description) {
    parts.push(`Description: ${skill.metadata.description}`);
  }
  parts.push('');
  parts.push(skill.content);

  if (skill.metadata.allowedTools && skill.metadata.allowedTools.length > 0) {
    parts.push('');
    parts.push(`Allowed tools: ${skill.metadata.allowedTools.join(', ')}`);
  }

  if (skill.dirPath) {
    parts.push('');
    parts.push(`Skill directory: ${skill.dirPath}`);
    parts.push('Reference files, scripts, and templates are available in this directory.');
    parts.push('Use Read tool to inspect reference files. Use Shell tool to execute scripts.');
  }

  parts.push('');
  parts.push('INSTRUCTIONS: Follow the workflow outlined above. Complete ALL steps in order.');

  return parts.join('\n');
}
