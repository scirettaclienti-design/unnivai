/**
 * DVAI-039 — ToastProvider
 * Ascolta l'evento 'dvai:toast' e renderizza il Toast component.
 * Va montato UNA VOLTA in App.jsx fuori dai router.
 */
import { useState, useEffect, useCallback } from 'react';
import { Toast } from './ToastNotification';
import { TOAST_EVENT } from '../hooks/use-toast';

export default function ToastProvider() {
    const [toastState, setToastState] = useState({
        visible: false,
        message: '',
        type: 'info',
        duration: 3000,
    });

    const handleToast = useCallback((e) => {
        const { message, type = 'info', duration = 3000 } = e.detail;
        setToastState({ visible: true, message, type, duration });
    }, []);

    useEffect(() => {
        window.addEventListener(TOAST_EVENT, handleToast);
        return () => window.removeEventListener(TOAST_EVENT, handleToast);
    }, [handleToast]);

    const dismiss = useCallback(() => {
        setToastState(prev => ({ ...prev, visible: false }));
    }, []);

    return (
        <Toast
            message={toastState.message}
            type={toastState.type}
            isVisible={toastState.visible}
            onClose={dismiss}
            duration={toastState.duration}
        />
    );
}
