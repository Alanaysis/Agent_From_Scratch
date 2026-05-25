import { create } from 'zustand';
import type {
  GlobalState,
  WorkflowStepId,
  AISuggestion,
  ROI,
  UIState,
} from './types';
import {
  MOCK_CONTEXT,
  MOCK_SUGGESTIONS,
  MOCK_REASONING,
  MOCK_ROIS,
  MOCK_DEFECTS,
  MOCK_STATUS,
  MOCK_WORKFLOW_STEPS,
} from '../lib/mockData';

type Actions = {
  transitionWorkflow: (step: WorkflowStepId) => void;
  applySuggestion: (id: string) => void;
  ignoreSuggestion: (id: string) => void;
  setZoom: (zoom: number) => void;
  setActiveOverlay: (overlay: string) => void;
  setCanvasSize: (width: number, height: number) => void;
  sendMessage: (message: string) => void;
};

export const useGlobalStore = create<GlobalState & Actions>((set, get) => ({
  gds: {
    loaded: true,
    fileName: 'SRAM_M2_v3.gds',
    layers: ['M1', 'M2', 'VIA1', 'POLY'],
  },
  wafer: {
    id: 'WF-2024-001',
    diameter: 300,
    dieCount: 2500,
  },
  roi: MOCK_ROIS,
  alignment: {
    confidence: 0.92,
    markers: [
      { x: 150, y: 150 },
      { x: 450, y: 150 },
      { x: 150, y: 450 },
      { x: 450, y: 450 },
    ],
  },
  sensitivity: {
    value: 0.72,
    threshold: 0.5,
  },
  recipe: {
    name: 'SRAM_M2_v3',
    version: '1.0',
    status: 'active',
  },
  workflow: 'roiGeneration',
  ui: {
    selectedDie: null,
    zoom: 1.0,
    activeOverlay: 'all',
    canvasWidth: 800,
    canvasHeight: 600,
  },
  context: MOCK_CONTEXT,
  suggestions: MOCK_SUGGESTIONS,
  reasoning: MOCK_REASONING,
  statusBar: MOCK_STATUS,

  transitionWorkflow: (step) => set({ workflow: step }),

  applySuggestion: (id) => {
    const { suggestions, sensitivity } = get();
    const suggestion = suggestions.find((s) => s.id === id);
    if (suggestion?.action === 'adjust_sensitivity' && suggestion.value !== null) {
      set({
        sensitivity: { ...sensitivity, value: suggestion.value },
        suggestions: suggestions.filter((s) => s.id !== id),
      });
    } else {
      set({ suggestions: suggestions.filter((s) => s.id !== id) });
    }
  },

  ignoreSuggestion: (id) => {
    set((state) => ({
      suggestions: state.suggestions.filter((s) => s.id !== id),
    }));
  },

  setZoom: (zoom) =>
    set((state) => ({ ui: { ...state.ui, zoom: Math.max(0.25, Math.min(4, zoom)) } })),

  setActiveOverlay: (overlay) =>
    set((state) => ({ ui: { ...state.ui, activeOverlay: overlay } })),

  setCanvasSize: (width, height) =>
    set((state) => ({ ui: { ...state.ui, canvasWidth: width, canvasHeight: height } })),

  sendMessage: (message) => {
    console.log('[Copilot] User message:', message);
  },
}));
