import { describe, it, expect } from 'bun:test';
import {
  BUILTIN_TEAMS,
  getTeamDefinition,
  getToolDefsForTeamMember,
  type TeamMemberDefinition,
} from '../../../../tools/agent/team';

describe('team', () => {
  describe('BUILTIN_TEAMS', () => {
    it('contains code-review team', () => {
      expect(BUILTIN_TEAMS['code-review']).toBeDefined();
      expect(BUILTIN_TEAMS['code-review']!.name).toBe('code-review');
    });

    it('contains research team', () => {
      expect(BUILTIN_TEAMS['research']).toBeDefined();
      expect(BUILTIN_TEAMS['research']!.name).toBe('research');
    });

    it('all teams have lead and members', () => {
      for (const team of Object.values(BUILTIN_TEAMS)) {
        expect(team.lead).toBeDefined();
        expect(team.lead.name).toBeTruthy();
        expect(team.lead.systemPrompt).toBeInstanceOf(Array);
        expect(team.members).toBeInstanceOf(Array);
        expect(team.members.length).toBeGreaterThan(0);
      }
    });

    it('code-review team has security and performance reviewers', () => {
      const team = BUILTIN_TEAMS['code-review']!;
      const memberNames = team.members.map((m) => m.name);
      expect(memberNames).toContain('security-reviewer');
      expect(memberNames).toContain('performance-reviewer');
    });

    it('research team has codebase and documentation analysts', () => {
      const team = BUILTIN_TEAMS['research']!;
      const memberNames = team.members.map((m) => m.name);
      expect(memberNames).toContain('codebase-analyst');
      expect(memberNames).toContain('documentation-analyst');
    });

    it('all team members have blocked tools excluded from allowedTools', () => {
      for (const team of Object.values(BUILTIN_TEAMS)) {
        for (const member of [team.lead, ...team.members]) {
          if (Array.isArray(member.allowedTools)) {
            expect(member.allowedTools).not.toContain('Agent');
            expect(member.allowedTools).not.toContain('Team');
          }
        }
      }
    });
  });

  describe('getTeamDefinition', () => {
    it('returns null for undefined', () => {
      expect(getTeamDefinition(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(getTeamDefinition('')).toBeNull();
    });

    it('returns null for whitespace', () => {
      expect(getTeamDefinition('   ')).toBeNull();
    });

    it('returns code-review team', () => {
      const team = getTeamDefinition('code-review');
      expect(team).not.toBeNull();
      expect(team!.name).toBe('code-review');
    });

    it('returns research team', () => {
      const team = getTeamDefinition('research');
      expect(team).not.toBeNull();
      expect(team!.name).toBe('research');
    });

    it('is case-insensitive', () => {
      const team = getTeamDefinition('Code-Review');
      expect(team).not.toBeNull();
    });

    it('returns null for unknown team', () => {
      expect(getTeamDefinition('unknown-team')).toBeNull();
    });
  });

  describe('getToolDefsForTeamMember', () => {
    const allToolDefs = [
      { name: 'Read', description: 'Read', parameters: {} },
      { name: 'Write', description: 'Write', parameters: {} },
      { name: 'Agent', description: 'Agent', parameters: {} },
      { name: 'Team', description: 'Team', parameters: {} },
    ];

    it('filters out Agent and Team for wildcard member', () => {
      const member: TeamMemberDefinition = {
        name: 'test',
        role: 'test',
        description: 'test',
        systemPrompt: [],
        allowedTools: '*',
      };
      const result = getToolDefsForTeamMember(member, allToolDefs);
      const names = result.map((t) => t.name);
      expect(names).not.toContain('Agent');
      expect(names).not.toContain('Team');
      expect(names).toContain('Read');
      expect(names).toContain('Write');
    });

    it('filters to allowed tools only', () => {
      const member: TeamMemberDefinition = {
        name: 'test',
        role: 'test',
        description: 'test',
        systemPrompt: [],
        allowedTools: ['Read'],
      };
      const result = getToolDefsForTeamMember(member, allToolDefs);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Read');
    });

    it('excludes Agent and Team from specific allowedTools', () => {
      const member: TeamMemberDefinition = {
        name: 'test',
        role: 'test',
        description: 'test',
        systemPrompt: [],
        allowedTools: ['Read', 'Agent', 'Team'],
      };
      const result = getToolDefsForTeamMember(member, allToolDefs);
      const names = result.map((t) => t.name);
      expect(names).toContain('Read');
      expect(names).not.toContain('Agent');
      expect(names).not.toContain('Team');
    });
  });
});
