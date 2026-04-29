import { describe, it, expect } from 'bun:test';
import { createInitialAppState } from '../../../runtime/state';

describe('state', () => {
  describe('createInitialAppState', () => {
    it('returns correct default permission mode', () => {
      const state = createInitialAppState();
      expect(state.permissionContext.mode).toBe('default');
    });

    it('initializes empty allowRules array', () => {
      const state = createInitialAppState();
      expect(state.permissionContext.allowRules).toEqual([]);
    });

    it('initializes empty denyRules array', () => {
      const state = createInitialAppState();
      expect(state.permissionContext.denyRules).toEqual([]);
    });

    it('initializes empty askRules array', () => {
      const state = createInitialAppState();
      expect(state.permissionContext.askRules).toEqual([]);
    });

    it('initializes empty messages array', () => {
      const state = createInitialAppState();
      expect(state.messages).toEqual([]);
    });

    it('initializes empty tasks object', () => {
      const state = createInitialAppState();
      expect(state.tasks).toEqual({});
    });

    it('returns complete AppState structure', () => {
      const state = createInitialAppState();
      expect(state).toHaveProperty('permissionContext');
      expect(state).toHaveProperty('messages');
      expect(state).toHaveProperty('tasks');
      expect(typeof state.permissionContext.mode).toBe('string');
      expect(Array.isArray(state.permissionContext.allowRules)).toBe(true);
      expect(Array.isArray(state.permissionContext.denyRules)).toBe(true);
      expect(Array.isArray(state.permissionContext.askRules)).toBe(true);
      expect(Array.isArray(state.messages)).toBe(true);
      expect(typeof state.tasks).toBe('object');
    });

    it('creates independent state instances', () => {
      const state1 = createInitialAppState();
      const state2 = createInitialAppState();

      // Modifying one should not affect the other
      state1.permissionContext.allowRules.push({ rule: 'test' });
      expect(state2.permissionContext.allowRules).toEqual([]);

      state1.messages.push({ id: 'msg-1', type: 'user', content: 'hello' });
      expect(state2.messages).toEqual([]);
    });
  });
});
