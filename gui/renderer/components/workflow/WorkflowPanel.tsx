import React from 'react';
import { useGlobalStore } from '../../state/globalStore';
import { WorkflowStep } from './WorkflowStep';
import type { WorkflowStepId } from '../../state/types';

const STEP_ORDER: { id: WorkflowStepId; label: string }[] = [
  { id: 'loadGDS', label: 'Load GDS' },
  { id: 'layerAnalysis', label: 'Layer Analysis' },
  { id: 'waferAlignment', label: 'Wafer Alignment' },
  { id: 'roiGeneration', label: 'ROI Generation' },
  { id: 'pilotRun', label: 'Pilot Run' },
  { id: 'sensitivityOptimization', label: 'Sensitivity Optimization' },
  { id: 'exportRecipe', label: 'Export Recipe' },
];

export function WorkflowPanel() {
  const currentStep = useGlobalStore((s) => s.workflow);
  const transitionWorkflow = useGlobalStore((s) => s.transitionWorkflow);

  const getStepStatus = (stepId: WorkflowStepId): 'completed' | 'active' | 'pending' => {
    const currentIdx = STEP_ORDER.findIndex((s) => s.id === currentStep);
    const stepIdx = STEP_ORDER.findIndex((s) => s.id === stepId);
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  };

  return (
    <div style={{ padding: '12px 0' }}>
      {STEP_ORDER.map((step, index) => (
        <WorkflowStep
          key={step.id}
          label={step.label}
          status={getStepStatus(step.id)}
          isLast={index === STEP_ORDER.length - 1}
          onClick={() => transitionWorkflow(step.id)}
        />
      ))}

      <div
        style={{
          margin: '20px 12px 0',
          padding: '10px 12px',
          background: 'var(--bg-panel-alt)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 6,
          }}
        >
          Progress
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              flex: 1,
              height: 4,
              background: 'var(--border)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${((STEP_ORDER.findIndex((s) => s.id === currentStep) + 1) / STEP_ORDER.length) * 100}%`,
                height: '100%',
                background: 'var(--accent)',
                borderRadius: 2,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {STEP_ORDER.findIndex((s) => s.id === currentStep) + 1}/{STEP_ORDER.length}
          </span>
        </div>
      </div>
    </div>
  );
}
