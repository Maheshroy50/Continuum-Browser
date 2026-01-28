// FULL APP - Premium WelcomeScreen with animations and polish
import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useFlowStore } from './store/useFlowStore';
import { usePreferencesStore } from './store/usePreferencesStore';
import { useReader } from './hooks/useReader';
import { useSyncIntegration } from './hooks/useSyncIntegration';
import { useTranslation } from 'react-i18next';
// import { invoke } from '@tauri-apps/api/core';
// import { listen } from '@tauri-apps/api/event';
import i18n, { SUPPORTED_LANGUAGES, POPULAR_LANGUAGES } from './i18n';
import logo from './assets/logo.png';
import { ExtensionsPanel } from './components/ExtensionsPanel';

// Lazy load all components
const Sidebar = React.lazy(() => import('./components/Sidebar'));
const AddressBar = React.lazy(() => import('./components/AddressBar'));
const FlowView = React.lazy(() => import('./components/FlowView'));
const NotesPanel = React.lazy(() => import('./components/NotesPanel'));
const ReaderView = React.lazy(() => import('./components/ReaderView').then(m => ({ default: m.ReaderView })));
const HistoryPanel = React.lazy(() => import('./components/HistoryPanel').then(m => ({ default: m.HistoryPanel })));
const ToastContainer = React.lazy(() => import('./components/Toast').then(m => ({ default: m.ToastContainer })));
const PrivateNetworkSentinel = React.lazy(() => import('./components/security/PrivateNetworkSentinel').then(m => ({ default: m.PrivateNetworkSentinel })));
import { ThemeBackground } from './components/ThemeBackground';
const SecurityInterstitial = React.lazy(() => import('./components/security/SecurityInterstitial').then(m => ({ default: m.SecurityInterstitial })));
const GoogleBlockInterstitial = React.lazy(() => import('./components/security/GoogleBlockInterstitial').then(m => ({ default: m.GoogleBlockInterstitial })));
const FlowSwitcherContainer = React.lazy(() => import('./components/FlowSwitcher').then(m => ({ default: m.FlowSwitcherContainer })));
const AIPanel = React.lazy(() => import('./components/AIPanel').then(m => ({ default: m.AIPanel })));

const PREFS_KEY = 'continuum-preferences';

// CSS for logo breathing animation and Hello fade
const logoBreathingStyle = `
@keyframes breathe {
    0%, 100% { transform: scale(1); opacity: 0.9; }
    50% { transform: scale(1.03); opacity: 1; }
}
@keyframes glow {
    0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.2); }
    50% { box-shadow: 0 0 35px rgba(59, 130, 246, 0.4); }
}
@keyframes fadeInOut {
    0%, 100% { opacity: 0; transform: translateY(4px); }
    15%, 85% { opacity: 1; transform: translateY(0); }
}
.logo-breathe {
    animation: breathe 2.5s ease-in-out infinite, glow 2.5s ease-in-out infinite;
}
.hello-fade {
    animation: fadeInOut 2.5s ease-in-out;
}
`;

// Ambient noise texture for premium feel
const noiseBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

// Multilingual greetings for Apple-style animation
const HELLO_GREETINGS = [
    'Hello',
    '안녕하세요',
    'こんにちは',
    'வணக்கம்',
    'Bonjour',
    'नमस्ते',
    'Hola',
    '你好',
    'Ciao',
    'Olá',
];

// Animated Hello component - Apple-style cycling

function AnimatedHello() {
    const [index, setIndex] = useState(0);
    const [key, setKey] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex(prev => (prev + 1) % HELLO_GREETINGS.length);
            setKey(prev => prev + 1); // Force re-render for animation
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="h-8 flex items-center justify-center mb-10">
            <span
                key={key}
                className="text-lg font-light text-muted-foreground/60 hello-fade"
            >
                {HELLO_GREETINGS[index]}
            </span>
        </div>
    );
}

function detectSystemLanguage(): string {
    try {
        const systemLang = navigator.language.split('-')[0];
        if (SUPPORTED_LANGUAGES.some(l => l.code === systemLang)) {
            return systemLang;
        }
    } catch { }
    return 'en';
}

// Premium WelcomeScreen with intentional minimalism and subtle motion
function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
    const { t } = useTranslation();
    const [selectedLanguage, setSelectedLanguage] = useState<string>(i18n.language || 'en');
    const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark'>(() => {
        try {
            const stored = localStorage.getItem(PREFS_KEY);
            if (stored) {
                const prefs = JSON.parse(stored);
                if (prefs.state?.theme === 'light' || prefs.state?.theme === 'dark') {
                    return prefs.state.theme;
                }
            }
        } catch { }
        return 'dark';
    });
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isPopularExpanded, setIsPopularExpanded] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const systemLangCode = useMemo(() => detectSystemLanguage(), []);
    const suggestedLang = useMemo(() =>
        SUPPORTED_LANGUAGES.find(l => l.code === systemLangCode),
        [systemLangCode]
    );

    const handleLanguageSelect = useCallback((langCode: string) => {
        setIsAnimating(true);
        setSelectedLanguage(langCode);
        setIsDropdownOpen(false);

        i18n.changeLanguage(langCode);

        try {
            const stored = localStorage.getItem(PREFS_KEY);
            let prefs: any = { state: { language: 'en' }, version: 0 };
            if (stored) prefs = JSON.parse(stored);
            if (!prefs.state) prefs.state = {};
            prefs.state.language = langCode;
            localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
        } catch (e) {
            console.error('Failed to save language preference', e);
        }

        setTimeout(() => setIsAnimating(false), 300);
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Theme Sync Effect
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('light', 'dark', 'midnight', 'seoul-night', 'soft-cafe', 'blossom-pink', 'milk-tea', 'mint-breeze');
        root.classList.add(selectedTheme);

        try {
            const stored = localStorage.getItem(PREFS_KEY);
            let prefs: any = { state: { language: 'en', theme: 'dark', version: 1 }, version: 1 };
            if (stored) prefs = JSON.parse(stored);
            if (!prefs.state) prefs.state = {};
            prefs.state.theme = selectedTheme;
            localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
        } catch (e) {
            console.error('Failed to save theme preference', e);
        }
    }, [selectedTheme]);

    const selectedLangInfo = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage);

    const filteredLanguages = useMemo(() => {
        if (!searchQuery) return [...SUPPORTED_LANGUAGES];
        return SUPPORTED_LANGUAGES.filter(l =>
            l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            l.nativeName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery]);

    return (
        <>
            <style>{logoBreathingStyle}</style>
            <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-[200] overflow-hidden">
                {/* Option 1: Subtle Radial Glow - Felt not seen */}
                <div
                    className="absolute inset-0 z-0 pointer-events-none"
                    style={{
                        background: 'radial-gradient(circle at 50% 35%, rgba(59, 130, 246, 0.06) 0%, transparent 60%)'
                    }}
                />

                {/* Option 2: Ambient Grain/Noise - Tactile feel */}
                <div
                    className="absolute inset-0 z-0 pointer-events-none opacity-[0.015]"
                    style={{ backgroundImage: noiseBg }}
                />

                <div className="relative z-10 max-w-lg text-center px-8">
                    {/* Animated Hello - Apple-style cycling */}
                    <AnimatedHello />

                    {/* Logo with breathing animation */}
                    <div className="flex justify-center mb-10">
                        <img
                            src={logo}
                            alt="Continuum"
                            className="w-24 h-24 rounded-2xl logo-breathe"
                        />
                    </div>

                    {/* Primary Statement - BOLD */}
                    <p className={`text-2xl font-medium text-foreground mb-4 lang-transition ${isAnimating ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}>
                        {t('welcome.subtitle', 'Resume your work, not your tabs.')}
                    </p>

                    {/* Secondary Description - Refined rhythm */}
                    <p className={`text-sm text-muted-foreground/55 mb-12 max-w-sm mx-auto leading-relaxed lang-transition ${isAnimating ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}
                        style={{ transitionDelay: '100ms' }}>
                        {t('welcome.description', 'A task-first browser that remembers context and lets you continue without interruption.')}
                    </p>

                    {/* Theme Selection - Added */}
                    <div className={`mb-8 lang-transition ${isAnimating ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`} style={{ transitionDelay: '50ms' }}>
                        <p className="text-xs text-muted-foreground/60 mb-3 uppercase tracking-wider">
                            Choose your theme
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => setSelectedTheme('light')}
                                className={`w-32 p-3 rounded-xl border transition-all flex flex-col items-center justify-center backdrop-blur-sm ${selectedTheme === 'light'
                                    ? 'bg-neutral-100/90 border-neutral-300 shadow-lg scale-105'
                                    : 'bg-muted/30 border-border/50 hover:bg-muted/50 text-muted-foreground'
                                    }`}
                            >
                                <Sun className={`w-6 h-6 mb-2 ${selectedTheme === 'light' ? 'text-orange-500' : 'text-current'}`} />
                                <span className={`text-xs font-medium ${selectedTheme === 'light' ? 'text-black' : 'text-current'}`}>Light</span>
                            </button>

                            <button
                                onClick={() => setSelectedTheme('dark')}
                                className={`w-32 p-3 rounded-xl border transition-all flex flex-col items-center justify-center backdrop-blur-sm ${selectedTheme === 'dark'
                                    ? 'bg-neutral-900/90 border-neutral-700 shadow-lg scale-105 ring-1 ring-white/10'
                                    : 'bg-muted/30 border-border/50 hover:bg-muted/50 text-muted-foreground'
                                    }`}
                            >
                                <Moon className={`w-6 h-6 mb-2 ${selectedTheme === 'dark' ? 'text-blue-400' : 'text-current'}`} />
                                <span className={`text-xs font-medium ${selectedTheme === 'dark' ? 'text-white' : 'text-current'}`}>Dark</span>
                            </button>
                        </div>
                    </div>

                    {/* Language Selection - Premium UX */}
                    <div className="mb-12 relative" ref={dropdownRef}>
                        <p className="text-xs text-muted-foreground/60 mb-3 uppercase tracking-wider">
                            {t('welcome.chooseLanguage', 'Choose your language')}
                        </p>

                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className={`flex items-center justify-between w-72 px-5 py-3.5 bg-muted/30 hover:bg-muted/50 border border-border/50 rounded-xl text-foreground transition-all mx-auto backdrop-blur-sm lang-transition ${isAnimating ? 'scale-95' : 'scale-100'}`}
                        >
                            <div className="flex items-center">
                                {/* Native — English format */}
                                <span className="text-base font-medium">{selectedLangInfo?.nativeName}</span>
                                <span className="text-muted-foreground mx-2">—</span>
                                <span className="text-sm text-muted-foreground">{selectedLangInfo?.name}</span>
                            </div>
                            <span className={`text-sm text-muted-foreground transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
                        </button>

                        {isDropdownOpen && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-neutral-200/50 dark:border-neutral-700/50 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[420px]">
                                {/* Search */}
                                <div className="p-3 border-b border-neutral-200/50 dark:border-neutral-800/50 sticky top-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl z-20">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">🔍</span>
                                        <input
                                            type="text"
                                            placeholder="Search language..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full h-10 pl-10 pr-4 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg border border-transparent focus:border-blue-500/50 outline-none text-sm text-neutral-900 dark:text-white placeholder:text-neutral-500"
                                        />
                                    </div>
                                </div>

                                {/* Language List */}
                                <div className="overflow-y-auto flex-1 py-2">
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
                                            <div className="px-4 py-8 text-center text-neutral-500 text-sm">No languages found</div>
                                        )
                                    ) : (
                                        <>
                                            {/* Suggested */}
                                            {suggestedLang && (
                                                <div className="mb-2">
                                                    <div className="px-4 py-2 text-[10px] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider">✨ Suggested</div>
                                                    <LanguageOption
                                                        lang={suggestedLang}
                                                        isSelected={suggestedLang.code === selectedLanguage}
                                                        onSelect={handleLanguageSelect}
                                                    />
                                                </div>
                                            )}

                                            <div className="h-px bg-neutral-200 dark:bg-neutral-800/50 my-2 mx-3" />

                                            {/* Indian Languages */}
                                            <div className="mb-2">
                                                <div className="px-4 py-2 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">🇮🇳 Indian Languages</div>
                                                {SUPPORTED_LANGUAGES
                                                    .filter(l => ['hi', 'ta', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa'].includes(l.code))
                                                    .map(lang => (
                                                        <LanguageOption
                                                            key={lang.code}
                                                            lang={lang}
                                                            isSelected={lang.code === selectedLanguage}
                                                            onSelect={handleLanguageSelect}
                                                        />
                                                    ))
                                                }
                                            </div>

                                            <div className="h-px bg-neutral-200 dark:bg-neutral-800/50 my-2 mx-3" />

                                            {/* Popular Global */}
                                            <div className="mb-2">
                                                <button
                                                    onClick={() => setIsPopularExpanded(!isPopularExpanded)}
                                                    className="w-full px-4 py-2 flex items-center justify-between text-[10px] font-semibold text-neutral-500 uppercase tracking-wider hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                                                >
                                                    <span>🌍 Popular Global</span>
                                                    <span className={`text-xs transition-transform duration-200 ${isPopularExpanded ? 'rotate-90' : ''}`}>▶</span>
                                                </button>
                                                {isPopularExpanded && SUPPORTED_LANGUAGES
                                                    .filter(l => POPULAR_LANGUAGES.includes(l.code as any))
                                                    .map(lang => (
                                                        <LanguageOption
                                                            key={lang.code}
                                                            lang={lang}
                                                            isSelected={lang.code === selectedLanguage}
                                                            onSelect={handleLanguageSelect}
                                                        />
                                                    ))
                                                }
                                            </div>

                                            <div className="h-px bg-neutral-200 dark:bg-neutral-800/50 my-2 mx-3" />

                                            {/* All Languages */}
                                            <div>
                                                <div className="px-4 py-2 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">All Languages</div>
                                                {SUPPORTED_LANGUAGES.map(lang => (
                                                    <LanguageOption
                                                        key={lang.code}
                                                        lang={lang}
                                                        isSelected={lang.code === selectedLanguage}
                                                        onSelect={handleLanguageSelect}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Continue Button - Aligned with philosophy */}
                    <button
                        onClick={onGetStarted}
                        className="px-10 py-3.5 bg-neutral-900 dark:bg-white text-white dark:text-black font-medium rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-100 hover:scale-[1.02] active:scale-[0.98] transition-all text-base shadow-lg shadow-black/5 dark:shadow-white/10"
                    >
                        {t('welcome.getStarted', 'Continue')}
                    </button>

                    {/* Trust Cue - Quiet reassurance */}
                    <p className="mt-4 text-[11px] text-muted-foreground/40">
                        {t('welcome.trustCue', 'No account required. Data stays on your device.')}
                    </p>
                </div>

                {/* Created By - Bottom Left, Signature style */}
                <div className="absolute bottom-5 left-5">
                    <p className="text-[10px] text-muted-foreground/40 font-light">
                        {t('welcome.createdBy', 'Created by Mahesh Rao')}
                    </p>
                </div>
            </div>
        </>
    );
}

function LanguageOption({ lang, isSelected, onSelect }: {
    lang: { code: string; name: string; nativeName: string };
    isSelected: boolean;
    onSelect: (code: string) => void;
}) {
    return (
        <button
            onClick={() => onSelect(lang.code)}
            className={`w-full px-4 py-2.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-all flex items-center justify-between group ${isSelected ? 'bg-blue-500/10' : ''}`}
        >
            <div className="flex items-center">
                {/* Native — English format */}
                <span className={`text-sm font-medium ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-700 dark:text-neutral-200 group-hover:text-black dark:group-hover:text-white'}`}>
                    {lang.nativeName}
                </span>
                <span className="text-neutral-400 dark:text-neutral-600 mx-1.5">—</span>
                <span className="text-[12px] text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-400">
                    {lang.name}
                </span>
            </div>
            {isSelected && (
                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                </div>
            )}
        </button>
    );
}

function hasSeenWelcome(): boolean {
    try {
        const welcomeFlag = localStorage.getItem('continuum-welcome-seen');
        const flowsData = localStorage.getItem('continuum-flows');

        console.log('[Welcome] hasSeenWelcome check:', {
            welcomeFlag,
            hasFlowsData: !!flowsData,
            flowsDataLength: flowsData?.length
        });

        // If the welcome flag explicitly says 'true', user has seen it
        if (welcomeFlag === 'true') {
            return true;
        }

        // If there's no flows data at all, this is a fresh install - show welcome
        if (!flowsData) {
            console.log('[Welcome] No flows data found - this is a fresh install');
            return false;
        }

        // If there IS flows data but no welcome flag, user cleared data - show welcome
        // (This handles the "Clear" button case)
        if (flowsData && welcomeFlag === null) {
            console.log('[Welcome] Flows data exists but no welcome flag - likely cleared data');
            return false;
        }

        return false;
    } catch (e) {
        console.log('[Welcome] hasSeenWelcome error:', e);
        return false;
    }
}

function setWelcomeSeen() {
    try {
        localStorage.setItem('continuum-welcome-seen', 'true');
        console.log('[Welcome] Welcome marked as seen');
    } catch { }
}

function App() {
    // Initialize showWelcome immediately to avoid flash of main app before welcome screen
    const [showWelcome, setShowWelcome] = useState(() => {
        const shouldShow = !hasSeenWelcome();
        console.log('[Welcome] Initial showWelcome state:', shouldShow);
        return shouldShow;
    });
    const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
    const { loadState, updatePageUrl } = useFlowStore();

    const isHistoryOpen = useFlowStore(state => state.isHistoryOpen);
    const historyOverlaySnapshot = useFlowStore(state => state.historyOverlaySnapshot);
    const activePageId = useFlowStore(state => state.activePageId);

    // Reader Mode
    const isReaderMode = useFlowStore(state => state.isReaderMode);
    const setReaderMode = useFlowStore(state => state.setReaderMode);
    const { article, isLoading, error, parseReader, clearReader } = useReader();

    // Initialize Sync Integration
    useSyncIntegration();

    useEffect(() => {
        if (isReaderMode) {
            parseReader();
        } else {
            clearReader();
        }
    }, [isReaderMode, parseReader, clearReader]);

    const appendToNotes = useFlowStore(state => state.appendToNotes);

    // Global IPC Listeners
    useEffect(() => {
        const handler = (_event: any, data: { text: string, url: string, title: string, flowId: string }) => {
            console.log('Received clip:', data);
            if (data.text) {
                const formattedClip = `\n> ${data.text}\n> *[${data.title || 'Source'}](${data.url})*\n\n`;
                const targetFlowId = data.flowId || useFlowStore.getState().activeFlowId;
                if (targetFlowId) {
                    useFlowStore.getState().appendToNotes(targetFlowId, formattedClip);
                }
            }
        };

        // @ts-ignore
        window.ipcRenderer?.on('send-to-notes', handler);

        return () => {
            // @ts-ignore
            window.ipcRenderer?.off('send-to-notes', handler);
        }
    }, [appendToNotes]);

    const handleReaderClose = () => {
        setReaderMode(false);
    };

    // Zen Mode State
    const isZenMode = useFlowStore(state => state.isZenMode);
    const sidebarHidden = usePreferencesStore(state => state.sidebarHidden);
    const [revealSidebar, setRevealSidebar] = useState(false);

    // Security Interstitial State
    const [securityAlert, setSecurityAlert] = useState<{ url: string, error: string, originalUrl: string } | null>(null);
    // Google Block Interstitial State (Trusted Handoff)
    const [googleBlockUrl, setGoogleBlockUrl] = useState<string | null>(null);

    const closeSwitcher = useCallback(() => {
        setIsSwitcherOpen(false);
        if (window.ipcRenderer?.views) window.ipcRenderer.views.show();
    }, []);

    // Handle Security Interstitial actions
    const handleSecurityGoBack = useCallback(() => {
        setSecurityAlert(null);
        if (window.ipcRenderer?.views) window.ipcRenderer.views.back();
    }, []);

    const handleSecurityAllow = useCallback((_url: string) => {
        // invoke('security:allow-insecure', url);
        setSecurityAlert(null);
        // Reload current view to retry with allow-list
        if (window.ipcRenderer?.views) window.ipcRenderer.views.reload();
    }, []);

    useEffect(() => {
        // Only load state and initialize views if we're not showing the welcome screen
        if (!showWelcome) {
            loadState();
        }

        // Listen for Security Interstitial trigger
        window.ipcRenderer?.on?.('view:load-interstitial', (_event: any, data: any) => {
            setSecurityAlert(data);
        });

        // Listen for Google Block Interstitial trigger (Trusted Handoff)
        window.ipcRenderer?.on?.('view:google-blocked', (_event: any, data: any) => {
            setGoogleBlockUrl(data.url);
        });

        if (window.ipcRenderer?.views?.onUrlUpdate) {
            window.ipcRenderer.views.onUrlUpdate(({ flowId, pageId, url }: { flowId: string, pageId: string, url: string }) => {
                updatePageUrl(flowId, pageId, url);
            });
            window.ipcRenderer.views.onTitleUpdate(({ flowId, pageId, title }: { flowId: string, pageId: string, title: string }) => {
                useFlowStore.getState().updatePageTitle(flowId, pageId, title);
            });
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSwitcherOpen(prev => {
                    if (prev) {
                        if (window.ipcRenderer?.views) window.ipcRenderer.views.show();
                        return false;
                    } else {
                        if (window.ipcRenderer?.views) window.ipcRenderer.views.hide();
                        return true;
                    }
                });
            }
        };

        const handleRemoteToggle = () => {
            setIsSwitcherOpen(prev => {
                if (prev) {
                    if (window.ipcRenderer?.views) window.ipcRenderer.views.show();
                    return false;
                } else {
                    if (window.ipcRenderer?.views) window.ipcRenderer.views.hide();
                    return true;
                }
            });
        };
        window.ipcRenderer?.on?.('view:toggle-switcher', handleRemoteToggle);

        // Listen for "Send to Notes" from context menu
        window.ipcRenderer?.on?.('send-to-notes', (_event: any, data: { text: string, flowId: string, url: string, title: string }) => {
            if (data.flowId && data.text) {
                const prefs = usePreferencesStore.getState();
                let content = data.text;

                if (prefs.notesAppendTitle && data.title) {
                    content = `**${data.title}**\n${content}`;
                }

                if (prefs.notesAppendUrl && data.url) {
                    content = `${content}\n*Source: ${data.url}*`;
                }

                useFlowStore.getState().appendToNotes(data.flowId, content);
            }
        });

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [loadState, updatePageUrl]);

    useEffect(() => {
        if (showWelcome) {
            // invoke('view_hide').catch(() => { });
        } else {
            // invoke('view_show').catch(() => { });
        }
    }, [showWelcome]);

    const handleGetStarted = useCallback(() => {
        setWelcomeSeen();
        setShowWelcome(false);
        // Load state after dismissing welcome screen
        loadState();
    }, [loadState]);

    // Zen Mode Effects
    useEffect(() => {
        // Toggle Traffic Lights based on Zen Mode
        // invoke('window:controls', !isZenMode);
    }, [isZenMode]);



    return (
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans relative">
            {showWelcome ? (
                <WelcomeScreen onGetStarted={handleGetStarted} />
            ) : (
                <>
                    <ThemeBackground />
                    <Suspense fallback={null}>
                        <ReaderView
                            article={article}
                            isOpen={isReaderMode}
                            onClose={handleReaderClose}
                            isLoading={isLoading}
                            error={error}
                        />
                    </Suspense>

                    <Suspense fallback={null}>
                        {/* Sidebar Container - Always rendered but conditionally hidden */}
                        <div
                            className={`
                                transition-all duration-300 ease-in-out z-[60] flex h-full border-r border-border bg-background/95 backdrop-blur-xl
                                ${isZenMode || sidebarHidden
                                    ? `absolute left-0 top-0 bottom-0 ${revealSidebar ? 'translate-x-0 shadow-2xl' : '-translate-x-full border-none'}`
                                    : 'relative translate-x-0 w-64'
                                }
                            `}
                            onMouseEnter={() => (isZenMode || sidebarHidden) && setRevealSidebar(true)}
                            onMouseLeave={() => (isZenMode || sidebarHidden) && setRevealSidebar(false)}
                        >
                            <Sidebar />
                        </div>

                        {/* Hover Trigger Zone for Zen Mode or Hidden Sidebar */}
                        {(isZenMode || sidebarHidden) && (
                            <div
                                className="fixed left-0 top-0 bottom-0 w-4 z-[60] bg-transparent"
                                onMouseEnter={() => setRevealSidebar(true)}
                            />
                        )}
                    </Suspense>

                    <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isZenMode && revealSidebar ? 'ml-64' : ''}`}>
                        <Suspense fallback={null}>
                            <AddressBar />
                        </Suspense>

                        <div className="flex-1 flex min-h-0 relative">
                            {!securityAlert && (
                                <Suspense fallback={null}>
                                    <FlowView />
                                </Suspense>
                            )}

                            {isHistoryOpen && (
                                <Suspense fallback={null}>
                                    <div className="absolute inset-0 z-50 flex justify-end">
                                        {historyOverlaySnapshot && (
                                            <div
                                                className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
                                                style={{ backgroundImage: `url(${historyOverlaySnapshot})` }}
                                            />
                                        )}
                                        <div className="absolute inset-0 bg-black/50" />
                                        <HistoryPanel />
                                    </div>
                                </Suspense>
                            )}
                        </div>
                    </div>

                    {!activePageId && (
                        <Suspense fallback={null}>
                            <NotesPanel />
                        </Suspense>
                    )}

                    <Suspense fallback={null}>
                        <ToastContainer />
                    </Suspense>

                    <Suspense fallback={null}>
                        <PrivateNetworkSentinel />
                    </Suspense>

                    {securityAlert && (
                        <Suspense fallback={null}>
                            <SecurityInterstitial
                                url={securityAlert.url}
                                error={securityAlert.error}
                                originalUrl={securityAlert.originalUrl}
                                onGoBack={handleSecurityGoBack}
                                onAllowInsecure={handleSecurityAllow}
                            />
                        </Suspense>
                    )}

                    {googleBlockUrl && (
                        <Suspense fallback={null}>
                            <GoogleBlockInterstitial
                                url={googleBlockUrl}
                                onGoBack={() => {
                                    if (window.ipcRenderer?.views) window.ipcRenderer.views.back();
                                    setGoogleBlockUrl(null);
                                }}
                                onOpenExternal={(_url) => {
                                    // invoke('open_external', { url });
                                    setGoogleBlockUrl(null);
                                }}
                            />
                        </Suspense>
                    )}

                    <Suspense fallback={null}>
                        <ExtensionsPanel />
                    </Suspense>

                    <Suspense fallback={null}>
                        <FlowSwitcherContainer
                            isOpen={isSwitcherOpen}
                            onClose={closeSwitcher}
                        />
                    </Suspense>

                    <Suspense fallback={null}>
                        <AIPanel />
                    </Suspense>
                </>
            )}
        </div>
    );
}

export default App;
