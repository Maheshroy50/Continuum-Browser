import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Mic, MapPin, Shield, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SitePermissionsPanelProps {
    url: string;
    isOpen: boolean;
    onClose: () => void;
    rect: DOMRect | null;
    blockedCount: number;
}

interface PermissionsState {
    camera: 'allow' | 'deny' | 'ask';
    microphone: 'allow' | 'deny' | 'ask';
    geolocation: 'allow' | 'deny' | 'ask';
    notifications: 'allow' | 'deny' | 'ask';
}

export function SitePermissionsPanel({ url, isOpen, onClose, rect, blockedCount }: SitePermissionsPanelProps) {
    const { t } = useTranslation();
    const [permissions, setPermissions] = useState<PermissionsState>({
        camera: 'ask',
        microphone: 'ask',
        geolocation: 'ask',
        notifications: 'ask'
    });

    // Parse origin for display and IPC
    let origin = '';
    let hostname = '';
    let isSecure = false;

    try {
        const urlObj = new URL(url);
        origin = urlObj.origin;
        hostname = urlObj.hostname;
        isSecure = urlObj.protocol === 'https:';
    } catch {
        // Invalid URL
    }

    // Load permissions when opening
    useEffect(() => {
        if (isOpen && origin) {
            // @ts-ignore
            // window.ipcRenderer?.privacy?.getSitePermissions?.().then((allPerms: any) => {
            //     const sitePerms = allPerms[origin] || {};
            //     setPermissions({
            //         camera: sitePerms.camera || 'ask',
            //         microphone: sitePerms.microphone || 'ask',
            //         geolocation: sitePerms.geolocation || 'ask',
            //         notifications: sitePerms.notifications || 'ask'
            //     });
            // });
        }
    }, [isOpen, origin]);

    const togglePermission = (permission: keyof PermissionsState) => {
        const current = permissions[permission];
        const next = current === 'allow' ? 'deny' : current === 'deny' ? 'ask' : 'allow'; // Cycle: Allow -> Deny -> Ask

        // Optimistic update
        setPermissions(prev => ({ ...prev, [permission]: next }));

        // Send to backend
        // @ts-ignore
        // window.ipcRenderer?.privacy?.setSitePermission?.(origin, permission, next);
    };

    if (!isOpen || !rect) return null;

    // Position panel below the lock icon, aligned to its left edge
    const style: React.CSSProperties = {
        top: rect.bottom + 8,
        left: rect.left,
    };

    // Use portal to render at body level, above BrowserViews
    return createPortal(
        <>
            {/* Invisible backdrop for click-outside handling - no visual effect */}
            <div
                className="fixed inset-0 z-[9998]"
                style={{ background: 'transparent' }}
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className="fixed z-[9999] w-80 glass-deep rounded-2xl overflow-hidden"
                style={style}
            >
                {/* Header: Connection Status */}
                <div className={`p-4 border-b border-white/5 ${isSecure ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${isSecure ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500'}`}>
                            {isSecure ? <Shield className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className={`text-sm font-semibold ${isSecure ? 'text-green-500' : 'text-red-500'}`}>
                                {isSecure ? t('privacy.connectionSecure', 'Connection is secure') : t('privacy.connectionNotSecure', 'Not secure')}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{hostname}</p>
                        </div>
                    </div>
                    {blockedCount > 0 && (
                        <div className="mt-3 px-3 py-2 bg-green-500/10 rounded-lg border border-green-500/20">
                            <p className="text-xs text-green-500 font-medium flex items-center gap-2">
                                <Shield className="w-3.5 h-3.5" />
                                {blockedCount} trackers & ads blocked
                            </p>
                        </div>
                    )}
                </div>

                {/* Permissions List */}
                <div className="p-3">
                    <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                        {t('privacy.permissions', 'Site Permissions')}
                    </p>

                    <div className="space-y-1 mt-1">
                        <PermissionItem
                            icon={<MapPin className="w-4 h-4" />}
                            label={t('privacy.location', 'Location')}
                            value={permissions.geolocation}
                            onClick={() => togglePermission('geolocation')}
                        />
                        <PermissionItem
                            icon={<Camera className="w-4 h-4" />}
                            label={t('privacy.camera', 'Camera')}
                            value={permissions.camera}
                            onClick={() => togglePermission('camera')}
                        />
                        <PermissionItem
                            icon={<Mic className="w-4 h-4" />}
                            label={t('privacy.microphone', 'Microphone')}
                            value={permissions.microphone}
                            onClick={() => togglePermission('microphone')}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-white/5 bg-white/[0.02]">
                    <p className="text-[10px] text-muted-foreground/50 text-center">
                        {t('privacy.refreshToApply', 'Changes apply on page reload')}
                    </p>
                </div>
            </div>
        </>,
        document.body
    );
}

function PermissionItem({ icon, label, value, onClick }: {
    icon: React.ReactNode,
    label: string,
    value: 'allow' | 'deny' | 'ask',
    onClick: () => void
}) {
    // Style based on state
    const stateStyles = {
        allow: 'text-green-500 bg-green-500/15 border-green-500/20',
        deny: 'text-red-500 bg-red-500/15 border-red-500/20',
        ask: 'text-muted-foreground bg-white/5 border-white/10'
    };

    const stateLabels = {
        allow: 'Allow',
        deny: 'Block',
        ask: 'Ask'
    };

    return (
        <button
            onClick={onClick}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl group transition-all duration-200 hover:bg-white/5"
        >
            <div className="flex items-center gap-3 text-sm text-foreground">
                <span className="p-1.5 rounded-lg bg-white/5 text-muted-foreground group-hover:text-foreground group-hover:bg-white/10 transition-all">{icon}</span>
                <span className="font-medium">{label}</span>
            </div>

            <div className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${stateStyles[value]}`}>
                {stateLabels[value]}
            </div>
        </button>
    );
}
