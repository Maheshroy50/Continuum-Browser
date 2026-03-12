import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferencesStore } from '../../../store/usePreferencesStore';
import { useFlowStore } from '../../../store/useFlowStore';
import { ToggleLeft, ToggleRight, Trash2, Shield, Check, Camera, Mic, MapPin, Youtube, Plus, X, Zap, ShieldCheck, ShieldAlert } from 'lucide-react';

type PermissionValue = 'ask' | 'allow' | 'deny';
type BlockerLevel = 'standard' | 'aggressive' | 'maximum';

interface BlockerStatus {
    isEnabled: boolean;
    blockedCount: number;
    level: BlockerLevel;
    youtubeAdsBlocked: boolean;
    whitelist: string[];
    totalDomains: number;
}

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

    // Blocker state
    const [blockerStatus, setBlockerStatus] = useState<BlockerStatus>({
        isEnabled: true, blockedCount: 0, level: 'aggressive',
        youtubeAdsBlocked: true, whitelist: [], totalDomains: 0,
    });
    const [whitelistInput, setWhitelistInput] = useState('');

    // Clearing state
    const [isClearing, setIsClearing] = useState(false);
    const [cleared, setCleared] = useState(false);

    // Permission state
    const [defaultCamera, setDefaultCamera] = useState<PermissionValue>('ask');
    const [defaultMic, setDefaultMic] = useState<PermissionValue>('ask');
    const [defaultLocation, setDefaultLocation] = useState<PermissionValue>('ask');
    const [sitePermissions, _setSitePermissions] = useState<SitePermissions>({});

    // Fetch blocker status
    const refreshBlockerStatus = useCallback(async () => {
        try {
            // @ts-ignore
            const status = await window.ipcRenderer?.invoke('blocker:status');
            if (status) setBlockerStatus(status);
        } catch { }
    }, []);

    useEffect(() => {
        refreshBlockerStatus();
        const interval = setInterval(refreshBlockerStatus, 3000);
        return () => clearInterval(interval);
    }, [refreshBlockerStatus]);

    // Sync privacy settings with Chromium
    useEffect(() => {
        // @ts-ignore
        window.ipcRenderer?.privacy?.setSettings?.({ blockThirdPartyCookies, doNotTrack });
    }, [blockThirdPartyCookies, doNotTrack]);

    const toggleBlocker = async () => {
        try {
            // @ts-ignore
            const newState = await window.ipcRenderer?.invoke('blocker:toggle');
            setBlockerStatus(prev => ({ ...prev, isEnabled: newState }));
        } catch { }
    };

    const setBlockerLevel = async (level: BlockerLevel) => {
        try {
            // @ts-ignore
            const status = await window.ipcRenderer?.invoke('blocker:set-level', level);
            if (status) setBlockerStatus(status);
        } catch { }
    };

    const toggleYoutubeBlocking = async () => {
        try {
            // @ts-ignore
            const status = await window.ipcRenderer?.invoke('blocker:set-youtube', !blockerStatus.youtubeAdsBlocked);
            if (status) setBlockerStatus(status);
        } catch { }
    };

    const addWhitelist = async () => {
        const domain = whitelistInput.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
        if (!domain || !domain.includes('.')) return;
        try {
            // @ts-ignore
            const status = await window.ipcRenderer?.invoke('blocker:add-whitelist', domain);
            if (status) setBlockerStatus(status);
            setWhitelistInput('');
        } catch { }
    };

    const removeWhitelist = async (domain: string) => {
        try {
            // @ts-ignore
            const status = await window.ipcRenderer?.invoke('blocker:remove-whitelist', domain);
            if (status) setBlockerStatus(status);
        } catch { }
    };

    const toggle = async (key: 'blockThirdPartyCookies' | 'doNotTrack') => {
        const val = key === 'blockThirdPartyCookies' ? blockThirdPartyCookies : doNotTrack;
        setPrivacySettings({ [key]: !val });
    };

    const handleClearData = async () => {
        setIsClearing(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
            // @ts-ignore
            await window.ipcRenderer?.privacy?.clearData?.({ storages: ['cookies', 'localstorage', 'caches', 'indexdb'] });
            clearHistory();
            setCleared(true);
        } catch (error) {
            console.error('Failed to clear data:', error);
        } finally {
            setIsClearing(false);
            setTimeout(() => setCleared(false), 3000);
        }
    };

    const LEVEL_INFO: Record<BlockerLevel, { icon: typeof Shield; label: string; desc: string; color: string }> = {
        standard: { icon: Shield, label: 'Standard', desc: 'Blocks major ad networks and trackers', color: 'text-blue-400' },
        aggressive: { icon: ShieldCheck, label: 'Aggressive', desc: 'Blocks ads, trackers, analytics, and crypto miners', color: 'text-green-400' },
        maximum: { icon: ShieldAlert, label: 'Maximum', desc: 'Blocks everything including fake news, gambling, and adult content domains', color: 'text-orange-400' },
    };

    const PermissionRow = ({ icon: Icon, label, description, value, onChange }: {
        icon: typeof Camera; label: string; description: string; value: PermissionValue; onChange: (val: PermissionValue) => void;
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
            {/* ═══ Privacy Overview ═══ */}
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
                    <div className="flex gap-4 mt-6 flex-wrap">
                        <div className="bg-black/20 backdrop-blur-sm rounded-lg p-3 border border-white/5 flex-1 min-w-[140px] max-w-[200px]">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Ads Blocked</div>
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${blockerStatus.isEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="text-sm font-medium">{blockerStatus.blockedCount.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="bg-black/20 backdrop-blur-sm rounded-lg p-3 border border-white/5 flex-1 min-w-[140px] max-w-[200px]">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Filter Rules</div>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-sm font-medium">{blockerStatus.totalDomains.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="bg-black/20 backdrop-blur-sm rounded-lg p-3 border border-white/5 flex-1 min-w-[140px] max-w-[200px]">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('settings.privacy.trust.cookies')}</div>
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${blockThirdPartyCookies ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                <span className="text-sm font-medium">
                                    {blockThirdPartyCookies ? t('settings.privacy.trust.blocked') : t('settings.privacy.trust.allowed')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ Ad Blocker ═══ */}
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                            <Zap className="w-4 h-4 text-primary" />
                            Ad & Tracker Blocker
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">Block ads, trackers, and malicious content at the network level</p>
                    </div>
                    <button
                        onClick={toggleBlocker}
                        className={`transition-colors ${blockerStatus.isEnabled ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                        {blockerStatus.isEnabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                    </button>
                </div>

                {/* Blocking Level */}
                <div className="mb-6">
                    <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Blocking Level</h5>
                    <div className="grid grid-cols-3 gap-2">
                        {(Object.keys(LEVEL_INFO) as BlockerLevel[]).map((level) => {
                            const info = LEVEL_INFO[level];
                            const Icon = info.icon;
                            const isActive = blockerStatus.level === level;
                            return (
                                <button
                                    key={level}
                                    onClick={() => setBlockerLevel(level)}
                                    className={`flex flex-col items-center p-3 rounded-xl border transition-all text-center ${isActive
                                        ? 'bg-primary/10 border-primary text-primary'
                                        : 'bg-background border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted/50'
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 mb-2 ${isActive ? 'text-primary' : info.color}`} />
                                    <span className="text-xs font-medium">{info.label}</span>
                                    <span className="text-[10px] text-muted-foreground mt-1 leading-tight">{info.desc}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* YouTube Ad Blocking */}
                <div className="flex items-center justify-between py-3 border-t border-border">
                    <div className="flex items-center">
                        <Youtube className="w-4 h-4 text-red-500 mr-3" />
                        <div>
                            <div className="text-sm text-foreground font-medium">YouTube Ad Blocker</div>
                            <div className="text-xs text-muted-foreground mt-0.5">Skip and hide video ads, banner ads, and premium upsells</div>
                        </div>
                    </div>
                    <button
                        onClick={toggleYoutubeBlocking}
                        className={`transition-colors ${blockerStatus.youtubeAdsBlocked ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                        {blockerStatus.youtubeAdsBlocked ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                    </button>
                </div>

                {/* Whitelist */}
                <div className="pt-4 mt-2 border-t border-border">
                    <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Whitelisted Sites</h5>
                    <p className="text-xs text-muted-foreground mb-3">Ads will not be blocked on these websites</p>

                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            value={whitelistInput}
                            onChange={(e) => setWhitelistInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addWhitelist()}
                            placeholder="example.com"
                            className="flex-1 bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                            onClick={addWhitelist}
                            className="px-3 py-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors text-sm font-medium flex items-center gap-1"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add
                        </button>
                    </div>

                    {blockerStatus.whitelist.length > 0 ? (
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                            {blockerStatus.whitelist.map((domain) => (
                                <div key={domain} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 group">
                                    <span className="text-sm text-foreground">{domain}</span>
                                    <button
                                        onClick={() => removeWhitelist(domain)}
                                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground/50 italic">No whitelisted sites</p>
                    )}
                </div>
            </div>

            {/* ═══ Tracking Protections ═══ */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-6">{t('settings.privacy.tracking.title')}</h4>
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-foreground font-medium">{t('settings.privacy.tracking.thirdPartyCookies.title')}</div>
                            <div className="text-xs text-muted-foreground mt-1">{t('settings.privacy.tracking.thirdPartyCookies.description')}</div>
                        </div>
                        <button onClick={() => toggle('blockThirdPartyCookies')} className={`transition-colors ${blockThirdPartyCookies ? 'text-primary' : 'text-muted-foreground'}`}>
                            {blockThirdPartyCookies ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                        </button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-foreground font-medium">{t('settings.privacy.tracking.dnt.title')}</div>
                            <div className="text-xs text-muted-foreground mt-1">{t('settings.privacy.tracking.dnt.description')}</div>
                        </div>
                        <button onClick={() => toggle('doNotTrack')} className={`transition-colors ${doNotTrack ? 'text-primary' : 'text-muted-foreground'}`}>
                            {doNotTrack ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ Site Permissions ═══ */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-4">{t('settings.privacy.permissions.title')}</h4>
                <p className="text-xs text-muted-foreground mb-4">{t('settings.privacy.permissions.description')}</p>
                <div className="divide-y divide-border">
                    <PermissionRow icon={Camera} label={t('settings.privacy.permissions.camera.label')} description={t('settings.privacy.permissions.camera.description')} value={defaultCamera} onChange={setDefaultCamera} />
                    <PermissionRow icon={Mic} label={t('settings.privacy.permissions.mic.label')} description={t('settings.privacy.permissions.mic.description')} value={defaultMic} onChange={setDefaultMic} />
                    <PermissionRow icon={MapPin} label={t('settings.privacy.permissions.location.label')} description={t('settings.privacy.permissions.location.description')} value={defaultLocation} onChange={setDefaultLocation} />
                </div>
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

            {/* ═══ Clear Browsing Data ═══ */}
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
                        : 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20'}`}
                >
                    {isClearing ? (
                        <span className="animate-pulse">{t('settings.privacy.clearData.cleaning')}</span>
                    ) : cleared ? (
                        <><Check className="w-4 h-4 mr-2" />{t('settings.privacy.clearData.cleaned')}</>
                    ) : (
                        <><Trash2 className="w-4 h-4 mr-2" />{t('settings.privacy.clearData.button')}</>
                    )}
                </button>
            </div>
        </div>
    );
}
