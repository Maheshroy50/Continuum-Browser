import logo from '../../../assets/logo.png';
import { useTranslation } from 'react-i18next';

export function AboutSection() {
    const { t } = useTranslation();
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
                    <span className="text-foreground font-mono">0.0.1 (Alpha)</span>
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
        </div>
    );
}
