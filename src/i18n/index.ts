import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import hi from './hi.json';
import ta from './ta.json';
import te from './te.json';
import kn from './kn.json';
import ml from './ml.json';
import mr from './mr.json';
import bn from './bn.json';
import gu from './gu.json';
import pa from './pa.json';

import es from './es.json';
import fr from './fr.json';
import de from './de.json';
import pt from './pt.json';
import ru from './ru.json';
import zh from './zh.json';
import ja from './ja.json';
import ko from './ko.json';
import ar from './ar.json';

// Supported languages registry
export const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English' },

    // Indian Languages
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
    { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },

    // Global Languages
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

// Popular languages list (for the dropdown)
export const POPULAR_LANGUAGES: LanguageCode[] = [
    'es', 'fr', 'de', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar'
];

// Single source of truth: Read from Zustand preferences store
function getStoredLanguage(): LanguageCode {
    try {
        // Read from Zustand persist storage (continuum-preferences)
        const stored = localStorage.getItem('continuum-preferences');
        if (stored) {
            const parsed = JSON.parse(stored);
            const lang = parsed?.state?.language;

            // If language is set and valid, use it
            if (lang && lang !== 'system' && SUPPORTED_LANGUAGES.some(l => l.code === lang)) {
                return lang as LanguageCode;
            }

            // If 'system', detect from navigator
            if (lang === 'system') {
                const systemLang = navigator.language.split('-')[0];
                if (SUPPORTED_LANGUAGES.some(l => l.code === systemLang)) {
                    return systemLang as LanguageCode;
                }
            }
        }
    } catch { }

    // Auto-detect from system language as fallback
    try {
        const systemLang = navigator.language.split('-')[0];
        if (SUPPORTED_LANGUAGES.some(l => l.code === systemLang)) {
            return systemLang as LanguageCode;
        }
    } catch { }

    return 'en'; // Default to English
}

// Initialize i18n
i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            hi: { translation: hi },
            ta: { translation: ta },
            te: { translation: te },
            kn: { translation: kn },
            ml: { translation: ml },
            mr: { translation: mr },
            bn: { translation: bn },
            gu: { translation: gu },
            pa: { translation: pa },
            es: { translation: es },
            fr: { translation: fr },
            de: { translation: de },
            pt: { translation: pt },
            ru: { translation: ru },
            zh: { translation: zh },
            ja: { translation: ja },
            ko: { translation: ko },
            ar: { translation: ar },
        },
        lng: getStoredLanguage(),
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // React already escapes
        },
    });

export default i18n;

