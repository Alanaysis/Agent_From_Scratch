import { describe, it, expect } from 'bun:test';
import { SkillTool, type SkillToolInput } from '../../../skills/skillTool';

describe('SkillTool', () => {
  it('has correct tool properties', () => {
    expect(SkillTool.name).toBe('Skill');
    expect(SkillTool.isReadOnly()).toBe(true);
    expect(SkillTool.isConcurrencySafe()).toBe(true);
  });

  it('validates empty command', async () => {
    const result = await SkillTool.validateInput({ command: '' });
    expect(result.result).toBe(false);
  });

  it('validates whitespace command', async () => {
    const result = await SkillTool.validateInput({ command: '   ' });
    expect(result.result).toBe(false);
  });

  it('accepts valid command', async () => {
    const result = await SkillTool.validateInput({ command: 'github' });
    expect(result.result).toBe(true);
  });

  it('accepts command with arguments', async () => {
    const result = await SkillTool.validateInput({ command: 'recipe-setup', arguments: 'node' });
    expect(result.result).toBe(true);
  });

  it('checkPermissions always allows', async () => {
    const mockContext = {
      getAppState: () => ({
        permissionContext: { mode: 'default' as const, allowRules: [], denyRules: [], askRules: [] },
      }),
    };
    const result = await SkillTool.checkPermissions({ command: 'test' }, mockContext as any);
    expect(result.behavior).toBe('allow');
  });
});
