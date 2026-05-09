import { describe, it, expect } from 'bun:test';
import {
  DEFAULT_EVOLUTION_CONFIG,
  type EvolutionConfig,
} from '../../../runtime/evolution';

describe('Evolution Orchestrator', () => {
  describe('DEFAULT_EVOLUTION_CONFIG', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_EVOLUTION_CONFIG.enabled).toBe(true);
      expect(DEFAULT_EVOLUTION_CONFIG.reflectionOnError).toBe(true);
      expect(DEFAULT_EVOLUTION_CONFIG.reflectionOnComplete).toBe(false);
      expect(DEFAULT_EVOLUTION_CONFIG.skillAutoCreate).toBe(true);
      expect(DEFAULT_EVOLUTION_CONFIG.skillAutoRefine).toBe(true);
      expect(DEFAULT_EVOLUTION_CONFIG.maxKnowledgeEntries).toBe(100);
      expect(DEFAULT_EVOLUTION_CONFIG.knowledgeCharLimit).toBe(500);
      expect(DEFAULT_EVOLUTION_CONFIG.skillRefineThreshold).toBe(10);
      expect(DEFAULT_EVOLUTION_CONFIG.decayIntervalDays).toBe(30);
    });
  });

  describe('EvolutionConfig type', () => {
    it('allows custom configuration', () => {
      const custom: EvolutionConfig = {
        ...DEFAULT_EVOLUTION_CONFIG,
        enabled: false,
        maxKnowledgeEntries: 50,
      };
      expect(custom.enabled).toBe(false);
      expect(custom.maxKnowledgeEntries).toBe(50);
    });
  });
});
