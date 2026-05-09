import React from 'react';
import { MainLayout } from './components/layout/MainLayout';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error: string | null };

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('React Error Boundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0e14',
            color: '#ef4444',
            fontFamily: 'monospace',
            padding: 40,
          }}
        >
          <h2 style={{ marginBottom: 16 }}>Rendering Error</h2>
          <pre
            style={{
              background: '#111827',
              padding: 16,
              borderRadius: 8,
              maxWidth: '80%',
              overflow: 'auto',
              fontSize: 12,
              color: '#e2e8f0',
            }}
          >
            {this.state.error}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  console.log('[App] Rendering MainLayout');
  return (
    <ErrorBoundary>
      <MainLayout />
    </ErrorBoundary>
  );
}
