import logo from '../../../assets/logo.png';
import bmcLogo from '../../../assets/bmc-logo.svg';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '../../../store/useFlowStore';

export function AboutSection() {
    const { t } = useTranslation();
    const { activeFlowId, addPageToFlow } = useFlowStore();

    const handleBuyMeACoffee = () => {
        if (!activeFlowId) return;
        const newPageId = crypto.randomUUID();
        addPageToFlow(activeFlowId, {
            id: newPageId,
            url: 'https://buymeacoffee.com/ContinuumBrowser',
            title: 'Buy Me a Coffee - Continuum Browser',
            favicon: '',
            lastVisited: Date.now(),
        } as any);
    };

    return (
        <div className="space-y-6 text-center pt-8">
            <div className="flex justify-center mb-4">
                <img src={logo} alt="Continuum Logo" className="w-20 h-20 rounded-2xl shadow-lg border border-border/50" />
            </div>

            <h2 className="text-2xl font-light text-foreground mb-2">{t('settings.about.appName')}</h2>
            <p className="text-muted-foreground mb-8">{t('settings.about.tagline')}</p>

            <div className="inline-block text-left bg-card border border-border rounded-lg p-6 w-full max-w-sm">
                <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">{t('settings.about.version')}</span>
                    <span className="text-foreground font-mono">2.0.0</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">{t('settings.about.createdBy')}</span>
                    <span className="text-foreground">Mahesh Rao</span>
                </div>
                <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">{t('settings.about.license')}</span>
                    <span className="text-foreground">MIT</span>
                </div>
            </div>

            <div className="pt-2">
                <button
                    onClick={handleBuyMeACoffee}
                    className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl font-semibold text-[#0D0C22] transition-all duration-200 hover:brightness-105 hover:scale-[1.03] active:scale-[0.98] shadow-md hover:shadow-lg"
                    style={{ backgroundColor: '#FFDD00' }}
                >
                    <img src={bmcLogo} alt="" className="w-6 h-6" />
                    <span className="text-[15px]">Buy me a coffee</span>
                </button>
            </div>
        </div>
    );
}
