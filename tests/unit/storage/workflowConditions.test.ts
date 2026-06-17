import { describe, it, expect } from 'bun:test';
import { parseWorkflowYaml } from '../../../storage/workflowIndex';

describe('Workflow Conditions & Loops', () => {
  describe('parseWorkflowYaml with conditions', () => {
    it('parses step_result condition', () => {
      const yaml = `
name: test-workflow
steps:
  - id: step1
    name: Step 1
  - id: step2
    name: Step 2
    depends_on: [step1]
    condition:
      type: step_result
      source: step1
      field: status
      equals: "success"
`;
      const workflow = parseWorkflowYaml(yaml);
      expect(workflow.steps).toHaveLength(2);
      expect(workflow.steps[1].condition).toEqual({
        type: 'step_result',
        source: 'step1',
        field: 'status',
        equals: 'success',
      });
    });

    it('parses llm_judge condition', () => {
      const yaml = `
name: test-workflow
steps:
  - id: step1
    name: Step 1
  - id: decision
    name: Smart Decision
    depends_on: [step1]
    condition:
      type: llm_judge
      prompt: "What should we do next?"
      options: ["retry", "skip", "abort"]
`;
      const workflow = parseWorkflowYaml(yaml);
      expect(workflow.steps[1].condition).toEqual({
        type: 'llm_judge',
        source: undefined,
        field: 'status',
        equals: undefined,
        prompt: 'What should we do next?',
        options: ['retry', 'skip', 'abort'],
      });
    });

    it('defaults condition type to step_result', () => {
      const yaml = `
name: test-workflow
steps:
  - id: step1
    name: Step 1
  - id: step2
    name: Step 2
    condition:
      source: step1
      equals: "success"
`;
      const workflow = parseWorkflowYaml(yaml);
      expect(workflow.steps[1].condition!.type).toBe('step_result');
    });

    it('sets condition to undefined when not provided', () => {
      const yaml = `
name: test-workflow
steps:
  - id: step1
    name: Step 1
`;
      const workflow = parseWorkflowYaml(yaml);
      expect(workflow.steps[0].condition).toBeUndefined();
    });
  });

  describe('parseWorkflowYaml with loops', () => {
    it('parses loop configuration', () => {
      const yaml = `
name: test-workflow
steps:
  - id: align
    name: Align
  - id: inspect
    name: Inspect
  - id: retry_flow
    name: Retry Flow
    loop:
      max: 3
      steps: [align, inspect]
      until:
        type: step_result
        source: inspect
        field: status
        equals: "success"
      on_exhausted: abort
`;
      const workflow = parseWorkflowYaml(yaml);
      expect(workflow.steps[2].loop).toEqual({
        max: 3,
        steps: ['align', 'inspect'],
        until: {
          type: 'step_result',
          source: 'inspect',
          field: 'status',
          equals: 'success',
        },
        onExhausted: 'abort',
      });
    });

    it('defaults loop max to 3', () => {
      const yaml = `
name: test-workflow
steps:
  - id: step1
    name: Step 1
    loop:
      steps: [step1]
`;
      const workflow = parseWorkflowYaml(yaml);
      expect(workflow.steps[0].loop!.max).toBe(3);
    });

    it('defaults onExhausted to abort', () => {
      const yaml = `
name: test-workflow
steps:
  - id: step1
    name: Step 1
    loop:
      max: 5
      steps: [step1]
`;
      const workflow = parseWorkflowYaml(yaml);
      expect(workflow.steps[0].loop!.onExhausted).toBe('abort');
    });

    it('supports on_exhausted snake_case', () => {
      const yaml = `
name: test-workflow
steps:
  - id: step1
    name: Step 1
    loop:
      max: 2
      steps: [step1]
      on_exhausted: skip
`;
      const workflow = parseWorkflowYaml(yaml);
      expect(workflow.steps[0].loop!.onExhausted).toBe('skip');
    });

    it('sets loop to undefined when not provided', () => {
      const yaml = `
name: test-workflow
steps:
  - id: step1
    name: Step 1
`;
      const workflow = parseWorkflowYaml(yaml);
      expect(workflow.steps[0].loop).toBeUndefined();
    });
  });

  describe('Combined conditions and loops', () => {
    it('parses both condition and loop on same step', () => {
      const yaml = `
name: test-workflow
steps:
  - id: check
    name: Check
  - id: retry_align
    name: Retry Align
    depends_on: [check]
    condition:
      type: step_result
      source: check
      field: status
      equals: "failure"
    loop:
      max: 3
      steps: [retry_align]
      until:
        type: step_result
        source: retry_align
        field: status
        equals: "success"
`;
      const workflow = parseWorkflowYaml(yaml);
      const step = workflow.steps[1];
      expect(step.condition).toBeDefined();
      expect(step.loop).toBeDefined();
      expect(step.condition!.type).toBe('step_result');
      expect(step.loop!.max).toBe(3);
    });
  });
});
