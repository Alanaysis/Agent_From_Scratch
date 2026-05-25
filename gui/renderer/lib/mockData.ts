export const MOCK_WORKFLOW_STEPS = [
  { id: 'loadGDS', label: 'Load GDS', status: 'completed' as const },
  { id: 'layerAnalysis', label: 'Layer Analysis', status: 'completed' as const },
  { id: 'waferAlignment', label: 'Wafer Alignment', status: 'completed' as const },
  { id: 'roiGeneration', label: 'ROI Generation', status: 'active' as const },
  { id: 'pilotRun', label: 'Pilot Run', status: 'pending' as const },
  { id: 'sensitivityOptimization', label: 'Sensitivity Optimization', status: 'pending' as const },
  { id: 'exportRecipe', label: 'Export Recipe', status: 'pending' as const },
];

export const MOCK_CONTEXT = {
  layer: 'M2',
  process: 'SRAM',
  alignmentConfidence: 0.92,
  roiCount: 32,
  sensitivity: 0.72,
  recipeName: 'SRAM_M2_v3',
};

export const MOCK_SUGGESTIONS = [
  {
    id: 's1',
    title: 'Dense SRAM pattern detected',
    description: 'High-density pattern in region B4-C7. Consider reducing inspection threshold.',
    confidence: 0.87,
    action: 'adjust_sensitivity',
    value: 0.65,
  },
  {
    id: 's2',
    title: 'Recommend lower sensitivity',
    description: 'Current sensitivity (0.72) may produce excessive false positives in dense areas.',
    confidence: 0.79,
    action: 'adjust_sensitivity',
    value: 0.65,
  },
  {
    id: 's3',
    title: 'ROI overlap detected in region A3',
    description: 'Two ROI regions overlap by 15%. Merging recommended to reduce scan time.',
    confidence: 0.94,
    action: 'merge_roi',
    value: null,
  },
];

export const MOCK_REASONING = `Based on the current layer analysis (M2 / SRAM process), the inspection parameters have been tuned for high-density logic patterns. The alignment confidence of 92% is within acceptable range, though edge die alignment shows slight deviation (±0.3µm).

Key observations:
- Die density is 15% higher than baseline SRAM patterns
- Edge exclusion zone may need expansion for reliable defect capture
- Current ROI coverage accounts for 87% of critical area`;

export const MOCK_ROIS = [
  { id: 'roi-1', bounds: { x: 120, y: 100, width: 180, height: 140 }, color: '#06b6d4', label: 'A1' },
  { id: 'roi-2', bounds: { x: 340, y: 120, width: 160, height: 120 }, color: '#8b5cf6', label: 'A2' },
  { id: 'roi-3', bounds: { x: 200, y: 280, width: 200, height: 160 }, color: '#f59e0b', label: 'A3' },
  { id: 'roi-4', bounds: { x: 440, y: 300, width: 140, height: 100 }, color: '#22c55e', label: 'B1' },
  { id: 'roi-5', bounds: { x: 100, y: 420, width: 170, height: 130 }, color: '#ef4444', label: 'B2' },
];

export const MOCK_DEFECTS = [
  { x: 180, y: 150, intensity: 0.9 },
  { x: 350, y: 180, intensity: 0.6 },
  { x: 270, y: 320, intensity: 0.8 },
  { x: 480, y: 350, intensity: 0.4 },
  { x: 150, y: 460, intensity: 0.7 },
  { x: 400, y: 250, intensity: 0.5 },
  { x: 300, y: 400, intensity: 0.85 },
  { x: 520, y: 200, intensity: 0.3 },
];

export const MOCK_STATUS = {
  machine: { connected: true, label: 'Connected' },
  simulation: { active: false, label: 'Idle' },
  gpu: { status: 'ok' as const, label: 'OK' },
  recipe: 'SRAM_M2_v3',
  log: 'ROI generation in progress... 23/32 regions analyzed',
};
