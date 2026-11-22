import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button, Card } from '../design-system';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error
        ? error.message
        : 'Something unexpected interrupted this view.';
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown) {
    if (import.meta.env.DEV) {
      console.error('[LittleSteps ErrorBoundary]', error);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="min-h-[50vh] flex items-center justify-center px-4 py-12 bg-offwhite"
        >
          <Card padding="lg" className="max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-peach-soft text-peach-ink mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h2 className="font-display text-xl font-semibold text-charcoal">
                {this.props.fallbackTitle || 'We paused for a moment'}
              </h2>
              <p className="text-sm text-muted leading-relaxed">
                This screen ran into an unexpected hiccup. Your saved progress and baby profile are
                completely safe.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<RefreshCw className="w-4 h-4" />}
                onClick={this.handleReset}
              >
                Try Again
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
