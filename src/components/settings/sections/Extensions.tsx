import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Puzzle, Download, Trash2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Extension {
    id: string;
    name: string;
    description: string;
    version: string;
    path: string;
}

export function ExtensionsSection() {
    const { t } = useTranslation();
    const [extensions, setExtensions] = useState<Extension[]>([]);
    // const [loading, setLoading] = useState(false);
    const [url, setUrl] = useState('');
    const [installStatus, setInstallStatus] = useState<'idle' | 'installing' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        loadExtensions();
    }, []);

    const loadExtensions = async () => {
        try {
            // @ts-ignore
            const list = await window.ipcRenderer?.extensions?.getAll();
            if (list) setExtensions(list);
        } catch (e) {
            console.error('Failed to load extensions', e);
        }
    };

    const handleInstall = async () => {
        if (!url) return;

        setInstallStatus('installing');
        setErrorMessage('');

        try {
            // @ts-ignore
            const result = await window.ipcRenderer?.extensions?.install(url);

            if (result.success) {
                setInstallStatus('success');
                setUrl('');
                loadExtensions(); // Refresh list
                setTimeout(() => setInstallStatus('idle'), 3000);
            } else {
                setInstallStatus('error');
                setErrorMessage(result.error || t('settings.extensions.failed'));
            }
        } catch (e: any) {
            setInstallStatus('error');
            setErrorMessage(e.message || 'Unknown error');
        }
    };

    const handleRemove = async (id: string) => {
        try {
            // @ts-ignore
            const result = await window.ipcRenderer?.extensions?.remove(id);
            if (result.success) {
                loadExtensions();
            }
        } catch (e) {
            console.error('Failed to remove extension', e);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-br from-blue-900/10 to-transparent border border-blue-500/20 rounded-lg p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-20">
                    <Puzzle className="w-24 h-24 text-blue-500" />
                </div>
                <div className="relative z-10">
                    <h3 className="text-lg font-medium text-blue-500 mb-2 flex items-center gap-2">
                        <Puzzle className="w-5 h-5" />
                        {t('settings.extensions.title')}
                    </h3>
                    <p className="text-sm text-muted-foreground opacity-90 max-w-md">
                        {t('settings.extensions.description')}
                    </p>
                </div>
            </div>

            {/* Install Section */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-4">{t('settings.extensions.installTitle')}</h4>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder={t('settings.extensions.placeholder')}
                        className="flex-1 bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                        onClick={handleInstall}
                        disabled={installStatus === 'installing' || !url}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {installStatus === 'installing' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        {t('settings.extensions.button')}
                    </button>
                </div>

                {installStatus === 'error' && (
                    <div className="mt-3 text-xs text-destructive flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {errorMessage}
                    </div>
                )}

                {installStatus === 'success' && (
                    <div className="mt-3 text-xs text-green-500 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('settings.extensions.success')}
                    </div>
                )}
            </div>

            {/* Installed List */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-4">{t('settings.extensions.installedTitle')} ({extensions.length})</h4>

                {extensions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        {t('settings.extensions.noExtensions')}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {extensions.map((ext) => (
                            <div key={ext.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-md border border-border/50">
                                <div>
                                    <div className="font-medium text-sm text-foreground flex items-center gap-2">
                                        {ext.name}
                                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">v{ext.version}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{ext.description}</div>
                                    <div className="text-[10px] text-muted-foreground/50 mt-1 font-mono">{ext.id}</div>
                                </div>
                                <button
                                    onClick={() => handleRemove(ext.id)}
                                    className="text-muted-foreground hover:text-destructive p-2 rounded-md hover:bg-destructive/10 transition-colors"
                                    title="Remove Extension"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
