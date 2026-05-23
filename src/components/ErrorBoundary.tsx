import React, { ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught an uncaught component lifecycle crash error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 border border-red-500/40 bg-red-950/20 text-red-200 rounded-none font-mono text-xs flex flex-col gap-3">
          <div className="flex items-center gap-2 border-b border-red-500/20 pb-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="font-bold tracking-widest uppercase text-red-400">
              {this.props.fallbackTitle || "COMPONENT LIFECYCLE DEGRADED CRASH"}
            </span>
          </div>
          <p className="text-[11px] text-red-300">
            {this.state.error?.message || "An unexpected error occurred in this view module."}
          </p>
          <pre className="p-3 bg-black/40 text-[9px] text-red-400/80 overflow-auto max-h-40 border border-red-950">
            {this.state.error?.stack || "No call stack trace available."}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="self-start px-4 py-1.5 border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors bg-transparent rounded-none cursor-pointer"
          >
            ATTEMPT RELOAD / REBIND STATE
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
