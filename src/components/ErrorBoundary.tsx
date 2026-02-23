import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          color: '#ff00ff', padding: 20, background: '#000',
          fontFamily: 'monospace', border: '1px solid #ff00ff',
          borderRadius: 4, margin: 20,
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
            WebGL Rendering Error
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {this.state.error}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
