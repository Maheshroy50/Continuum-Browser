import { AlertTriangle, Lock, Unlock, ArrowLeft } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface SecurityInterstitialProps {
    url: string;
    originalUrl: string;
    error: string;
    onGoBack: () => void;
    onAllowInsecure: (url: string) => void;
}

export function SecurityInterstitial({ url, originalUrl, error, onGoBack, onAllowInsecure }: SecurityInterstitialProps) {
    const { t } = useTranslation();

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-fade-in text-foreground">
            <div className="max-w-xl w-full text-center space-y-6">
                <div className="mx-auto w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="w-12 h-12 text-red-500" />
                </div>

                <h1 className="text-3xl font-bold text-foreground">
                    {t('security.connectionNotPrivate', 'Your connection is not private')}
                </h1>

                <p className="text-muted-foreground text-lg">
                    {t('security.httpsUpgradeFailed', 'Continuum tried to upgrade this connection to HTTPS, but the server does not support it.')}
                </p>

                <div className="bg-muted/50 rounded-lg p-4 text-left border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                        <Lock className="w-4 h-4 text-green-500" />
                        <span className="font-mono text-sm text-muted-foreground line-through decoration-red-500">
                            {url}
                        </span>
                    </div>
                    <div className="text-xs text-red-400 font-mono">
                        Error: {error}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                    <button
                        onClick={onGoBack}
                        className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 justify-center"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        {t('security.goBack', 'Go Back (Recommended)')}
                    </button>

                    <button
                        onClick={() => onAllowInsecure(originalUrl)}
                        className="px-8 py-3 bg-transparent border border-border text-muted-foreground rounded-lg font-medium hover:bg-muted/50 transition-colors flex items-center gap-2 justify-center"
                    >
                        <Unlock className="w-4 h-4" />
                        {t('security.loadInsecure', 'Load Insecurely (Risky)')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
