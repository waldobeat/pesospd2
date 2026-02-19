import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
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
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-4">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 max-w-2xl w-full">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-red-500/20 rounded-full">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">Algo salió mal</h1>
                                <p className="text-white/60">Se ha producido un error crítico en la aplicación.</p>
                            </div>
                        </div>

                        <div className="bg-black/50 rounded-xl p-4 font-mono text-sm text-red-400 overflow-auto max-h-64 mb-6 border border-white/5">
                            <p className="font-bold mb-2">{this.state.error?.toString()}</p>
                            <pre className="text-white/40 whitespace-pre-wrap text-xs">
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Recargar Aplicación
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
