export type WorkflowStepId =
  | 'loadGDS'
  | 'layerAnalysis'
  | 'waferAlignment'
  | 'roiGeneration'
  | 'pilotRun'
  | 'sensitivityOptimization'
  | 'exportRecipe';

export type WorkflowStepStatus = 'completed' | 'active' | 'pending' | 'error';

export type WorkflowStep = {
  id: WorkflowStepId;
  label: string;
  status: WorkflowStepStatus;
};

export type Point = { x: number; y: number };

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ROI = {
  id: string;
  bounds: Rect;
  color: string;
  label: string;
};

export type Defect = {
  x: number;
  y: number;
  intensity: number;
};

export type ContextSummary = {
  layer: string;
  process: string;
  alignmentConfidence: number;
  roiCount: number;
  sensitivity: number;
  recipeName: string;
};

export type AISuggestion = {
  id: string;
  title: string;
  description: string;
  confidence: number;
  action: string;
  value: number | null;
};

export type MachineStatus = {
  connected: boolean;
  label: string;
};

export type SimulationStatus = {
  active: boolean;
  label: string;
};

export type GPUStatus = {
  status: 'ok' | 'warning' | 'error';
  label: string;
};

export type StatusBarData = {
  machine: MachineStatus;
  simulation: SimulationStatus;
  gpu: GPUStatus;
  recipe: string;
  log: string;
};

export type GDSState = {
  loaded: boolean;
  fileName: string;
  layers: string[];
};

export type WaferState = {
  id: string;
  diameter: number;
  dieCount: number;
};

export type AlignmentState = {
  confidence: number;
  markers: Point[];
};

export type SensitivityState = {
  value: number;
  threshold: number;
};

export type RecipeState = {
  name: string;
  version: string;
  status: string;
};

export type UIState = {
  selectedDie: string | null;
  zoom: number;
  activeOverlay: string;
  canvasWidth: number;
  canvasHeight: number;
};

export type GlobalState = {
  gds: GDSState;
  wafer: WaferState;
  roi: ROI[];
  alignment: AlignmentState;
  sensitivity: SensitivityState;
  recipe: RecipeState;
  workflow: WorkflowStepId;
  ui: UIState;
  context: ContextSummary;
  suggestions: AISuggestion[];
  reasoning: string;
  statusBar: StatusBarData;
};
