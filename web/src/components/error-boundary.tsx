/**
 * Catches unhandled React errors and shows a recovery UI instead of a blank page.
 */
import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="max-w-md space-y-4 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-semibold">页面出错了</h1>
          <p className="text-sm text-muted-foreground">
            {this.state.error?.message || '发生了意外错误'}
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={this.handleReset}>
              重试
            </Button>
            <Button onClick={this.handleReload}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              刷新页面
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
