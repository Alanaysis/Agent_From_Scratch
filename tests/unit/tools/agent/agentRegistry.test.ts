import { describe, it, expect } from 'bun:test';
import {
  BUILTIN_AGENTS,
  getAgentDefinition,
  getToolDefinitionsForAgent,
  type AgentDefinition,
} from '../../../../tools/agent/agentRegistry';

describe('agentRegistry', () => {
  describe('BUILTIN_AGENTS', () => {
    it('contains general-purpose agent', () => {
      expect(BUILTIN_AGENTS['general-purpose']).toBeDefined();
      expect(BUILTIN_AGENTS['general-purpose']!.name).toBe('general-purpose');
    });

    it('contains explore agent', () => {
      expect(BUILTIN_AGENTS['explore']).toBeDefined();
      expect(BUILTIN_AGENTS['explore']!.name).toBe('explore');
      expect(BUILTIN_AGENTS['explore']!.isReadOnly).toBe(true);
    });

    it('contains plan agent', () => {
      expect(BUILTIN_AGENTS['plan']).toBeDefined();
      expect(BUILTIN_AGENTS['plan']!.name).toBe('plan');
      expect(BUILTIN_AGENTS['plan']!.isReadOnly).toBe(true);
    });

    it('all agents have required fields', () => {
      for (const agent of Object.values(BUILTIN_AGENTS)) {
        expect(agent.name).toBeTruthy();
        expect(agent.description).toBeTruthy();
        expect(agent.systemPrompt).toBeInstanceOf(Array);
        expect(agent.systemPrompt.length).toBeGreaterThan(0);
        expect(agent.allowedTools).toBeDefined();
      }
    });

    it('explore agent has read-only tools', () => {
      const explore = BUILTIN_AGENTS['explore']!;
      expect(explore.allowedTools).not.toBe('*');
      expect((explore.allowedTools as string[]).includes('Read')).toBe(true);
      expect((explore.allowedTools as string[]).includes('Write')).toBe(false);
      expect((explore.allowedTools as string[]).includes('Edit')).toBe(false);
    });

    it('general-purpose agent has all tools', () => {
      const gp = BUILTIN_AGENTS['general-purpose']!;
      expect(gp.allowedTools).toBe('*');
    });
  });

  describe('getAgentDefinition', () => {
    it('returns general-purpose for undefined', () => {
      const def = getAgentDefinition(undefined);
      expect(def.name).toBe('general-purpose');
    });

    it('returns general-purpose for empty string', () => {
      const def = getAgentDefinition('');
      expect(def.name).toBe('general-purpose');
    });

    it('returns general-purpose for whitespace', () => {
      const def = getAgentDefinition('   ');
      expect(def.name).toBe('general-purpose');
    });

    it('returns explore for explore type', () => {
      const def = getAgentDefinition('explore');
      expect(def.name).toBe('explore');
    });

    it('returns plan for plan type', () => {
      const def = getAgentDefinition('plan');
      expect(def.name).toBe('plan');
    });

    it('is case-insensitive', () => {
      const def = getAgentDefinition('Explore');
      expect(def.name).toBe('explore');
    });

    it('returns general-purpose for unknown type', () => {
      const def = getAgentDefinition('unknown-agent');
      expect(def.name).toBe('general-purpose');
    });
  });

  describe('getToolDefinitionsForAgent', () => {
    const allToolDefs = [
      { name: 'Read', description: 'Read', parameters: {} },
      { name: 'Write', description: 'Write', parameters: {} },
      { name: 'Agent', description: 'Agent', parameters: {} },
      { name: 'Team', description: 'Team', parameters: {} },
    ];

    it('filters out Agent and Team tools for general-purpose', () => {
      const agentDef = BUILTIN_AGENTS['general-purpose']!;
      const result = getToolDefinitionsForAgent(agentDef, allToolDefs);
      const names = result.map((t) => t.name);
      expect(names).not.toContain('Agent');
      expect(names).not.toContain('Team');
      expect(names).toContain('Read');
      expect(names).toContain('Write');
    });

    it('filters to allowed tools only for explore', () => {
      const agentDef = BUILTIN_AGENTS['explore']!;
      const result = getToolDefinitionsForAgent(agentDef, allToolDefs);
      const names = result.map((t) => t.name);
      expect(names).toContain('Read');
      expect(names).not.toContain('Write');
      expect(names).not.toContain('Agent');
      expect(names).not.toContain('Team');
    });

    it('returns empty array when no tools match', () => {
      const agentDef: AgentDefinition = {
        name: 'test',
        description: 'test',
        systemPrompt: [],
        allowedTools: ['NonExistent'],
      };
      const result = getToolDefinitionsForAgent(agentDef, allToolDefs);
      expect(result).toHaveLength(0);
    });
  });
});
