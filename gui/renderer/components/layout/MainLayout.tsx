import React from 'react';
import { PanelHeader } from './PanelHeader';
import { StatusBar } from './StatusBar';
import { WorkflowPanel } from '../workflow/WorkflowPanel';
import { WaferCanvas } from '../visualization/WaferCanvas';
import { CopilotPanel } from '../copilot/CopilotPanel';

export function MainLayout() {
  return (
    <div className="app-layout">
      <div className="panel left-panel">
        <PanelHeader title="Workflow" badge="Recipe Generation" />
        <div className="panel-content">
          <WorkflowPanel />
        </div>
      </div>

      <div className="panel center-panel">
        <WaferCanvas />
      </div>

      <div className="panel right-panel">
        <PanelHeader title="AI Copilot" badge="Assist Mode" />
        <div className="panel-content">
          <CopilotPanel />
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
