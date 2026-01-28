import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Copy, Check, Cast, Smartphone, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useSyncState, SyncService } from '../../../services/SyncService';

// Reusing layout components from other sections for consistency
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-medium text-foreground">{title}</h3>
                {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
            </div>
            <div className="space-y-3">
                {children}
            </div>
        </div>
    );
}

function Action({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`flex items-center justify-between p-3 rounded-lg bg-card border border-border ${className}`}>
            {children}
        </div>
    );
}

export function SyncSection() {
    const { t } = useTranslation();
    const { isConnected, peerCount, syncId, lastError } = useSyncState();

    // Local state for inputs
    const [localSyncId, setLocalSyncId] = useState('');
    const [joinKey, setJoinKey] = useState('');
    const [justCopied, setJustCopied] = useState(false);

    // Initialize local ID if one exists
    useEffect(() => {
        if (syncId) setLocalSyncId(syncId);
    }, [syncId]);

    const handleGenerateKey = () => {
        const key = SyncService.generateKey();
        setLocalSyncId(key);
        // Auto-connect on generate? Maybe wait for user to click "Start Syncing"
    };

    const handleStartSync = () => {
        if (localSyncId) {
            SyncService.connect(localSyncId);
        }
    };

    const handleStopSync = () => {
        SyncService.disconnect();
    };

    const handleJoin = () => {
        if (joinKey) {
            setLocalSyncId(joinKey);
            SyncService.connect(joinKey);
            setJoinKey('');
        }
    };

    const copyToClipboard = () => {
        if (syncId) {
            navigator.clipboard.writeText(syncId);
            setJustCopied(true);
            setTimeout(() => setJustCopied(false), 2000);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="border-b border-border pb-6">
                <h2 className="text-2xl font-semibold tracking-tight mb-2">{t('settings.sync.title')}</h2>
                <p className="text-muted-foreground">
                    {t('settings.sync.description')}
                </p>
            </div>

            {/* Status Banner */}
            {isConnected ? (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center space-x-3">
                    <ShieldCheck className="w-5 h-5 text-green-500" />
                    <div className="flex-1">
                        <h4 className="text-sm font-medium text-green-700 dark:text-green-400">{t('settings.sync.activeTitle')}</h4>
                        <p className="text-xs text-green-600/80 dark:text-green-500/80">
                            {t('settings.sync.activeDesc', { count: peerCount })}
                        </p>
                    </div>
                    <button onClick={handleStopSync} className="text-xs bg-background/50 hover:bg-background px-3 py-1.5 rounded border border-green-500/30 transition-colors">
                        {t('settings.sync.disconnect')}
                    </button>
                </div>
            ) : (
                <div className="bg-muted/50 border border-border rounded-lg p-4 flex items-center space-x-3">
                    <Cast className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                        <h4 className="text-sm font-medium text-foreground">{t('settings.sync.inactiveTitle')}</h4>
                        <p className="text-xs text-muted-foreground">
                            {t('settings.sync.inactiveDesc')}
                        </p>
                    </div>
                </div>
            )}

            {lastError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center space-x-2 text-destructive text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Error: {lastError}</span>
                </div>
            )}

            <Section title={t('settings.sync.identityTitle')} description={t('settings.sync.identityDesc')}>
                {isConnected ? (
                    <Action>
                        <div className="flex-1 min-w-0 mr-4">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">{t('settings.sync.yourKey')}</div>
                            <div className="font-mono text-sm truncate bg-muted p-2 rounded select-all">
                                {syncId}
                            </div>
                        </div>
                        <button
                            onClick={copyToClipboard}
                            className="p-2 hover:bg-muted rounded-md transition-colors"
                            title="Copy Key"
                        >
                            {justCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </Action>
                ) : (
                    <Action>
                        <div className="flex-1">
                            <div className="text-sm font-medium text-foreground">{t('settings.sync.generateKey')}</div>
                            <div className="text-xs text-muted-foreground">{t('settings.sync.generateDesc')}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                            {localSyncId && (
                                <button
                                    onClick={handleStartSync}
                                    className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors"
                                >
                                    {t('settings.sync.startSync')}
                                </button>
                            )}
                            <button
                                onClick={handleGenerateKey}
                                className="px-3 py-2 bg-muted text-foreground text-sm font-medium rounded hover:bg-muted/80 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                    </Action>
                )}
            </Section>

            <Section title={t('settings.sync.joinTitle')} description={t('settings.sync.joinDesc')}>
                <Action>
                    <div className="flex-1 flex gap-2">
                        <input
                            type="text"
                            placeholder={t('settings.sync.pasteKey')}
                            value={joinKey}
                            onChange={(e) => setJoinKey(e.target.value)}
                            className="flex-1 bg-background border border-input rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                        />
                        <button
                            onClick={handleJoin}
                            disabled={!joinKey}
                            className="px-4 py-2 bg-secondary text-secondary-foreground text-sm font-medium rounded hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {t('settings.sync.joinButton')}
                        </button>
                    </div>
                </Action>
            </Section>

            <div className="pt-4 border-t border-border">
                <div className="flex items-start text-xs text-muted-foreground">
                    <Smartphone className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
                    <p>
                        {t('settings.sync.footer')}
                    </p>
                </div>
            </div>
        </div>
    );
}
