import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      let parsedError = null;
      try {
        if (this.state.error?.message.startsWith('{')) {
          parsedError = JSON.parse(this.state.error.message);
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-red-100">
            <div className="bg-red-50 p-6 border-b border-red-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <h1 className="text-xl font-semibold text-red-900">Something went wrong</h1>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-slate-600">
                An unexpected error occurred in the application.
              </p>
              
              {parsedError ? (
                <div className="bg-slate-900 rounded-xl p-4 overflow-auto text-sm">
                  <div className="text-red-400 font-mono mb-2">Firestore Permission Error</div>
                  <pre className="text-slate-300 font-mono whitespace-pre-wrap">
                    {JSON.stringify(parsedError, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="bg-slate-100 rounded-xl p-4 overflow-auto text-sm">
                  <pre className="text-slate-700 font-mono whitespace-pre-wrap">
                    {this.state.error?.toString()}
                  </pre>
                </div>
              )}
              
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
              >
                Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
