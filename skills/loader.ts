import type { SkillFrontmatter } from './frontmatter'
import { readFile, readdir, access } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

export type LoadedSkill = {
  name: string
  trigger: string[]
  frontmatter: SkillFrontmatter
  content: string
}

let LoadedSkills: LoadedSkill[] = [];

// 简单的 frontmatter 解析器，支持多行数组
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
    let value = trimmed.slice(colonIndex + 1).trim();

    // 处理数组值（JSON 形式）- 支持单行和多行
    if (value.startsWith('[')) {
      // 收集完整的数组
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
        i = j - 1; // 跳过已处理的行
        continue;
      } catch (e) {
        console.warn('Failed to parse array JSON:', e);
      }
    }

    // 处理字符串值
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

async function parseSkillFrontmatter(skillPath: string): Promise<LoadedSkill | null> {
  try {
    const content = await readFile(skillPath, 'utf-8');
    const parts = content.split('---');
    
    if (parts.length < 3) {
      console.error(`Invalid skill file format: ${skillPath}`);
      return null;
    }
    
    const frontmatterRaw = parts[1].trim();
    const body = parts[2].trim();
    
    // 解析 frontmatter
    const parsed = parseSimpleYaml(frontmatterRaw);
    const frontmatterObj: SkillFrontmatter = {};
    
    let name = parsed.name || '';
    let trigger: string[] = Array.isArray(parsed.trigger) ? parsed.trigger : [];
    
    // 处理简单字段
    if (parsed.description) frontmatterObj.description = parsed.description;
    if (parsed.model) frontmatterObj.model = parsed.model;
    if (parsed.context === 'inline' || parsed.context === 'fork') {
      frontmatterObj.context = parsed.context;
    }
    if (Array.isArray(parsed.allowedTools)) {
      frontmatterObj.allowedTools = parsed.allowedTools;
    }
    if (Array.isArray(parsed.params)) {
      frontmatterObj.params = parsed.params;
    }
    
    return {
      name,
      trigger,
      frontmatter: frontmatterObj,
      content: body
    };
  } catch (error) {
    console.error(`Error parsing skill ${skillPath}:`, error);
    return null;
  }
}

async function registerSkill(skillPath: string) {
  const skill = await parseSkillFrontmatter(skillPath);
  if (skill) {
    LoadedSkills.push(skill);
  }
}

async function registerSkillsFromDirectory(dirPath: string) {
  try {
    const files = await readdir(dirPath);
    const mdFiles = files.filter(file => file.endsWith('.md'));
    
    for (const file of mdFiles) {
      await registerSkill(join(dirPath, file));
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
  
  // 获取当前文件所在目录
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFilePath);
  
  // 尝试多个可能的路径
  const possiblePaths = [
    // 源代码目录 (TypeScript)
    join(currentDir, 'bundled'),
    // 编译后的目录 (JavaScript in bin)
    join(dirname(dirname(currentDir)), 'skills', 'bundled'),
    // 项目根目录的 skills
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
  
  return LoadedSkills;
}

export function getLoadedSkills(): LoadedSkill[] {
  return LoadedSkills;
}

// 检查技能是否应该被触发
function shouldTriggerSkill(skill: LoadedSkill, prompt: string): boolean {
  if (!skill.trigger || skill.trigger.length === 0) return false;
  
  const lowerPrompt = prompt.toLowerCase();
  return skill.trigger.some(trigger => 
    lowerPrompt.includes(trigger.toLowerCase())
  );
}

// 自动检测并推荐相关技能
export function detectRelevantSkills(prompt: string): LoadedSkill[] {
  const skills = getLoadedSkills();
  return skills.filter(skill => shouldTriggerSkill(skill, prompt));
}
