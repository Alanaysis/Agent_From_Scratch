import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  listTemplates,
  findTemplates,
  getTemplate,
  saveTemplate,
  formatTemplatesForPrompt,
  type WorkflowTemplate,
} from '../../../storage/templateIndex';

describe('Template Library', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'template-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const sampleTemplate: WorkflowTemplate = {
    id: 'test-template',
    name: 'Test Alignment',
    description: 'Test wafer alignment flow',
    tags: ['alignment', 'test'],
    steps: [
      { id: 'step1', name: 'Step 1' },
      { id: 'step2', name: 'Step 2', dependsOn: ['step1'] },
    ],
    useCase: 'When user wants to test alignment',
    requiredParams: [
      { name: 'wafer_id', label: 'Wafer ID', type: 'text' },
    ],
    createdAt: '',
    updatedAt: '',
  };

  describe('saveTemplate', () => {
    it('creates template file in .irg/templates/', async () => {
      await saveTemplate(tempDir, sampleTemplate);
      const content = await fs.readFile(
        path.join(tempDir, '.irg', 'templates', 'test-template.yaml'),
        'utf8',
      );
      expect(content).toContain('Test Alignment');
      expect(content).toContain('alignment');
    });

    it('creates directory if it does not exist', async () => {
      await saveTemplate(tempDir, sampleTemplate);
      const stat = await fs.stat(path.join(tempDir, '.irg', 'templates'));
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe('listTemplates', () => {
    it('returns empty array when no templates exist', async () => {
      const templates = await listTemplates(tempDir);
      expect(templates).toEqual([]);
    });

    it('lists saved templates', async () => {
      await saveTemplate(tempDir, sampleTemplate);
      const templates = await listTemplates(tempDir);
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('Test Alignment');
    });

    it('lists multiple templates sorted by name', async () => {
      await saveTemplate(tempDir, { ...sampleTemplate, id: 'b-template', name: 'B Template' });
      await saveTemplate(tempDir, { ...sampleTemplate, id: 'a-template', name: 'A Template' });
      const templates = await listTemplates(tempDir);
      expect(templates).toHaveLength(2);
      expect(templates[0].name).toBe('A Template');
      expect(templates[1].name).toBe('B Template');
    });

    it('skips invalid YAML files', async () => {
      const dir = path.join(tempDir, '.irg', 'templates');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'invalid.yaml'), 'not: valid: yaml: [', 'utf8');
      await saveTemplate(tempDir, sampleTemplate);
      const templates = await listTemplates(tempDir);
      expect(templates).toHaveLength(1);
    });
  });

  describe('findTemplates', () => {
    beforeEach(async () => {
      await saveTemplate(tempDir, sampleTemplate);
      await saveTemplate(tempDir, {
        ...sampleTemplate,
        id: 'inspection',
        name: 'Inspection Flow',
        description: 'Run inspection on wafer',
        tags: ['inspection', 'wafer'],
      });
    });

    it('finds template by name', async () => {
      const results = await findTemplates(tempDir, 'alignment');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toBe('Test Alignment');
    });

    it('finds template by tag', async () => {
      const results = await findTemplates(tempDir, 'inspection');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toBe('Inspection Flow');
    });

    it('finds template by description', async () => {
      const results = await findTemplates(tempDir, 'wafer alignment');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty for no matches', async () => {
      const results = await findTemplates(tempDir, 'nonexistent_xyz');
      expect(results).toHaveLength(0);
    });

    it('ranks exact name match highest', async () => {
      const results = await findTemplates(tempDir, 'Inspection Flow');
      expect(results[0].name).toBe('Inspection Flow');
    });
  });

  describe('getTemplate', () => {
    it('returns template by ID', async () => {
      await saveTemplate(tempDir, sampleTemplate);
      const template = await getTemplate(tempDir, 'test-template');
      expect(template).not.toBeNull();
      expect(template!.name).toBe('Test Alignment');
    });

    it('returns null for non-existent template', async () => {
      const template = await getTemplate(tempDir, 'nonexistent');
      expect(template).toBeNull();
    });
  });

  describe('formatTemplatesForPrompt', () => {
    it('returns empty string for empty array', () => {
      expect(formatTemplatesForPrompt([])).toBe('');
    });

    it('formats templates with tags and use case', () => {
      const formatted = formatTemplatesForPrompt([sampleTemplate]);
      expect(formatted).toContain('<available_templates>');
      expect(formatted).toContain('</available_templates>');
      expect(formatted).toContain('Test Alignment');
      expect(formatted).toContain('alignment, test');
      expect(formatted).toContain('When user wants to test alignment');
      expect(formatted).toContain('Steps: 2');
    });

    it('formats multiple templates', () => {
      const formatted = formatTemplatesForPrompt([
        sampleTemplate,
        { ...sampleTemplate, id: 'other', name: 'Other Template' },
      ]);
      expect(formatted).toContain('Test Alignment');
      expect(formatted).toContain('Other Template');
    });
  });
});
