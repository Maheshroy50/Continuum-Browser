import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// import { useTranslation } from 'react-i18next';
// import { SUPPORTED_LANGUAGES, LanguageCode, POPULAR_LANGUAGES } from '../i18n';
// import { usePreferencesStore } from '../store/usePreferencesStore';
import { Sun, Moon } from 'lucide-react';

// Inline simple language list to avoid importing from i18n which might cause side-effects
const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    // Add missing languages in UI
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    // Indian Regional
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
    { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
];

const POPULAR_LANGUAGES = ['es', 'fr', 'de', 'hi', 'zh'];

type LanguageCode = string;
type Theme = 'light' | 'dark';

// LocalStorage keys
const WELCOME_SEEN_KEY = 'continuum-welcome-seen';
const PREFS_KEY = 'continuum-preferences';

function hasSeenWelcome(): boolean {
    try {
        return localStorage.getItem(WELCOME_SEEN_KEY) === 'true';
    } catch {
        return false;
    }
}

function setWelcomeSeen() {
    try {
        localStorage.setItem(WELCOME_SEEN_KEY, 'true');
    } catch { }
}

// Detect system language
function detectSystemLanguage(): LanguageCode {
    try {
        const systemLang = navigator.language.split('-')[0];
        if (SUPPORTED_LANGUAGES.some(l => l.code === systemLang)) {
            return systemLang;
        }
    } catch { }
    return 'en';
}

interface WelcomeScreenProps {
    onGetStarted: () => void;
}

export function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
    const [selectedTheme, setSelectedTheme] = useState<Theme>('dark');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isPopularExpanded, setIsPopularExpanded] = useState(false);

    // Suggest system language
    const systemLangCode = useMemo(() => detectSystemLanguage(), []);
    const suggestedLang = useMemo(() =>
        SUPPORTED_LANGUAGES.find(l => l.code === systemLangCode),
        [systemLangCode]
    );

    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Apply Theme Immediately
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('light', 'dark', 'midnight', 'seoul-night', 'soft-cafe', 'blossom-pink', 'milk-tea', 'mint-breeze');
        root.classList.add(selectedTheme);
    }, [selectedTheme]);

    // Save preferences to localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(PREFS_KEY);
            let prefs: any = { state: { language: 'en', theme: 'dark', version: 1 }, version: 1 };
            if (stored) {
                prefs = JSON.parse(stored);
            }
            if (!prefs.state) prefs.state = {};
            prefs.state.language = selectedLanguage;
            prefs.state.theme = selectedTheme;
            localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
        } catch (e) {
            console.error('Failed to save preferences manually', e);
        }
    }, [selectedLanguage, selectedTheme]);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLanguageSelect = useCallback((langCode: LanguageCode) => {
        setSelectedLanguage(langCode);
        setIsDropdownOpen(false);
    }, []);

    const handleGetStarted = useCallback(() => {
        setWelcomeSeen();
        onGetStarted();
    }, [onGetStarted]);

    const selectedLangInfo = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage);

    const filteredLanguages = useMemo(() => {
        if (!searchQuery) return SUPPORTED_LANGUAGES;
        const q = searchQuery.toLowerCase();
        return SUPPORTED_LANGUAGES.filter(l =>
            l.name.toLowerCase().includes(q) ||
            l.nativeName.toLowerCase().includes(q) ||
            l.code.toLowerCase().includes(q)
        );
    }, [searchQuery]);

    return (
        <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-[200]">
            <div className="max-w-md w-full text-center px-8">
                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center text-4xl text-primary font-bold">C</div>
                </div>
                <h1 className="text-4xl font-light tracking-tight text-foreground mb-4">
                    Welcome to Continuum
                </h1>

                <p className="text-xl text-muted-foreground mb-8">
                    The browser designed for focus and flow.
                </p>

                {/* Theme Selection */}
                <div className="mb-6">
                    <p className="text-sm text-muted-foreground mb-3 text-left pl-2">
                        Choose your theme
                    </p>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setSelectedTheme('light')}
                            className={`flex-1 p-4 rounded-xl border transition-all flex flex-col items-center justify-center ${selectedTheme === 'light'
                                ? 'bg-card border-primary ring-2 ring-primary ring-offset-2 ring-offset-background'
                                : 'bg-card/50 border-transparent hover:bg-muted'
                                }`}
                        >
                            <Sun className={`w-8 h-8 mb-2 ${selectedTheme === 'light' ? 'text-orange-500' : 'text-muted-foreground'}`} />
                            <span className={`text-sm font-medium ${selectedTheme === 'light' ? 'text-foreground' : 'text-muted-foreground'}`}>Light</span>
                        </button>

                        <button
                            onClick={() => setSelectedTheme('dark')}
                            className={`flex-1 p-4 rounded-xl border transition-all flex flex-col items-center justify-center ${selectedTheme === 'dark'
                                ? 'bg-card border-primary ring-2 ring-primary ring-offset-2 ring-offset-background'
                                : 'bg-card/50 border-transparent hover:bg-muted'
                                }`}
                        >
                            <Moon className={`w-8 h-8 mb-2 ${selectedTheme === 'dark' ? 'text-blue-400' : 'text-muted-foreground'}`} />
                            <span className={`text-sm font-medium ${selectedTheme === 'dark' ? 'text-foreground' : 'text-muted-foreground'}`}>Dark</span>
                        </button>
                    </div>
                </div>

                {/* Language Selection */}
                <div className="mb-8 relative" ref={dropdownRef}>
                    <p className="text-sm text-muted-foreground mb-3 text-left pl-2">
                        Choose your language
                    </p>

                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center justify-between w-full px-4 py-3 bg-card hover:bg-muted border border-border rounded-lg text-foreground transition-colors"
                    >
                        <span className="truncate">
                            {selectedLangInfo?.nativeName} ({selectedLangInfo?.name})
                        </span>
                        <span className={`text-xs ml-2 text-muted-foreground transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-xl overflow-hidden z-10 flex flex-col max-h-[300px]">
                            <div className="p-2 border-b border-border sticky top-0 bg-popover z-20">
                                <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">🔍</span>
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Search..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full h-9 pl-9 pr-3 bg-muted rounded border-none focus:ring-1 focus:ring-primary outline-none text-sm text-foreground placeholder:text-muted-foreground"
                                    />
                                </div>
                            </div>
                            <div className="overflow-y-auto flex-1 py-1">
                                {searchQuery ? (
                                    filteredLanguages.length > 0 ? (
                                        filteredLanguages.map(lang => (
                                            <LanguageOption
                                                key={lang.code}
                                                lang={lang}
                                                isSelected={lang.code === selectedLanguage}
                                                onSelect={handleLanguageSelect}
                                            />
                                        ))
                                    ) : (
                                        <div className="px-4 py-8 text-center text-muted-foreground text-sm">No languages found</div>
                                    )
                                ) : (
                                    <>
                                        {suggestedLang && (
                                            <div className="mb-1">
                                                <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Suggested</div>
                                                <LanguageOption lang={suggestedLang} isSelected={suggestedLang.code === selectedLanguage} onSelect={handleLanguageSelect} />
                                            </div>
                                        )}
                                        <div className="h-px bg-border my-1 mx-2" />
                                        <div className="mb-1">
                                            <button
                                                onClick={() => setIsPopularExpanded(!isPopularExpanded)}
                                                className="w-full px-3 py-1.5 flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                                            >
                                                <span>Popular</span>
                                                <span className={`text-xs transition-transform ${isPopularExpanded ? 'rotate-90' : ''}`}>▶</span>
                                            </button>
                                            {isPopularExpanded && (
                                                <div className="pb-1">
                                                    {SUPPORTED_LANGUAGES.filter(l => POPULAR_LANGUAGES.includes(l.code) && l.code !== suggestedLang?.code).map(lang => (
                                                        <LanguageOption key={lang.code} lang={lang} isSelected={lang.code === selectedLanguage} onSelect={handleLanguageSelect} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="h-px bg-border my-1 mx-2" />
                                        <div>
                                            <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">All Languages</div>
                                            {SUPPORTED_LANGUAGES.map(lang => (
                                                <LanguageOption key={lang.code} lang={lang} isSelected={lang.code === selectedLanguage} onSelect={handleLanguageSelect} />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Search Engine Info */}
                <div className="mb-6 p-4 bg-card/50 rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground mb-2">
                        Your default search engine
                    </p>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {selectedLanguage === 'ko' ? (
                                <>
                                    <div className="w-8 h-8 rounded-md bg-green-500/20 flex items-center justify-center text-green-500 font-bold text-sm">N</div>
                                    <div>
                                        <p className="text-foreground font-medium">Naver</p>
                                        <p className="text-xs text-muted-foreground">Popular in Korea</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-8 h-8 rounded-md bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-sm">G</div>
                                    <div>
                                        <p className="text-foreground font-medium">Google</p>
                                        <p className="text-xs text-muted-foreground">Default search engine</p>
                                    </div>
                                </>
                            )}
                        </div>
                        <span className="text-xs text-muted-foreground/60">
                            Change in Settings
                        </span>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground/40 mb-8">
                    Created by Mahesh Rao
                </p>

                <button
                    onClick={handleGetStarted}
                    className="w-full px-8 py-3 bg-foreground text-background font-medium rounded-lg hover:opacity-90 transition-opacity text-base"
                >
                    Get Started
                </button>
            </div>
        </div>
    );
}

function LanguageOption({ lang, isSelected, onSelect }: {
    lang: typeof SUPPORTED_LANGUAGES[number],
    isSelected: boolean,
    onSelect: (code: string) => void
}) {
    return (
        <button
            onClick={() => onSelect(lang.code)}
            className={`w-full px-4 py-2 text-left hover:bg-muted transition-colors flex items-center justify-between group ${isSelected ? 'bg-muted/80' : ''
                }`}
        >
            <div className="flex flex-col">
                <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {lang.nativeName}
                </span>
                <span className="text-xs text-muted-foreground">
                    {lang.name}
                </span>
            </div>
            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </button>
    );
}

export function useWelcomeScreen() {
    const [showWelcome, setShowWelcome] = useState(false);

    useEffect(() => {
        if (!hasSeenWelcome()) {
            setShowWelcome(true);
        }
    }, []);

    const dismissWelcome = useCallback(() => {
        setShowWelcome(false);
    }, []);

    return { showWelcome, dismissWelcome };
}

export default WelcomeScreen;
