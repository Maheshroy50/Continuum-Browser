
import React, { useEffect, useState } from 'react';
import { ShieldAlert, Globe, ArrowRight, ShieldCheck, XCircle } from 'lucide-react';

interface SentinelAlert {
    requestingOrigin: string;
    targetUrl: string;
    requestId: number;
}

export const PrivateNetworkSentinel: React.FC = () => {
    const [alert, setAlert] = useState<SentinelAlert | null>(null);

    useEffect(() => {
        // Listen for security alerts from the Main Process
        const handleAlert = (_event: any, data: SentinelAlert) => {
            console.warn('[Sentinel] High Alert:', data);
            setAlert(data);
        };

        if ((window as any).electron) {
            (window as any).electron.on('security:sentinel-alert', handleAlert);
        }

        return () => {
            if ((window as any).electron) {
                // localized cleanup would require an 'off' method which might not be exposed, 
                // usually strictly additive in this setup, but good practice.
            }
        };
    }, []);

    const handleBlock = () => {
        if (!alert) return;
        // Send block response (default safe action)
        (window as any).electron?.send('security:sentinel-response', {
            action: 'block',
            requestId: alert.requestId
        });
        setAlert(null);
    };

    const handleAllowOnce = () => {
        if (!alert) return;
        // Send allow response (risk action)
        (window as any).electron?.send('security:sentinel-response', {
            action: 'allow',
            requestId: alert.requestId
        });
        setAlert(null);
    };

    if (!alert) return null;

    const targetIP = new URL(alert.targetUrl).hostname;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[500px] bg-[#1a1a1a] border border-red-500/50 rounded-xl shadow-2xl shadow-red-900/20 overflow-hidden transform transition-all scale-100">

                {/* Header - Crimson Alert */}
                <div className="h-2 bg-gradient-to-r from-red-600 to-red-500" />

                <div className="p-6 space-y-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-red-500/10 rounded-full border border-red-500/20 animate-pulse">
                            <ShieldAlert className="w-8 h-8 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Private Network Access Blocked</h2>
                            <p className="mt-1 text-sm text-zinc-400 leading-relaxed">
                                This website is attempting to scan your local network. This behavior is often used to identify your devices or router vulnerabilities.
                            </p>
                        </div>
                    </div>

                    {/* Connection Diagram */}
                    <div className="flex items-center justify-between p-4 bg-black/40 rounded-lg border border-zinc-800">
                        <div className="flex flex-col items-center gap-2 max-w-[120px]">
                            <div className="p-2 bg-zinc-800 rounded-full">
                                <Globe className="w-5 h-5 text-blue-400" />
                            </div>
                            <span className="text-xs text-zinc-300 truncate w-full text-center font-medium" title={alert.requestingOrigin}>
                                {new URL(alert.requestingOrigin).hostname}
                            </span>
                        </div>

                        <div className="flex-1 px-4 flex flex-col items-center">
                            <div className="text-[10px] text-red-500 font-mono tracking-widest uppercase mb-1">Attempting Connection</div>
                            <div className="h-[1px] w-full bg-red-500/30 relative">
                                <ArrowRight className="w-4 h-4 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-2 max-w-[120px]">
                            <div className="p-2 bg-red-500/10 rounded-full border border-red-500/30">
                                <ShieldCheck className="w-5 h-5 text-red-500" />
                            </div>
                            <span className="text-xs text-red-400 font-mono font-medium">
                                {targetIP}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleBlock}
                            className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-3 rounded-lg font-medium transition-colors shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 focus:ring-2 focus:ring-red-500 focus:outline-none"
                        >
                            <XCircle className="w-4 h-4" />
                            Block Request
                        </button>
                        <button
                            onClick={handleAllowOnce}
                            className="px-4 py-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors border border-transparent hover:border-zinc-800 rounded-lg"
                        >
                            Allow Once (Risky)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
