import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  loadSkillsFromPath,
  getLoadedSkills,
  setLoadedSkills,
  detectRelevantSkills,
  detectUserInvocableSkills,
  findSkillByName,
  formatSkillMetadataForPrompt,
  formatSkillInstructionForPrompt,
  loadSkillInstruction,
  loadSkillResources,
  type LoadedSkill,
} from '../../../skills/loader';

const TEST_DIR = join('/tmp', 'skill-loader-test-' + Date.now());
const BUNDLED_DIR = join(TEST_DIR, 'bundled');

beforeEach(async () => {
  setLoadedSkills([]);
  await mkdir(BUNDLED_DIR, { recursive: true });
});

afterEach(async () => {
  setLoadedSkills([]);
  await rm(TEST_DIR, { recursive: true, force: true });
});

async function writeSkillFile(
  dir: string,
  filename: string,
  frontmatter: string,
  content: string,
) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), `---\n${frontmatter}\n---\n\n${content}\n`, 'utf8');
}

describe('Skill Loader - Directory Structure', () => {
  it('loads single .md file skills', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'simple.md',
      'name: simple\ndescription: "A simple skill"\ntrigger: ["simple"]',
      '# Simple Skill\nDo something simple.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    expect(skills.some((s) => s.name === 'simple')).toBe(true);
  });

  it('loads directory-based skills with SKILL.md', async () => {
    const skillDir = join(BUNDLED_DIR, 'advanced');
    await writeSkillFile(
      skillDir,
      'SKILL.md',
      'name: advanced\ndescription: "An advanced skill"\ntrigger: ["advanced"]',
      '# Advanced Skill\nDo something advanced.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    const advanced = skills.find((s) => s.name === 'advanced');
    expect(advanced).toBeDefined();
    expect(advanced!.dirPath).toBe(skillDir);
  });

  it('loads directory-based skills with fallback .md name', async () => {
    const skillDir = join(BUNDLED_DIR, 'fallback');
    await writeSkillFile(
      skillDir,
      'fallback.md',
      'name: fallback\ndescription: "Fallback skill"\ntrigger: ["fallback"]',
      '# Fallback Skill\nDo something.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    expect(skills.some((s) => s.name === 'fallback')).toBe(true);
  });
});

describe('Skill Loader - Progressive Disclosure', () => {
  it('formatSkillMetadataForPrompt generates metadata list', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'meta.md',
      'name: meta-test\ndescription: "Metadata test"\ntrigger: ["meta"]\nargumentHint: "<arg>"',
      '# Meta Test\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    const meta = formatSkillMetadataForPrompt(skills);

    expect(meta).toContain('<available_skills>');
    expect(meta).toContain('meta-test');
    expect(meta).toContain('Metadata test');
    expect(meta).toContain('<arg>');
    expect(meta).toContain('</available_skills>');
  });

  it('formatSkillMetadataForPrompt excludes disableModelInvocation skills', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'hidden.md',
      'name: hidden\ndescription: "Hidden skill"\ntrigger: ["hidden"]\ndisableModelInvocation: true',
      '# Hidden\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    const meta = formatSkillMetadataForPrompt(skills);

    expect(meta).not.toContain('hidden');
  });

  it('formatSkillInstructionForPrompt generates full instruction', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'instr.md',
      'name: instr-test\ndescription: "Instruction test"\ntrigger: ["instr"]\nallowedTools: ["Read", "Shell"]',
      '# Instruction Test\nFollow these steps.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    const skill = skills.find((s) => s.name === 'instr-test');
    const instr = formatSkillInstructionForPrompt(skill!);

    expect(instr).toContain('SKILL: instr-test');
    expect(instr).toContain('Instruction test');
    expect(instr).toContain('Follow these steps');
    expect(instr).toContain('Read, Shell');
    expect(instr).toContain('INSTRUCTIONS');
  });

  it('loadSkillInstruction loads references from directory', async () => {
    const skillDir = join(BUNDLED_DIR, 'with-refs');
    await writeSkillFile(
      skillDir,
      'SKILL.md',
      'name: with-refs\ndescription: "With refs"\ntrigger: ["refs"]',
      '# With Refs\nContent.',
    );
    await mkdir(join(skillDir, 'references'), { recursive: true });
    await writeFile(join(skillDir, 'references', 'api.md'), '# API Docs', 'utf8');

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    const skill = skills.find((s) => s.name === 'with-refs');
    const instruction = await loadSkillInstruction(skill!);

    expect(instruction.references.length).toBeGreaterThan(0);
    expect(instruction.references[0]).toContain('api.md');
  });

  it('loadSkillResources discovers scripts and templates', async () => {
    const skillDir = join(BUNDLED_DIR, 'with-resources');
    await writeSkillFile(
      skillDir,
      'SKILL.md',
      'name: with-resources\ndescription: "With resources"\ntrigger: ["resources"]',
      '# With Resources\nContent.',
    );
    await mkdir(join(skillDir, 'scripts'), { recursive: true });
    await writeFile(join(skillDir, 'scripts', 'validate.sh'), '#!/bin/bash\necho ok', 'utf8');
    await mkdir(join(skillDir, 'templates'), { recursive: true });
    await writeFile(join(skillDir, 'templates', 'report.md'), '# Report Template', 'utf8');

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    const skill = skills.find((s) => s.name === 'with-resources');
    const resources = await loadSkillResources(skill!);

    expect(resources.some((r) => r.name === 'validate.sh' && r.type === 'script')).toBe(true);
    expect(resources.some((r) => r.name === 'report.md' && r.type === 'file')).toBe(true);
  });
});

describe('Skill Loader - Trigger Mechanisms', () => {
  it('detectRelevantSkills matches by trigger keywords', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'trigger.md',
      'name: trigger-test\ndescription: "Trigger test"\ntrigger: ["deploy", "release"]',
      '# Trigger Test\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const results = detectRelevantSkills('I want to deploy my app');
    expect(results.some((s) => s.name === 'trigger-test')).toBe(true);
  });

  it('detectRelevantSkills matches by paths glob', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'pdf.md',
      'name: pdf-handler\ndescription: "PDF handler"\ntrigger: ["pdf"]\npaths: ["**/*.pdf"]',
      '# PDF Handler\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const results = detectRelevantSkills('Please read the document.pdf file');
    expect(results.some((s) => s.name === 'pdf-handler')).toBe(true);
  });

  it('detectRelevantSkills excludes disableModelInvocation skills', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'internal.md',
      'name: internal\ndescription: "Internal skill"\ntrigger: ["internal"]\ndisableModelInvocation: true',
      '# Internal\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const results = detectRelevantSkills('I need internal help');
    expect(results.some((s) => s.name === 'internal')).toBe(false);
  });

  it('detectUserInvocableSkills returns only user-invocable skills', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'user.md',
      'name: user-skill\ndescription: "User skill"\ntrigger: ["user"]\nuserInvocable: true',
      '# User Skill\nContent.',
    );
    await writeSkillFile(
      BUNDLED_DIR,
      'bg.md',
      'name: bg-skill\ndescription: "Background skill"\ntrigger: ["bg"]\nuserInvocable: false',
      '# BG Skill\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const invocable = detectUserInvocableSkills();
    expect(invocable.some((s) => s.name === 'user-skill')).toBe(true);
    expect(invocable.some((s) => s.name === 'bg-skill')).toBe(false);
  });
});

describe('Skill Loader - findSkillByName', () => {
  it('finds skill by exact name', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'exact.md',
      'name: exact-name\ndescription: "Exact"\ntrigger: ["exact"]',
      '# Exact\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skill = findSkillByName('exact-name');
    expect(skill).toBeDefined();
    expect(skill!.name).toBe('exact-name');
  });

  it('finds skill case-insensitively', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'case.md',
      'name: My-Skill\ndescription: "Case"\ntrigger: ["case"]',
      '# Case\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skill = findSkillByName('my-skill');
    expect(skill).toBeDefined();
  });

  it('returns undefined for unknown skill', async () => {
    await loadSkillsFromPath(BUNDLED_DIR);
    const skill = findSkillByName('non-existent-skill');
    expect(skill).toBeUndefined();
  });
});

describe('Skill Loader - Metadata', () => {
  it('parses new frontmatter fields', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'newfields.md',
      [
        'name: new-fields',
        'description: "New fields test"',
        'trigger: ["new"]',
        'paths: ["**/*.ts"]',
        'userInvocable: true',
        'disableModelInvocation: false',
        'argumentHint: "<type>"',
        'context: fork',
        'agent: explore',
        'allowedTools: ["Read", "SearchFiles"]',
      ].join('\n'),
      '# New Fields\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    const skill = skills.find((s) => s.name === 'new-fields');

    expect(skill).toBeDefined();
    expect(skill!.metadata.paths).toEqual(['**/*.ts']);
    expect(skill!.metadata.userInvocable).toBe(true);
    expect(skill!.metadata.disableModelInvocation).toBe(false);
    expect(skill!.metadata.argumentHint).toBe('<type>');
    expect(skill!.metadata.context).toBe('fork');
    expect(skill!.metadata.agent).toBe('explore');
    expect(skill!.metadata.allowedTools).toEqual(['Read', 'SearchFiles']);
  });

  it('defaults userInvocable to true', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'defaultinv.md',
      'name: default-inv\ndescription: "Default invocable"\ntrigger: ["default"]',
      '# Default\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    const skill = skills.find((s) => s.name === 'default-inv');
    expect(skill!.metadata.userInvocable).toBe(true);
  });

  it('defaults disableModelInvocation to false', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'defaultmodel.md',
      'name: default-model\ndescription: "Default model"\ntrigger: ["default"]',
      '# Default\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    const skill = skills.find((s) => s.name === 'default-model');
    expect(skill!.metadata.disableModelInvocation).toBe(false);
  });
});

describe('Skill Loader - OpenClaw Compatibility', () => {
  it('parses kebab-case frontmatter keys', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'kebab.md',
      [
        'name: kebab-skill',
        'description: "Kebab case test"',
        'trigger: ["kebab"]',
        'user-invocable: false',
        'disable-model-invocation: true',
        'argument-hint: "<arg>"',
        'allowed-tools: ["Read"]',
      ].join('\n'),
      '# Kebab\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    const skill = skills.find((s) => s.name === 'kebab-skill');

    expect(skill).toBeDefined();
    expect(skill!.metadata.userInvocable).toBe(false);
    expect(skill!.metadata.disableModelInvocation).toBe(true);
    expect(skill!.metadata.argumentHint).toBe('<arg>');
    expect(skill!.metadata.allowedTools).toEqual(['Read']);
  });

  it('parses metadata JSON gating', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'gated.md',
      [
        'name: gated-skill',
        'description: "Gated skill"',
        'trigger: ["gated"]',
        'metadata: {"openclaw":{"always":true,"requires":{"bins":["node"]},"emoji":"🚀"}}',
      ].join('\n'),
      '# Gated\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    const skill = skills.find((s) => s.name === 'gated-skill');

    expect(skill).toBeDefined();
    expect(skill!.metadata.gating).toBeDefined();
    expect(skill!.metadata.gating!.always).toBe(true);
    expect(skill!.metadata.gating!.requires?.bins).toEqual(['node']);
    expect(skill!.metadata.gating!.emoji).toBe('🚀');
  });

  it('filters out skills when gating bins not found', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'missingbin.md',
      [
        'name: missing-bin-skill',
        'description: "Missing bin"',
        'trigger: ["missing"]',
        'metadata: {"openclaw":{"requires":{"bins":["nonexistent-cli-tool-xyz"]}}}',
      ].join('\n'),
      '# Missing Bin\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    expect(skills.find((s) => s.name === 'missing-bin-skill')).toBeUndefined();
  });

  it('filters out skills when gating env not set', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'missingenv.md',
      [
        'name: missing-env-skill',
        'description: "Missing env"',
        'trigger: ["missingenv"]',
        'metadata: {"openclaw":{"requires":{"env":["NONEXISTENT_ENV_VAR_XYZ_123"]}}}',
      ].join('\n'),
      '# Missing Env\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    expect(skills.find((s) => s.name === 'missing-env-skill')).toBeUndefined();
  });

  it('allows skills with gating.always=true', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'always.md',
      [
        'name: always-skill',
        'description: "Always available"',
        'trigger: ["always"]',
        'metadata: {"openclaw":{"always":true}}',
      ].join('\n'),
      '# Always\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    expect(skills.find((s) => s.name === 'always-skill')).toBeDefined();
  });

  it('replaces {baseDir} in skill content', async () => {
    const skillDir = join(BUNDLED_DIR, 'basedir-skill');
    await writeSkillFile(
      skillDir,
      'SKILL.md',
      'name: basedir-skill\ndescription: "BaseDir test"\ntrigger: ["basedir"]',
      '# BaseDir\nRun: bash {baseDir}/scripts/run.sh\nRead: {baseDir}/references/api.md',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    const skill = skills.find((s) => s.name === 'basedir-skill');

    expect(skill).toBeDefined();
    expect(skill!.content).not.toContain('{baseDir}');
    expect(skill!.content).toContain(skillDir);
    expect(skill!.content).toContain('scripts/run.sh');
    expect(skill!.content).toContain('references/api.md');
  });

  it('does not replace {baseDir} when no dirPath', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'nobasedir.md',
      'name: nobasedir-skill\ndescription: "No baseDir"\ntrigger: ["nobasedir"]',
      '# No BaseDir\n{baseDir} should remain as-is.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    const skill = skills.find((s) => s.name === 'nobasedir-skill');

    expect(skill).toBeDefined();
    expect(skill!.content).toContain('{baseDir}');
  });

  it('parses homepage and command-dispatch fields', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'dispatch.md',
      [
        'name: dispatch-skill',
        'description: "Dispatch test"',
        'trigger: ["dispatch"]',
        'homepage: "https://example.com"',
        'command-dispatch: tool',
        'command-tool: Bash',
        'command-arg-mode: raw',
      ].join('\n'),
      '# Dispatch\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    const skill = skills.find((s) => s.name === 'dispatch-skill');

    expect(skill).toBeDefined();
    expect(skill!.metadata.homepage).toBe('https://example.com');
    expect(skill!.metadata.commandDispatch).toBe('tool');
    expect(skill!.metadata.commandTool).toBe('Bash');
    expect(skill!.metadata.commandArgMode).toBe('raw');
  });

  it('triggers by description semantic match', async () => {
    await writeSkillFile(
      BUNDLED_DIR,
      'semantic.md',
      'name: semantic-skill\ndescription: "Extract and analyze text from PDF documents"\ntrigger: []',
      '# Semantic\nContent.',
    );

    await loadSkillsFromPath(BUNDLED_DIR);
    const results = detectRelevantSkills('I need to extract text from a PDF document');
    expect(results.some((s) => s.name === 'semantic-skill')).toBe(true);
  });

  it('discovers assets directory resources', async () => {
    const skillDir = join(BUNDLED_DIR, 'assets-skill');
    await writeSkillFile(
      skillDir,
      'SKILL.md',
      'name: assets-skill\ndescription: "Assets test"\ntrigger: ["assets"]',
      '# Assets\nContent.',
    );
    await mkdir(join(skillDir, 'assets'), { recursive: true });
    await writeFile(join(skillDir, 'assets', 'logo.png'), 'fake-png', 'utf8');

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    const skill = skills.find((s) => s.name === 'assets-skill');
    const resources = await loadSkillResources(skill!);

    expect(resources.some((r) => r.name === 'logo.png' && r.type === 'file')).toBe(true);
  });

  it('discovers examples directory resources', async () => {
    const skillDir = join(BUNDLED_DIR, 'examples-skill');
    await writeSkillFile(
      skillDir,
      'SKILL.md',
      'name: examples-skill\ndescription: "Examples test"\ntrigger: ["examples"]',
      '# Examples\nContent.',
    );
    await mkdir(join(skillDir, 'examples'), { recursive: true });
    await writeFile(join(skillDir, 'examples', 'sample.md'), '# Sample', 'utf8');

    await loadSkillsFromPath(BUNDLED_DIR);
    const skills = getLoadedSkills();
    const skill = skills.find((s) => s.name === 'examples-skill');
    const resources = await loadSkillResources(skill!);

    expect(resources.some((r) => r.name === 'sample.md' && r.type === 'file')).toBe(true);
  });
});
