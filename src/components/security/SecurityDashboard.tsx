import { useState, useEffect, useCallback } from 'react';
import {
    Shield, ShieldCheck, ShieldAlert,
    Activity, Download, Globe, Zap, RefreshCw,
    AlertTriangle, CheckCircle2, XCircle, Lock,
    Wifi, Eye, Bug, Trash2, FolderLock,
    ToggleLeft, ToggleRight, TrendingUp
} from 'lucide-react';

interface ShieldConfig {
    enabled: boolean;
    safeBrowsingEnabled: boolean;
    downloadQuarantineEnabled: boolean;
    runtimeHardeningEnabled: boolean;
    fingerprintResistanceEnabled: boolean;
    behavioralMonitorEnabled: boolean;
    cryptoMiningProtection: boolean;
    mixedContentBlocking: boolean;
    cspEnforcement: boolean;
    webrtcIpProtection: boolean;
    autoUpdateFeeds: boolean;
    feedUpdateIntervalHours: number;
    virusTotalApiKey: string;
}

interface ShieldStats {
    threatsBlockedToday: number;
    phishingBlocked: number;
    malwareBlocked: number;
    downloadsQuarantined: number;
    cryptoMinersBlocked: number;
    mixedContentBlocked: number;
    fingerprintAttemptsBlocked: number;
    lastFeedUpdate: number;
    safeBrowsingDbSize: number;
    riskScores: Record<string, number>;
}

interface QuarantinedFile {
    name: string;
    size: number;
    quarantinedAt: number;
}

const DEFAULT_CONFIG: ShieldConfig = {
    enabled: true,
    safeBrowsingEnabled: true,
    downloadQuarantineEnabled: true,
    runtimeHardeningEnabled: true,
    fingerprintResistanceEnabled: true,
    behavioralMonitorEnabled: true,
    cryptoMiningProtection: true,
    mixedContentBlocking: true,
    cspEnforcement: true,
    webrtcIpProtection: true,
    autoUpdateFeeds: true,
    feedUpdateIntervalHours: 6,
    virusTotalApiKey: '',
};

export function SecurityDashboard() {
    const [config, setConfig] = useState<ShieldConfig>(DEFAULT_CONFIG);
    const [stats, setStats] = useState<ShieldStats>({
        threatsBlockedToday: 0, phishingBlocked: 0, malwareBlocked: 0,
        downloadsQuarantined: 0, cryptoMinersBlocked: 0, mixedContentBlocked: 0,
        fingerprintAttemptsBlocked: 0, lastFeedUpdate: 0, safeBrowsingDbSize: 0,
        riskScores: {},
    });
    const [quarantined, setQuarantined] = useState<QuarantinedFile[]>([]);
    const [isUpdatingFeeds, setIsUpdatingFeeds] = useState(false);
    const [siteUrl, setSiteUrl] = useState('');
    const [siteRisk, setSiteRisk] = useState<{ riskScore: number; threats: string[]; details: string[] } | null>(null);

    // Fetch initial data
    const refreshData = useCallback(async () => {
        try {
            // @ts-ignore
            const cfg = await window.ipcRenderer?.invoke('shield:get-config');
            if (cfg) setConfig(cfg);
            // @ts-ignore
            const st = await window.ipcRenderer?.invoke('shield:get-stats');
            if (st) setStats(st);
            // @ts-ignore
            const q = await window.ipcRenderer?.invoke('shield:list-quarantine');
            if (q) setQuarantined(q);
        } catch { }
    }, []);

    useEffect(() => {
        refreshData();
        const interval = setInterval(refreshData, 5000);
        return () => clearInterval(interval);
    }, [refreshData]);

    const toggleConfig = async (key: keyof ShieldConfig) => {
        const current = config[key];
        if (typeof current !== 'boolean') return;
        try {
            // @ts-ignore
            const updated = await window.ipcRenderer?.invoke('shield:update-config', { [key]: !current });
            if (updated) setConfig(updated);
        } catch { }
    };

    const updateFeeds = async () => {
        setIsUpdatingFeeds(true);
        try {
            // @ts-ignore
            const newStats = await window.ipcRenderer?.invoke('shield:update-feeds');
            if (newStats) setStats(newStats);
        } catch { }
        setIsUpdatingFeeds(false);
    };

    const checkSiteRisk = async () => {
        if (!siteUrl) return;
        try {
            let url = siteUrl;
            if (!url.startsWith('http')) url = 'https://' + url;
            // @ts-ignore
            const risk = await window.ipcRenderer?.invoke('shield:get-site-risk', url);
            if (risk) setSiteRisk(risk);
        } catch { }
    };

    const deleteQuarantined = async (name: string) => {
        try {
            // @ts-ignore
            await window.ipcRenderer?.invoke('shield:delete-quarantine', name);
            setQuarantined(prev => prev.filter(f => f.name !== name));
        } catch { }
    };

    const formatTime = (ts: number) => {
        if (!ts) return 'Never';
        const d = new Date(ts);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const overallScore = config.enabled
        ? Math.max(0, 100 - stats.threatsBlockedToday * 2)
        : 0;

    const scoreColor = overallScore >= 80 ? 'text-green-500' : overallScore >= 50 ? 'text-yellow-500' : 'text-red-500';
    const scoreBg = overallScore >= 80 ? 'from-green-900/10' : overallScore >= 50 ? 'from-yellow-900/10' : 'from-red-900/10';
    const scoreBorder = overallScore >= 80 ? 'border-green-500/20' : overallScore >= 50 ? 'border-yellow-500/20' : 'border-red-500/20';

    const ShieldToggle = ({ label, description, configKey, icon: Icon }: {
        label: string; description: string; configKey: keyof ShieldConfig; icon: typeof Shield;
    }) => {
        const val = config[configKey];
        const isOn = typeof val === 'boolean' ? val : false;
        return (
            <div className="flex items-center justify-between py-3">
                <div className="flex items-center">
                    <Icon className="w-4 h-4 text-muted-foreground mr-3" />
                    <div>
                        <div className="text-sm text-foreground font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                    </div>
                </div>
                <button
                    onClick={() => toggleConfig(configKey)}
                    className={`transition-colors ${isOn ? 'text-primary' : 'text-muted-foreground'}`}
                    disabled={!config.enabled && configKey !== 'enabled'}
                >
                    {isOn ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                </button>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* ═══ Shield Overview ═══ */}
            <div className={`bg-gradient-to-br ${scoreBg} to-transparent border ${scoreBorder} rounded-lg p-6 relative overflow-hidden`}>
                <div className="absolute top-0 right-0 p-3 opacity-20">
                    <ShieldCheck className={`w-24 h-24 ${scoreColor}`} />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className={`text-lg font-medium ${scoreColor} flex items-center gap-2`}>
                            <Shield className="w-5 h-5" />
                            Continuum Shield
                        </h3>
                        <button
                            onClick={() => toggleConfig('enabled')}
                            className={`transition-colors ${config.enabled ? 'text-green-500' : 'text-red-500'}`}
                        >
                            {config.enabled ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
                        </button>
                    </div>
                    <p className="text-sm text-muted-foreground opacity-90 max-w-md mb-4">
                        {config.enabled
                            ? 'Multi-layered security active — safe browsing, download quarantine, fingerprint resistance, and behavioral monitoring.'
                            : 'Shield is disabled. Enable to activate all security protections.'}
                    </p>

                    {/* Stat Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard icon={ShieldAlert} label="Threats Blocked" value={stats.threatsBlockedToday} color="text-red-400" />
                        <StatCard icon={Globe} label="Phishing Blocked" value={stats.phishingBlocked} color="text-orange-400" />
                        <StatCard icon={Bug} label="Malware Blocked" value={stats.malwareBlocked} color="text-red-500" />
                        <StatCard icon={Zap} label="Miners Blocked" value={stats.cryptoMinersBlocked} color="text-yellow-400" />
                    </div>

                    {/* Second row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                        <StatCard icon={Download} label="Quarantined" value={stats.downloadsQuarantined} color="text-amber-400" />
                        <StatCard icon={Eye} label="Fingerprint Blocks" value={stats.fingerprintAttemptsBlocked} color="text-purple-400" />
                        <StatCard icon={Lock} label="Mixed Content" value={stats.mixedContentBlocked} color="text-blue-400" />
                        <StatCard icon={Activity} label="DB Size" value={stats.safeBrowsingDbSize.toLocaleString()} color="text-green-400" />
                    </div>
                </div>
            </div>

            {/* ═══ Shield Feature Toggles ═══ */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Security Features
                </h4>
                <div className="divide-y divide-border">
                    <ShieldToggle icon={Globe} label="Safe Browsing" description="Check URLs against local phishing & malware database before navigation" configKey="safeBrowsingEnabled" />
                    <ShieldToggle icon={FolderLock} label="Download Quarantine" description="Scan downloads for suspicious files and quarantine dangerous ones" configKey="downloadQuarantineEnabled" />
                    <ShieldToggle icon={Lock} label="Runtime Hardening" description="Enforce strict CSP headers, block mixed content, strip leaky headers" configKey="runtimeHardeningEnabled" />
                    <ShieldToggle icon={Eye} label="Fingerprint Resistance" description="Spoof canvas, WebGL, audio, fonts, and hardware info to prevent tracking" configKey="fingerprintResistanceEnabled" />
                    <ShieldToggle icon={Activity} label="Behavioral Monitor" description="Detect crypto-mining scripts, excessive workers, and suspicious WebAssembly" configKey="behavioralMonitorEnabled" />
                    <ShieldToggle icon={Zap} label="Crypto-Mining Protection" description="Block known mining pools and suspicious WebSocket connections" configKey="cryptoMiningProtection" />
                    <ShieldToggle icon={Wifi} label="WebRTC IP Protection" description="Prevent WebRTC from leaking your real IP address" configKey="webrtcIpProtection" />
                    <ShieldToggle icon={Shield} label="Mixed Content Blocking" description="Auto-upgrade insecure requests on HTTPS pages" configKey="mixedContentBlocking" />
                </div>
            </div>

            {/* ═══ Site Risk Checker ═══ */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Site Risk Checker
                </h4>
                <p className="text-xs text-muted-foreground mb-3">Check if a URL is flagged in the threat database</p>
                <div className="flex gap-2 mb-3">
                    <input
                        type="text"
                        value={siteUrl}
                        onChange={(e) => setSiteUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && checkSiteRisk()}
                        placeholder="example.com"
                        className="flex-1 bg-muted border border-border rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                        onClick={checkSiteRisk}
                        className="px-3 py-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors text-sm font-medium"
                    >
                        Check
                    </button>
                </div>
                {siteRisk && (
                    <div className={`rounded-lg p-3 border ${siteRisk.riskScore === 0 ? 'bg-green-900/10 border-green-500/20' : 'bg-red-900/10 border-red-500/20'}`}>
                        <div className="flex items-center gap-2 mb-1">
                            {siteRisk.riskScore === 0
                                ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                : <XCircle className="w-4 h-4 text-red-500" />
                            }
                            <span className={`text-sm font-medium ${siteRisk.riskScore === 0 ? 'text-green-500' : 'text-red-500'}`}>
                                Risk Score: {siteRisk.riskScore}/100
                            </span>
                        </div>
                        {siteRisk.threats.length > 0 ? (
                            <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                {siteRisk.details.map((d, i) => (
                                    <li key={i} className="flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-red-400" />
                                        {d}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-green-400/80">No threats found in local database</p>
                        )}
                    </div>
                )}
            </div>

            {/* ═══ Threat Feed Management ═══ */}
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-primary" />
                            Threat Intelligence Feeds
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                            Last updated: {formatTime(stats.lastFeedUpdate)}
                        </p>
                    </div>
                    <button
                        onClick={updateFeeds}
                        disabled={isUpdatingFeeds}
                        className="px-3 py-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingFeeds ? 'animate-spin' : ''}`} />
                        {isUpdatingFeeds ? 'Updating...' : 'Update Now'}
                    </button>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between py-1">
                        <span>URLhaus (abuse.ch)</span>
                        <span className="text-green-400">Active</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                        <span>OpenPhish</span>
                        <span className="text-green-400">Active</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                        <span>PhishTank Community</span>
                        <span className="text-green-400">Active</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                        <span>Crypto-Miner Blocklist</span>
                        <span className="text-green-400">Active</span>
                    </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                    <ShieldToggle icon={RefreshCw} label="Auto-Update Feeds" description={`Automatically update every ${config.feedUpdateIntervalHours} hours`} configKey="autoUpdateFeeds" />
                </div>
            </div>

            {/* ═══ Quarantined Files ═══ */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                    <FolderLock className="w-4 h-4 text-amber-400" />
                    Quarantined Downloads
                </h4>
                {quarantined.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {quarantined.map((file) => (
                            <div key={file.name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-900/10 border border-amber-500/10 group">
                                <div>
                                    <div className="text-sm text-foreground truncate max-w-[280px]">{file.name.replace(/^[a-f0-9-]+_/, '')}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {formatBytes(file.size)} · {formatTime(file.quarantinedAt)}
                                    </div>
                                </div>
                                <button
                                    onClick={() => deleteQuarantined(file.name)}
                                    className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-all opacity-60 group-hover:opacity-100"
                                    title="Delete permanently"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground/50 italic">No quarantined files</p>
                )}
            </div>
        </div>
    );
}

// Stat card subcomponent
function StatCard({ icon: Icon, label, value, color }: {
    icon: typeof Shield; label: string; value: number | string; color: string;
}) {
    return (
        <div className="bg-black/20 backdrop-blur-sm rounded-lg p-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
            </div>
            <span className="text-sm font-medium text-foreground">{typeof value === 'number' ? value.toLocaleString() : value}</span>
        </div>
    );
}
