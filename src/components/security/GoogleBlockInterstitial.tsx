import { ShieldAlert, ArrowLeft, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface GoogleBlockInterstitialProps {
    url: string;
    onGoBack: () => void;
    onOpenExternal: (url: string) => void;
}

export function GoogleBlockInterstitial({ url, onGoBack, onOpenExternal }: GoogleBlockInterstitialProps) {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-fade-in">
            <div className="max-w-xl w-full text-center space-y-6">
                {/* Warning Icon */}
                <div className="mx-auto w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4">
                    <ShieldAlert className="w-12 h-12 text-yellow-500" />
                </div>

                <h1 className="text-3xl font-bold text-foreground">
                    {t('security.protectedDomain', 'Protected Domain')}
                </h1>

                <p className="text-muted-foreground text-lg leading-relaxed">
                    <strong className="text-foreground">Google</strong> does not allow custom browsers to access login pages for security reasons.
                </p>

                <p className="text-muted-foreground text-sm">
                    {t('security.googleBlockExplain', 'To protect your account, we recommend using your default browser for Google services.')}
                </p>

                {/* URL Display */}
                <div className="bg-muted/50 rounded-lg p-4 text-left border border-border/50">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-yellow-500" />
                        <span className="font-mono text-sm text-muted-foreground truncate">
                            {url}
                        </span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                    <button
                        onClick={onGoBack}
                        className="px-8 py-3 bg-muted border border-border text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors flex items-center gap-2 justify-center"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        {t('security.goBack', 'Go Back')}
                    </button>

                    <button
                        onClick={() => onOpenExternal(url)}
                        className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 justify-center"
                    >
                        {t('security.openInBrowser', 'Open in Default Browser')}
                        <ExternalLink className="w-5 h-5" />
                    </button>
                </div>

                {/* Explanation Footer */}
                <p className="text-xs text-muted-foreground/60 pt-4">
                    {t('security.privacyNote', 'Continuum prioritizes privacy, which means some services may require your default browser.')}
                </p>
            </div>
        </div>
    );
}
