import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferencesStore } from '../../../store/usePreferencesStore';
import { useFlowStore } from '../../../store/useFlowStore';
import { ToggleLeft, ToggleRight, Trash2, Shield, Check, Camera, Mic, MapPin } from 'lucide-react';

type PermissionValue = 'ask' | 'allow' | 'deny';

interface SitePermissions {
    [origin: string]: {
        camera?: PermissionValue;
        microphone?: PermissionValue;
        geolocation?: PermissionValue;
    };
}

export function PrivacySection() {
    const { t } = useTranslation();
    const { blockThirdPartyCookies, doNotTrack } = usePreferencesStore(state => ({
        blockThirdPartyCookies: state.blockThirdPartyCookies,
        doNotTrack: state.doNotTrack
    }));
    const setPrivacySettings = usePreferencesStore(state => state.setPrivacySettings);
    const clearHistory = useFlowStore(state => state.clearHistory);

    // Clearing state
    const [isClearing, setIsClearing] = useState(false);
    const [cleared, setCleared] = useState(false);

    // Default permission state
    const [defaultCamera, setDefaultCamera] = useState<PermissionValue>('ask');
    const [defaultMic, setDefaultMic] = useState<PermissionValue>('ask');
    const [defaultLocation, setDefaultLocation] = useState<PermissionValue>('ask');

    // Site permissions
    const [sitePermissions, _setSitePermissions] = useState<SitePermissions>({});

    // Sync privacy settings with Chromium on mount
    useEffect(() => {
        // @ts-ignore - window.ipcRenderer.privacy is defined in preload
        // window.ipcRenderer?.privacy?.setSettings?.({
        //     blockThirdPartyCookies,
        //     doNotTrack
        // });

        // Load site permissions
        // @ts-ignore
        // window.ipcRenderer?.privacy?.getSitePermissions?.().then((perms: SitePermissions) => {
        //     if (perms) setSitePermissions(perms);
        // });
    }, []);

    const toggle = async (key: 'blockThirdPartyCookies' | 'doNotTrack') => {
        const val = key === 'blockThirdPartyCookies' ? blockThirdPartyCookies : doNotTrack;
        const newValue = !val;

        // Update local store
        setPrivacySettings({ [key]: newValue });

        // Sync with Chromium session via IPC
        try {
            // @ts-ignore - window.ipcRenderer.privacy is defined in preload
            // await window.ipcRenderer?.privacy?.setSettings?.({
            //     [key]: newValue
            // });
        } catch (e) {
            console.error('Failed to update privacy settings:', e);
        }
    };

    const handleClearData = async () => {
        setIsClearing(true);
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            // await window.ipcRenderer.privacy.clearData({
            //     storages: ['cookies', 'localstorage', 'caches', 'indexdb']
            // });
            clearHistory(); // Clear local history store
            setCleared(true);
        } catch (error) {
            console.error('Failed to clear data:', error);
        } finally {
            setIsClearing(false);
            setTimeout(() => setCleared(false), 3000);
        }
    };

    const PermissionRow = ({
        icon: Icon,
        label,
        description,
        value,
        onChange
    }: {
        icon: typeof Camera;
        label: string;
        description: string;
        value: PermissionValue;
        onChange: (val: PermissionValue) => void
    }) => (
        <div className="flex items-center justify-between py-3">
            <div className="flex items-center">
                <Icon className="w-4 h-4 text-muted-foreground mr-3" />
                <div>
                    <div className="text-sm text-foreground font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                </div>
            </div>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as PermissionValue)}
                className="bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
                <option value="ask">{t('settings.privacy.permissions.options.ask')}</option>
                <option value="deny">{t('settings.privacy.permissions.options.deny')}</option>
            </select>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Privacy Overview - Trust Signal */}
            <div className="bg-gradient-to-br from-green-900/10 to-transparent border border-green-500/20 rounded-lg p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-20">
                    <Shield className="w-24 h-24 text-green-500" />
                </div>

                <div className="relative z-10">
                    <h3 className="text-lg font-medium text-green-500 mb-2 flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        {t('settings.privacy.trust.title')}
                    </h3>
                    <p className="text-sm text-muted-foreground opacity-90 max-w-md">
                        {t('settings.privacy.trust.description')}
                    </p>

                    <div className="flex gap-4 mt-6">
                        <div className="bg-black/20 backdrop-blur-sm rounded-lg p-3 border border-white/5 flex-1 max-w-[200px]">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('settings.privacy.trust.cookies')}</div>
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${blockThirdPartyCookies ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                <span className="text-sm font-medium">
                                    {blockThirdPartyCookies ? t('settings.privacy.trust.blocked') : t('settings.privacy.trust.allowed')}
                                </span>
                            </div>
                        </div>
                        <div className="bg-black/20 backdrop-blur-sm rounded-lg p-3 border border-white/5 flex-1 max-w-[200px]">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('settings.privacy.trust.doNotTrack')}</div>
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${doNotTrack ? 'bg-green-500' : 'bg-neutral-500'}`} />
                                <span className="text-sm font-medium">
                                    {doNotTrack ? t('settings.privacy.trust.enabled') : t('settings.privacy.trust.disabled')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tracking Protections */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-6">{t('settings.privacy.tracking.title')}</h4>

                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-foreground font-medium">{t('settings.privacy.tracking.thirdPartyCookies.title')}</div>
                            <div className="text-xs text-muted-foreground mt-1">{t('settings.privacy.tracking.thirdPartyCookies.description')}</div>
                        </div>
                        <button
                            onClick={() => toggle('blockThirdPartyCookies')}
                            className={`transition-colors ${blockThirdPartyCookies ? 'text-primary' : 'text-muted-foreground'}`}
                        >
                            {blockThirdPartyCookies ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-foreground font-medium">{t('settings.privacy.tracking.dnt.title')}</div>
                            <div className="text-xs text-muted-foreground mt-1">{t('settings.privacy.tracking.dnt.description')}</div>
                        </div>
                        <button
                            onClick={() => toggle('doNotTrack')}
                            className={`transition-colors ${doNotTrack ? 'text-primary' : 'text-muted-foreground'}`}
                        >
                            {doNotTrack ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Site Permissions */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-4">{t('settings.privacy.permissions.title')}</h4>
                <p className="text-xs text-muted-foreground mb-4">{t('settings.privacy.permissions.description')}</p>

                <div className="divide-y divide-border">
                    <PermissionRow
                        icon={Camera}
                        label={t('settings.privacy.permissions.camera.label')}
                        description={t('settings.privacy.permissions.camera.description')}
                        value={defaultCamera}
                        onChange={setDefaultCamera}
                    />
                    <PermissionRow
                        icon={Mic}
                        label={t('settings.privacy.permissions.mic.label')}
                        description={t('settings.privacy.permissions.mic.description')}
                        value={defaultMic}
                        onChange={setDefaultMic}
                    />
                    <PermissionRow
                        icon={MapPin}
                        label={t('settings.privacy.permissions.location.label')}
                        description={t('settings.privacy.permissions.location.description')}
                        value={defaultLocation}
                        onChange={setDefaultLocation}
                    />
                </div>

                {/* Per-site permissions list */}
                {Object.keys(sitePermissions).length > 0 && (
                    <div className="mt-6 pt-4 border-t border-border">
                        <h5 className="text-xs font-medium text-muted-foreground mb-3">{t('settings.privacy.permissions.customList')}</h5>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                            {Object.entries(sitePermissions).map(([origin, perms]) => (
                                <div key={origin} className="flex items-center justify-between text-xs py-1.5">
                                    <span className="text-foreground truncate max-w-[200px]">{origin}</span>
                                    <div className="flex gap-2 text-muted-foreground">
                                        {perms.camera && <span>📷 {perms.camera}</span>}
                                        {perms.microphone && <span>🎤 {perms.microphone}</span>}
                                        {perms.geolocation && <span>📍 {perms.geolocation}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Clear Browsing Data */}
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
                <div className="flex items-start mb-4">
                    <Shield className="w-5 h-5 text-destructive mr-3 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-medium text-foreground mb-1">{t('settings.privacy.clearData.title')}</h4>
                        <p className="text-xs text-muted-foreground">{t('settings.privacy.clearData.description')}</p>
                    </div>
                </div>

                <button
                    onClick={handleClearData}
                    disabled={isClearing || cleared}
                    className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center ${cleared
                        ? 'bg-green-600/20 text-green-500 border border-green-600/20 cursor-default'
                        : 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20'
                        }`}
                >
                    {isClearing ? (
                        <span className="animate-pulse">{t('settings.privacy.clearData.cleaning')}</span>
                    ) : cleared ? (
                        <>
                            <Check className="w-4 h-4 mr-2" />
                            {t('settings.privacy.clearData.cleaned')}
                        </>
                    ) : (
                        <>
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('settings.privacy.clearData.button')}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
