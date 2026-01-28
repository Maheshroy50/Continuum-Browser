import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

interface ToastProps {
    message: string;
    type: 'success' | 'warning' | 'info';
    duration?: number;
    onClose: () => void;
}

function Toast({ message, type, duration = 3000, onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const icons = {
        success: <CheckCircle className="w-4 h-4 text-green-400" />,
        warning: <AlertCircle className="w-4 h-4 text-yellow-400" />,
        info: <Info className="w-4 h-4 text-blue-400" />,
    };

    const bgColors = {
        success: 'bg-green-500/10 border-green-500/30',
        warning: 'bg-yellow-500/10 border-yellow-500/30',
        info: 'bg-blue-500/10 border-blue-500/30',
    };

    return (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-lg border ${bgColors[type]} backdrop-blur-sm animate-toast-fade-in`}>
            {icons[type]}
            <span className="text-sm text-foreground">{message}</span>
        </div>
    );
}

// Toast container component to use in App.tsx
export function ToastContainer() {
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);

    useEffect(() => {
        // Listen for restore-result events from ViewManager
        // @ts-ignore
        const handler = (_event: any, data: { method: string; success: boolean; message?: string }) => {
            if (!data.message) return;

            const type = data.success
                ? (data.method === 'anchor' ? 'success' : 'info')
                : 'warning';

            setToast({ message: data.message, type });
        };

        // @ts-ignore
        if (window.ipcRenderer) {
            // @ts-ignore
            window.ipcRenderer.on('view:restore-result', handler);

            // @ts-ignore
            window.ipcRenderer.on('toast:show', (_event: any, data: { message: string, type: 'success' | 'warning' | 'info' }) => {
                setToast(data);
            });
        }

        return () => {
            // @ts-ignore
            if (window.ipcRenderer) {
                // @ts-ignore
                window.ipcRenderer.off('view:restore-result', handler);
                // Listeners are usually cumulative in this setup, but good practice
            }
        };
    }, []);

    if (!toast) return null;

    return (
        <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
        />
    );
}

export default Toast;
