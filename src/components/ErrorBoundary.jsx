import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("DoveVai Critical Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            // Custom Fallback UI
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center">
                    <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
                        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800 mb-2">Qualcosa è andato storto</h1>
                        <p className="text-gray-500 mb-6">
                            Abbiamo riscontrato un errore imprevisto. Il team tecnico è stato notificato.
                        </p>
                        <div className="space-y-3">
                            <button
                                onClick={() => window.location.href = '/'}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
                            >
                                Torna alla Home
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full py-3 bg-white text-gray-600 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition"
                            >
                                Riprova
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
