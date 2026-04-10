import { describe, it, expect } from 'bun:test';
import { getTools } from '../../../tools/registry';

describe('tools registry', () => {
  describe('getTools', () => {
    it('returns an array of tools', () => {
      const tools = getTools();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('returns the expected number of tools (6)', () => {
      const tools = getTools();
      expect(tools).toHaveLength(6);
    });

    it('includes ReadTool', () => {
      const tools = getTools();
      const readTool = tools.find(t => t.name === 'Read');
      expect(readTool).toBeDefined();
      expect(readTool?.name).toBe('Read');
    });

    it('includes WriteTool', () => {
      const tools = getTools();
      const writeTool = tools.find(t => t.name === 'Write');
      expect(writeTool).toBeDefined();
      expect(writeTool?.name).toBe('Write');
    });

    it('includes EditTool', () => {
      const tools = getTools();
      const editTool = tools.find(t => t.name === 'Edit');
      expect(editTool).toBeDefined();
      expect(editTool?.name).toBe('Edit');
    });

    it('includes ShellTool', () => {
      const tools = getTools();
      const shellTool = tools.find(t => t.name === 'Shell');
      expect(shellTool).toBeDefined();
      expect(shellTool?.name).toBe('Shell');
    });

    it('includes WebFetchTool', () => {
      const tools = getTools();
      const fetchTool = tools.find(t => t.name === 'WebFetch');
      expect(fetchTool).toBeDefined();
      expect(fetchTool?.name).toBe('WebFetch');
    });

    it('includes AgentTool', () => {
      const tools = getTools();
      const agentTool = tools.find(t => t.name === 'Agent');
      expect(agentTool).toBeDefined();
      expect(agentTool?.name).toBe('Agent');
    });

    it('each tool has required properties (name, call, validateInput, checkPermissions)', () => {
      const tools = getTools();
      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.call).toBe('function');
        expect(typeof tool.validateInput).toBe('function');
        expect(typeof tool.checkPermissions).toBe('function');
      }
    });

    it('each tool has isReadOnly method', () => {
      const tools = getTools();
      for (const tool of tools) {
        expect(typeof tool.isReadOnly).toBe('function');
      }
    });

    it('ReadTool is read-only', () => {
      const tools = getTools();
      const readTool = tools.find(t => t.name === 'Read')!;
      expect(readTool.isReadOnly()).toBe(true);
    });

    it('WriteTool is not read-only (writes)', () => {
      const tools = getTools();
      const writeTool = tools.find(t => t.name === 'Write')!;
      expect(writeTool.isReadOnly()).toBe(false);
    });

    it('EditTool is not read-only (modifies files)', () => {
      const tools = getTools();
      const editTool = tools.find(t => t.name === 'Edit')!;
      expect(editTool.isReadOnly()).toBe(false);
    });

    it('ShellTool is not read-only (executes commands)', () => {
      const tools = getTools();
      const shellTool = tools.find(t => t.name === 'Shell')!;
      expect(shellTool.isReadOnly()).toBe(false);
    });

    it('WebFetchTool is read-only', () => {
      const tools = getTools();
      const fetchTool = tools.find(t => t.name === 'WebFetch')!;
      expect(fetchTool.isReadOnly()).toBe(true);
    });

    it('AgentTool has a description method', async () => {
      const tools = getTools();
      const agentTool = tools.find(t => t.name === 'Agent')!;
      const desc = await agentTool.description();
      expect(typeof desc).toBe('string');
    });
  });

  describe('tool concurrency safety', () => {
    it('ReadTool is concurrency safe', () => {
      const tools = getTools();
      const readTool = tools.find(t => t.name === 'Read')!;
      expect(readTool.isConcurrencySafe()).toBe(true);
    });

    it('WriteTool is concurrency safe (writes to different paths)', () => {
      const tools = getTools();
      const writeTool = tools.find(t => t.name === 'Write')!;
      expect(writeTool.isConcurrencySafe()).toBe(true);
    });

    it('EditTool is concurrency safe (edits at specific paths)', () => {
      const tools = getTools();
      const editTool = tools.find(t => t.name === 'Edit')!;
      expect(editTool.isConcurrencySafe()).toBe(true);
    });

    it('ShellTool is not concurrency safe (side effects)', () => {
      const tools = getTools();
      const shellTool = tools.find(t => t.name === 'Shell')!;
      expect(shellTool.isConcurrencySafe()).toBe(false);
    });

    it('WebFetchTool is concurrency safe', () => {
      const tools = getTools();
      const fetchTool = tools.find(t => t.name === 'WebFetch')!;
      expect(fetchTool.isConcurrencySafe()).toBe(true);
    });
  });
});
