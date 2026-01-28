import { usePreferencesStore } from '../../../store/usePreferencesStore';
import { Search, ToggleLeft, ToggleRight, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function BrowsingSection() {
    const { t } = useTranslation();
    const searchEngine = usePreferencesStore(state => state.searchEngine);
    const setSearchEngine = usePreferencesStore(state => state.setSearchEngine);
    const openLinksInNewWorkspace = usePreferencesStore(state => state.openLinksInNewWorkspace);
    const setOpenLinksInNewWorkspace = usePreferencesStore(state => state.setOpenLinksInNewWorkspace);

    return (
        <div className="space-y-6">
            {/* Search Engine */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-4">{t('settings.browsing.searchEngine.title')}</h4>

                <div className="space-y-3">
                    {['google', 'duckduckgo', 'bing'].map((engine) => (
                        <button
                            key={engine}
                            onClick={() => setSearchEngine(engine as any)}
                            className={`w-full flex items-center p-3 rounded-lg border transition-all ${searchEngine === engine
                                ? 'bg-primary/10 border-primary text-primary'
                                : 'bg-background border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted/50'
                                }`}
                        >
                            <div className="flex-1 flex items-center">
                                <Search className="w-4 h-4 mr-3 opacity-70" />
                                <span className="text-sm font-medium capitalize">{t(`settings.browsing.searchEngine.options.${engine}`)}</span>
                            </div>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${searchEngine === engine ? 'border-primary' : 'border-neutral-600'
                                }`}>
                                {searchEngine === engine && <div className="w-2 h-2 rounded-full bg-primary" />}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Link Behavior */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-4">{t('settings.browsing.linkHandling.title')}</h4>

                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm text-foreground font-medium">{t('settings.browsing.linkHandling.openInNewWorkspace')}</div>
                        <div className="text-xs text-muted-foreground mt-1">{t('settings.browsing.linkHandling.description')}</div>
                    </div>

                    <button
                        onClick={() => setOpenLinksInNewWorkspace(!openLinksInNewWorkspace)}
                        className={`transition-colors ${openLinksInNewWorkspace ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                        {openLinksInNewWorkspace ? (
                            <ToggleRight className="w-8 h-8" />
                        ) : (
                            <ToggleLeft className="w-8 h-8" />
                        )}
                    </button>
                </div>
            </div>

            {/* Default Browser */}
            <DefaultBrowserStatus />
        </div>
    );
}

function DefaultBrowserStatus() {
    const { t } = useTranslation();
    const [isDefault, setIsDefault] = useState<boolean | null>(null);
    const [showManualHelp, setShowManualHelp] = useState(false);

    useEffect(() => {
        checkStatus();

        // Re-check periodically or on window focus
        window.addEventListener('focus', checkStatus);
        return () => window.removeEventListener('focus', checkStatus);
    }, []);

    const checkStatus = async () => {
        try {
            // @ts-ignore
            // if (window.ipcRenderer?.app) {
            //     // @ts-ignore
            //     const status = await window.ipcRenderer.app.isDefaultBrowser();
            //     setIsDefault(status);
            //     if (status) setShowManualHelp(false);
            // } else {
            //     setIsDefault(false);
            // }
            setIsDefault(false); // Stub
        } catch (e) {
            console.error('Failed to check default browser status:', e);
            setIsDefault(false);
        }
    };

    const handleSetDefault = async () => {
        try {
            // @ts-ignore
            // if (window.ipcRenderer?.app) {
            // @ts-ignore
            // const success = await window.ipcRenderer.app.setDefaultBrowser();
            // if (!success) {
            //     setShowManualHelp(true);
            // }
            // Check status again after a short delay
            // setTimeout(checkStatus, 1000);
            // }
            setShowManualHelp(true); // Stub
        } catch (e) {
            console.error('Failed to set default browser:', e);
        }
    };

    if (isDefault === null) {
        return (
            <div className="bg-card border border-border rounded-lg p-6 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-4"></div>
                <div className="h-8 bg-muted rounded w-full"></div>
            </div>
        );
    }

    return (
        <div className="bg-card border border-border rounded-lg p-6">
            <h4 className="text-sm font-medium text-foreground mb-4">{t('settings.browsing.defaultBrowser.title')}</h4>

            {isDefault ? (
                <div className="flex items-center gap-3 text-green-500 bg-green-500/10 p-4 rounded-lg border border-green-500/20">
                    <CheckCircle className="w-5 h-5" />
                    <div className="text-sm font-medium">{t('settings.browsing.defaultBrowser.isDefault')}</div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div>
                        <div className="text-base font-medium text-foreground mb-1">{t('settings.browsing.defaultBrowser.setAsDefault.title')}</div>
                        <div
                            className="text-sm text-muted-foreground leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: t('settings.browsing.defaultBrowser.setAsDefault.description') }}
                        />
                    </div>

                    <button
                        onClick={handleSetDefault}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                        {t('settings.browsing.defaultBrowser.setAsDefault.button')}
                    </button>

                    {showManualHelp && (
                        <div className="p-3 bg-muted/50 border border-border rounded-md text-xs text-muted-foreground">
                            <span className="font-semibold block mb-1">{t('settings.browsing.defaultBrowser.manualHelp.title')}</span>
                            <span dangerouslySetInnerHTML={{ __html: t('settings.browsing.defaultBrowser.manualHelp.description') }} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
