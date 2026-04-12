/**
 * ToastProvider — Queue-based toast system
 * Stack dal basso, max 3 visibili, auto-dismiss con progress bar.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { TOAST_EVENT } from '../hooks/use-toast';

const ICONS = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    error:   <XCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info:    <Info className="w-5 h-5 text-blue-500" />,
};

const BG = {
    success: 'border-l-emerald-500',
    error:   'border-l-red-500',
    warning: 'border-l-amber-500',
    info:    'border-l-blue-500',
};

let toastIdCounter = 0;

export default function ToastProvider() {
    const [toasts, setToasts] = useState([]);
    const timers = useRef({});

    const removeToast = useCallback((id) => {
        clearTimeout(timers.current[id]);
        delete timers.current[id];
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const handleToast = useCallback((e) => {
        const { message, type = 'info', duration = 4000 } = e.detail;
        const id = ++toastIdCounter;

        setToasts(prev => [...prev.slice(-2), { id, message, type, duration, createdAt: Date.now() }]);

        timers.current[id] = setTimeout(() => removeToast(id), duration);
    }, [removeToast]);

    useEffect(() => {
        window.addEventListener(TOAST_EVENT, handleToast);
        // Also listen for legacy dvai-toast events
        window.addEventListener('dvai-toast', (e) => {
            const d = e.detail || {};
            handleToast({ detail: { message: d.message || d.title, type: d.type || 'info', duration: d.duration || 4000 } });
        });
        return () => {
            window.removeEventListener(TOAST_EVENT, handleToast);
            Object.values(timers.current).forEach(clearTimeout);
        };
    }, [handleToast]);

    return (
        <div className="fixed bottom-20 left-0 right-0 z-[9999] flex flex-col items-center gap-2 px-4 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {toasts.map((t) => (
                    <motion.div
                        key={t.id}
                        layout
                        initial={{ opacity: 0, y: 40, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className={`pointer-events-auto w-full max-w-sm bg-white rounded-xl shadow-xl border-l-4 ${BG[t.type]} overflow-hidden`}
                    >
                        <div className="flex items-start gap-3 p-3">
                            <div className="mt-0.5 shrink-0">{ICONS[t.type]}</div>
                            <p className="flex-1 text-sm text-gray-800 font-medium leading-snug">{t.message}</p>
                            <button
                                onClick={() => removeToast(t.id)}
                                className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {/* Progress bar auto-dismiss */}
                        <motion.div
                            className={`h-0.5 ${t.type === 'success' ? 'bg-emerald-400' : t.type === 'error' ? 'bg-red-400' : t.type === 'warning' ? 'bg-amber-400' : 'bg-blue-400'}`}
                            initial={{ width: '100%' }}
                            animate={{ width: '0%' }}
                            transition={{ duration: t.duration / 1000, ease: 'linear' }}
                        />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
