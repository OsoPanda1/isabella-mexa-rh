import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  resetKey: number;
}

export class EnterpriseErrorBoundary extends Component<Props, State> {
  public declare state: State;
  public declare props: Props;
  public declare setState: Component<Props, State>["setState"];

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      resetKey: 0,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ARGUS-RUNTIME-ERROR] Uncaught error in view boundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState((prev) => ({ hasError: false, error: null, resetKey: prev.resetKey + 1 }));
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 border border-red-500/20 bg-red-500/5 rounded-2xl mx-4 my-8">
          <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-red-300 mb-2">Error de Ejecución Sensible</h2>
          <p className="text-slate-400 text-center max-w-lg mb-6">
            El módulo cognitivo ha experimentado un fallo imprevisto. El cortafuegos ARGUS ha interceptado la propagación.
          </p>
          <div className="bg-[#030712] border border-red-500/10 p-4 rounded-lg text-sm font-mono text-red-400/80 mb-6 max-w-2xl overflow-auto w-full text-left">
            {this.state.error?.toString()}
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="flex items-center gap-2 px-6 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg transition-colors border border-rose-500/20 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Restaurar Operación</span>
          </button>
        </div>
      );
    }

    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}
