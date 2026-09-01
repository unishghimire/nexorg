import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
                    <div role="alert" aria-live="assertive" className="bg-surface p-8 rounded-3xl border border-red-900/30 shadow-2xl max-w-md w-full text-center">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">
                            System Malfunction
                        </h1>
                        <p className="text-gray-400 text-sm mb-8">
                            A critical error has occurred in the application interface. Our engineers have been notified.
                        </p>
                        <button type="button"
                            onClick={this.handleReload}
                            className="w-full bg-brand-600 hover:bg-brand-500 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-5 h-5" /> Reboot System
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
