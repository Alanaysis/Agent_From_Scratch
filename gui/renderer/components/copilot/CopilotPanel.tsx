import React from 'react';
import { ContextSummary } from './ContextSummary';
import { AISuggestions } from './AISuggestions';
import { AIReasoning } from './AIReasoning';
import { ChatInput } from './ChatInput';

export function CopilotPanel() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <ContextSummary />
      <SectionDivider />
      <AISuggestions />
      <SectionDivider />
      <AIReasoning />
      <div style={{ flex: 1 }} />
      <ChatInput />
    </div>
  );
}

function SectionDivider() {
  return (
    <div
      style={{
        height: 1,
        background: 'var(--border)',
        margin: '0 12px',
      }}
    />
  );
}
