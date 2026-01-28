import { useTranslation } from 'react-i18next';
import { usePreferencesStore } from '../../../store/usePreferencesStore';
import { SUPPORTED_LANGUAGES } from '../../../i18n';
import { Check } from 'lucide-react';

export function LanguageSection() {
    const { t, i18n } = useTranslation();
    const language = usePreferencesStore(state => state.language);
    const setLanguage = usePreferencesStore(state => state.setLanguage);

    // Handle language change: update store AND i18n
    const handleLanguageChange = (langCode: string) => {
        setLanguage(langCode);

        // Resolve actual language for i18n
        if (langCode === 'system') {
            const systemLang = navigator.language.split('-')[0];
            const resolved = SUPPORTED_LANGUAGES.some(l => l.code === systemLang)
                ? systemLang
                : 'en';
            i18n.changeLanguage(resolved);
        } else {
            i18n.changeLanguage(langCode);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
                <h4 className="text-sm font-medium text-foreground mb-4">{t('settings.language.interfaceLanguage')}</h4>

                <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
                    {/* System Default Option */}
                    <button
                        onClick={() => handleLanguageChange('system')}
                        className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm transition-all ${language === 'system'
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-background border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted/50'
                            }`}
                    >
                        <span className="font-medium">{t('settings.language.systemDefault')}</span>
                        {language === 'system' && <Check className="w-4 h-4" />}
                    </button>

                    {/* Supported Languages */}
                    {SUPPORTED_LANGUAGES.map(lang => {
                        const isSelected = language === lang.code;
                        return (
                            <button
                                key={lang.code}
                                onClick={() => handleLanguageChange(lang.code)}
                                className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm transition-all ${isSelected
                                    ? 'bg-primary/10 border-primary text-primary'
                                    : 'bg-background border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted/50'
                                    }`}
                            >
                                <div className="text-left">
                                    <div className="font-medium">{lang.nativeName}</div>
                                    <div className="text-xs opacity-60">{lang.name}</div>
                                </div>
                                {isSelected && <Check className="w-4 h-4" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

