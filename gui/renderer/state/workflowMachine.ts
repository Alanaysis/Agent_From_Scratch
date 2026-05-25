import { createMachine, assign } from 'xstate';
import type { WorkflowStepId } from './types';

type WorkflowContext = {
  currentStep: WorkflowStepId;
  completedSteps: WorkflowStepId[];
};

type WorkflowEvent =
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'COMPLETE' }
  | { type: 'JUMP_TO'; step: WorkflowStepId };

const STEP_ORDER: WorkflowStepId[] = [
  'loadGDS',
  'layerAnalysis',
  'waferAlignment',
  'roiGeneration',
  'pilotRun',
  'sensitivityOptimization',
  'exportRecipe',
];

function getNextStep(current: WorkflowStepId): WorkflowStepId | undefined {
  const idx = STEP_ORDER.indexOf(current);
  return idx < STEP_ORDER.length - 1 ? STEP_ORDER[idx + 1] : undefined;
}

function getPrevStep(current: WorkflowStepId): WorkflowStepId | undefined {
  const idx = STEP_ORDER.indexOf(current);
  return idx > 0 ? STEP_ORDER[idx - 1] : undefined;
}

export const workflowMachine = createMachine({
  types: {} as {
    context: WorkflowContext;
    events: WorkflowEvent;
  },
  id: 'recipeWorkflow',
  initial: 'roiGeneration',
  context: {
    currentStep: 'roiGeneration',
    completedSteps: ['loadGDS', 'layerAnalysis', 'waferAlignment'],
  },
  states: {
    loadGDS: {
      on: {
        NEXT: { target: 'layerAnalysis', guard: 'canAdvance' },
        COMPLETE: {
          target: 'layerAnalysis',
          actions: 'markComplete',
          guard: 'canAdvance',
        },
      },
    },
    layerAnalysis: {
      on: {
        NEXT: { target: 'waferAlignment', guard: 'canAdvance' },
        BACK: { target: 'loadGDS' },
        COMPLETE: {
          target: 'waferAlignment',
          actions: 'markComplete',
          guard: 'canAdvance',
        },
      },
    },
    waferAlignment: {
      on: {
        NEXT: { target: 'roiGeneration', guard: 'canAdvance' },
        BACK: { target: 'layerAnalysis' },
        COMPLETE: {
          target: 'roiGeneration',
          actions: 'markComplete',
          guard: 'canAdvance',
        },
      },
    },
    roiGeneration: {
      on: {
        NEXT: { target: 'pilotRun', guard: 'canAdvance' },
        BACK: { target: 'waferAlignment' },
        COMPLETE: {
          target: 'pilotRun',
          actions: 'markComplete',
          guard: 'canAdvance',
        },
      },
    },
    pilotRun: {
      on: {
        NEXT: { target: 'sensitivityOptimization', guard: 'canAdvance' },
        BACK: { target: 'roiGeneration' },
        COMPLETE: {
          target: 'sensitivityOptimization',
          actions: 'markComplete',
          guard: 'canAdvance',
        },
      },
    },
    sensitivityOptimization: {
      on: {
        NEXT: { target: 'exportRecipe', guard: 'canAdvance' },
        BACK: { target: 'pilotRun' },
        COMPLETE: {
          target: 'exportRecipe',
          actions: 'markComplete',
          guard: 'canAdvance',
        },
      },
    },
    exportRecipe: {
      on: {
        BACK: { target: 'sensitivityOptimization' },
      },
    },
  },
}).provide({
  guards: {
    canAdvance: ({ context }) => {
      const idx = STEP_ORDER.indexOf(context.currentStep);
      return idx < STEP_ORDER.length - 1;
    },
  },
  actions: {
    markComplete: assign(({ context }) => {
      const current = context.currentStep;
      const completed = context.completedSteps.includes(current)
        ? context.completedSteps
        : [...context.completedSteps, current];
      const next = getNextStep(current);
      return {
        completedSteps: completed,
        currentStep: next ?? current,
      };
    }),
  },
});
