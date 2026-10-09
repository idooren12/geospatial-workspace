import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  fallback: ReactNode;
  children: ReactNode;
  /** For the log line: which boundary caught it. */
  scope?: string;
}

/**
 * Keeps one crashing part from taking down the rest: each panel has one (a broken tool shows an
 * error in its own column), and the app has one around the whole workspace.
 */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`[gws] ${this.props.scope ?? 'panel'} crashed`, error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
