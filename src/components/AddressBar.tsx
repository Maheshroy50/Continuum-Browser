import { ArrowLeft, ArrowRight, RotateCw, Search, Lock, Unlock, Download as DownloadIcon, Shield, ShieldAlert, X, Columns, Headphones, Sparkles, Clock } from 'lucide-react';
import { useState, KeyboardEvent, useEffect, useRef } from 'react';
import { useFlowStore } from '../store/useFlowStore';
// import { useExtensionStore } from '../store/useExtensionStore';
import { useTranslation } from 'react-i18next';
// import { invoke } from '@tauri-apps/api/core';
import { useSuggestions, Suggestion } from '../hooks/useSuggestions';
import SearchSuggestions from './SearchSuggestions';
import { SitePermissionsPanel } from './SitePermissionsPanel';
import { DownloadManager } from './DownloadManager';
import { useDownloads } from '../hooks/useDownloads';
import { useAIStore } from '../store/useAIStore';

import { usePreferencesStore } from '../store/usePreferencesStore';

// Search engines configuration
const SEARCH_ENGINES = {
    google: { name: 'Google', url: 'https://www.google.com/search?q=' },
    naver: { name: 'Naver', url: 'https://search.naver.com/search.naver?query=', locales: ['ko', 'ko-KR'] },
    bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
    duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
    yahoo: { name: 'Yahoo', url: 'https://search.yahoo.com/search?p=' },
    ecosia: { name: 'Ecosia', url: 'https://www.ecosia.org/search?q=' },
};

type SearchEngine = keyof typeof SEARCH_ENGINES;

function AddressBar() {
    usePreferencesStore();
    const { t } = useTranslation();
    const { activeFlowId, activePageId, addPageToFlow, toggleHistory } = useFlowStore();
    const toggleAIPanel = useAIStore(state => state.toggleIsOpen);
    const handleAIToggle = () => {
        // @ts-ignore
        if (window.ipcRenderer?.send) window.ipcRenderer.send('ai:toggle');
        else toggleAIPanel();
    };
    const [urlInput, setUrlInput] = useState('');
    const [searchEngine, setSearchEngine] = useState<SearchEngine>('google');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [blockerStatus, setBlockerStatus] = useState({ isEnabled: true, blockedCount: 0 });

    useEffect(() => {
        // Initial fetch
        // @ts-ignore
        if (window.ipcRenderer) {
            window.ipcRenderer.invoke('blocker:status').then((s: any) => setBlockerStatus(s)).catch(() => { });
        }

        // Poll for updates (simple way to keep count live)
        const interval = setInterval(() => {
            // @ts-ignore
            if (window.ipcRenderer) {
                window.ipcRenderer.invoke('blocker:status').then((s: any) => setBlockerStatus(s)).catch(() => { });
            }
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    // Listen for AI toggle from main process
    // Moved to App.tsx to avoid duplicate listeners and support overlay mode
    /*
    useEffect(() => {
        const handleToggle = () => toggleIsOpen();
        // @ts-ignore
        window.ipcRenderer?.on('ai:toggle', handleToggle);
        return () => {
            // @ts-ignore
            window.ipcRenderer?.removeListener('ai:toggle', handleToggle);
        };
    }, [toggleIsOpen]);
    */

    const toggleBlocker = async () => {
        // @ts-ignore
        if (window.ipcRenderer) {
            const newState = await window.ipcRenderer.invoke('blocker:toggle');
            setBlockerStatus(prev => ({ ...prev, isEnabled: newState }));
        }
    };
    const [isFocused, setIsFocused] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadProgress, setLoadProgress] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [inputRect, setInputRect] = useState<DOMRect | null>(null);
    const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
    // const [permissionsRect, setPermissionsRect] = useState<DOMRect | null>(null);
    const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);
    // const [downloadsRect, setDownloadsRect] = useState<DOMRect | null>(null);

    // New state for UI enhancements
    const [isSearchEngineOpen, setIsSearchEngineOpen] = useState(false);

    // Extension store
    /*
    const {
        isExtensionsOpen,
        setIsExtensionsOpen,
        extensions,
        setExtensionsRect,
    } = useExtensionStore();
    */

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const lockButtonRef = useRef<HTMLButtonElement>(null);
    const downloadButtonRef = useRef<HTMLButtonElement>(null);
    // const extensionsButtonRef = useRef<HTMLButtonElement>(null);

    // Downloads
    const {
        downloads,
        pause,
        resume,
        cancel,
        showInFolder,
        clearDownload
    } = useDownloads();

    const activeDownloadsCount = downloads.filter(d => d.state === 'progressing').length;
    const hasDownloads = downloads.length > 0;

    // Silence unused warning for downloadsRect
    // Silence unused warning for downloadsRect
    // useEffect(() => {
    //     if (downloadsRect) console.log('rect update', downloadsRect);
    // }, [downloadsRect]);

    // Get suggestions based on input
    const suggestions = useSuggestions(urlInput, SEARCH_ENGINES[searchEngine].name);

    // Calculate total suggestions count for keyboard navigation
    const totalSuggestions =
        suggestions.continue.length +
        suggestions.history.length +
        suggestions.bookmarks.length +
        suggestions.search.length;

    // Flatten suggestions for index lookup
    const allSuggestions: Suggestion[] = [
        ...suggestions.continue,
        ...suggestions.history,
        ...suggestions.bookmarks,
        ...suggestions.search,
    ];

    // Load search engine preference from localStorage (with locale awareness)
    useEffect(() => {
        const saved = localStorage.getItem('flow-search-engine');
        if (saved && saved in SEARCH_ENGINES) {
            setSearchEngine(saved as SearchEngine);
        } else {
            // Auto-select based on locale (Naver for Korean)
            // Read from Zustand preferences storage
            let currentLang = navigator.language;
            try {
                const prefs = localStorage.getItem('continuum-preferences');
                if (prefs) {
                    const parsed = JSON.parse(prefs);
                    const lang = parsed?.state?.language;
                    if (lang && lang !== 'system') {
                        currentLang = lang;
                    }
                }
            } catch { }

            if (currentLang.startsWith('ko')) {
                setSearchEngine('naver');
                localStorage.setItem('flow-search-engine', 'naver');
            }
        }
    }, []);

    // Save search engine preference
    const selectSearchEngine = (engine: SearchEngine) => {
        setSearchEngine(engine);
        localStorage.setItem('flow-search-engine', engine);
    };

    // Sync URL input when activePageId or the page's URL changes
    const activePage = useFlowStore(state =>
        state.flows.find(f => f.id === state.activeFlowId)?.pages.find(p => p.id === state.activePageId)
    );
    const activePageUrl = activePage?.url || '';

    useEffect(() => {
        if (activePageUrl) {
            // Determine what text to show in the address bar
            // If it's a search URL, decode it back to the query
            let displayText = activePageUrl;
            try {
                const urlObj = new URL(activePageUrl);
                const host = urlObj.hostname;
                const path = urlObj.pathname;

                if (host.includes('google') && path.includes('/search')) {
                    // Google search results → show query
                    const q = urlObj.searchParams.get('q');
                    if (q) displayText = q;
                } else if (host.includes('google') && (path === '/' || path.startsWith('/webhp') || path.startsWith('/url'))) {
                    // Google homepage / redirect artifacts → show clean domain
                    displayText = host.replace(/^www\./, '');
                } else if ((host.includes('naver') || host.includes('search.naver')) && path.includes('search')) {
                    const q = urlObj.searchParams.get('query');
                    if (q) displayText = q;
                } else if (host.includes('bing.com') && path.includes('/search')) {
                    const q = urlObj.searchParams.get('q');
                    if (q) displayText = q;
                } else if (host.includes('duckduckgo.com') && urlObj.searchParams.has('q')) {
                    const q = urlObj.searchParams.get('q');
                    if (q) displayText = q;
                } else {
                    // For all other URLs: show clean host + path (no query string noise)
                    const cleanHost = host.replace(/^www\./, '');
                    const cleanPath = path === '/' ? '' : path;
                    displayText = cleanHost + cleanPath;
                }
            } catch (e) { }

            setUrlInput(displayText);
            // Force hide suggestions when navigating
            setShowSuggestions(false);
            setIsFocused(false);
        } else {
            setUrlInput('');
        }
    }, [activePageId, activePageUrl]);

    // Listen for loading events — drives the top progress bar
    useEffect(() => {
        const handleLoading = (_event: any, { isLoading: loading, pageId: loadPageId }: { isLoading: boolean; pageId?: string }) => {
            // Only update for the active page
            if (!loadPageId || loadPageId === activePageId) {
                setIsLoading(loading);
            }
        };
        // @ts-ignore
        if (window.ipcRenderer) {
            window.ipcRenderer.on('view:loading', handleLoading);
        }
        return () => {
            // @ts-ignore
            if (window.ipcRenderer) {
                window.ipcRenderer.off('view:loading', handleLoading);
            }
        };
    }, [activePageId]);

    // Faux progress bar animation — ~80% in 1.5s while loading, snap to 100% on done
    useEffect(() => {
        let rafId: number;
        let startTime: number;
        const DURATION = 1500; // ms to reach ~80%

        if (isLoading) {
            setLoadProgress(0);
            startTime = performance.now();
            const tick = (now: number) => {
                const elapsed = now - startTime;
                // Ease-out curve reaching ~80% at DURATION
                const raw = elapsed / DURATION;
                const eased = 1 - Math.pow(1 - Math.min(raw, 1), 3); // cubic ease-out
                setLoadProgress(Math.round(eased * 80));
                if (elapsed < DURATION) {
                    rafId = requestAnimationFrame(tick);
                }
            };
            rafId = requestAnimationFrame(tick);
        } else {
            // Page done — snap to 100% then hide
            setLoadProgress(100);
            const t = setTimeout(() => setLoadProgress(0), 350);
            return () => clearTimeout(t);
        }

        return () => { if (rafId) cancelAnimationFrame(rafId); };
    }, [isLoading]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            const isInAddressBar = containerRef.current?.contains(target as Node);
            const isInSuggestions = target?.closest?.('[data-search-suggestions="true"]');

            if (!target?.closest('[data-search-engine-selector="true"]')) {
                setIsSearchEngineOpen(false);
            }

            if (isInAddressBar || isInSuggestions) return;
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Hide BrowserView when showing suggestions or panels (z-index issue)
    useEffect(() => {
        // Only hide/show if there's an active page with a BrowserView
        if (!activePageId) return;

        // Hide BrowserView when any overlay is open (suggestions, search engine, permissions, downloads)
        const shouldHide = (showSuggestions && urlInput.trim().length > 0) || isSearchEngineOpen || isPermissionsOpen || isDownloadsOpen;

        // Force hide/show based on condition
        if (shouldHide) {
            if (window.ipcRenderer?.views) {
                window.ipcRenderer.views.hide();
            }
        } else {
            if (window.ipcRenderer?.views) {
                window.ipcRenderer.views.show();
            }
        }
    }, [showSuggestions, urlInput, activePageId, isSearchEngineOpen, isPermissionsOpen, isDownloadsOpen]);

    // Close panels when clicking outside
    useEffect(() => {
        const handleClickOutsidePanels = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (isPermissionsOpen && !target.closest('[data-permissions-panel]') && !target.closest('[data-lock-button]')) {
                setIsPermissionsOpen(false);
            }
            if (isDownloadsOpen && !target.closest('[data-downloads-panel]') && !target.closest('[data-download-button]')) {
                setIsDownloadsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutsidePanels);
        return () => document.removeEventListener('mousedown', handleClickOutsidePanels);
    }, [isPermissionsOpen, isDownloadsOpen]);

    // Check if input is a URL or a search query
    const isUrl = (input: string): boolean => {
        const trimmed = input.trim();
        return /^https?:\/\//i.test(trimmed) ||
            /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/.test(trimmed) ||
            /^\d{1, 3}\.\d{1, 3}\.\d{1, 3}\.\d{1, 3}/.test(trimmed);
    };

    const navigateToUrl = (url: string, title?: string) => {
        let finalUrl = url;

        if (!isUrl(url)) {
            finalUrl = SEARCH_ENGINES[searchEngine].url + encodeURIComponent(url);
        } else if (!/^https?:\/\//i.test(url)) {
            finalUrl = 'https://' + url;
        }

        if (activePageId) {
            if (window.ipcRenderer?.views) window.ipcRenderer.views.updateUrl(finalUrl);
        } else if (activeFlowId) {
            let pageTitle = title || url;
            try {
                const u = new URL(finalUrl);
                if (u.hostname.includes('google.com') || u.hostname.includes('bing.com') ||
                    u.hostname.includes('duckduckgo.com') || u.hostname.includes('yahoo.com') ||
                    u.hostname.includes('ecosia.org')) {
                    pageTitle = `Search: ${url}`;
                } else {
                    pageTitle = u.hostname.replace('www.', '');
                }
            } catch (e) { }

            addPageToFlow(activeFlowId, {
                id: crypto.randomUUID(),
                url: finalUrl,
                title: pageTitle,
                lastVisited: Date.now(),
                favicon: `https://www.google.com/s2/favicons?domain=${finalUrl}&sz=64`
            });
        }

        // Ensure browser view is shown after navigation
        if (window.ipcRenderer?.views) {
            window.ipcRenderer.views.show();
        }


        setUrlInput('');
        setShowSuggestions(false);
        setSelectedIndex(-1);
    };

    const handleSelectSuggestion = (suggestion: Suggestion) => {
        if (suggestion.type === 'search') {
            navigateToUrl(suggestion.url);
        } else {
            navigateToUrl(suggestion.url, suggestion.title);
        }
    };

    const handleClearInput = () => {
        setUrlInput('');
        if (inputRef.current) {
            inputRef.current.focus();
        }
        setShowSuggestions(false);
        setSelectedIndex(-1);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (showSuggestions && totalSuggestions > 0) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(prev =>
                        prev < totalSuggestions - 1 ? prev + 1 : 0
                    );
                    return;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(prev =>
                        prev > 0 ? prev - 1 : totalSuggestions - 1
                    );
                    return;
                case 'Escape':
                    e.preventDefault();
                    setShowSuggestions(false);
                    setSelectedIndex(-1);
                    return;
                case 'Tab':
                    if (selectedIndex >= 0 && allSuggestions[selectedIndex]) {
                        e.preventDefault();
                        handleSelectSuggestion(allSuggestions[selectedIndex]);
                        return;
                    }
                    break;
            }
        }

        if (e.key === 'Enter' && activeFlowId && urlInput.trim()) {
            e.preventDefault();

            // If a suggestion is selected, use it
            if (selectedIndex >= 0 && allSuggestions[selectedIndex]) {
                handleSelectSuggestion(allSuggestions[selectedIndex]);
            } else {
                // Otherwise navigate directly
                // Otherwise navigate directly if valid
                if (urlInput.trim()) {
                    navigateToUrl(urlInput.trim());
                }
            }
        }
    };

    const handleFocus = () => {
        setIsFocused(true);
        if (inputRef.current) {
            setInputRect(inputRef.current.getBoundingClientRect());
            inputRef.current.select();
        }
        setShowSuggestions(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
        // Delay hiding suggestions to allow clicks
        setTimeout(() => {
            if (!containerRef.current?.contains(document.activeElement)) {
                setShowSuggestions(false);
            }
        }, 200);
    };

    const handleInputChange = (value: string) => {
        setUrlInput(value);
        if (inputRef.current && !inputRect) {
            setInputRect(inputRef.current.getBoundingClientRect());
        }
        setShowSuggestions(true);
        setSelectedIndex(-1);
    };

    const togglePermissions = () => {
        setIsPermissionsOpen(prev => !prev);
        setIsDownloadsOpen(false);
        setShowSuggestions(false);
    };

    const handleBack = () => {
        if (window.ipcRenderer?.views) window.ipcRenderer.views.back();
    };

    const handleForward = () => {
        if (window.ipcRenderer?.views) window.ipcRenderer.views.forward();
    };

    const handleReload = () => {
        if (window.ipcRenderer?.views) window.ipcRenderer.views.reload();
    };



    // Layout effect removed in favor of CSS flex/grid
    useEffect(() => {
        // Placeholder to keep hooks consistent if needed, or just remove. 
        // For now, empty effect is fine or we can remove the block entirely if we match the exact string.
    }, []);

    return (
        <div
            className={`app-topbar dia-chrome flex items-center shrink-0 relative z-50 pointer-events-none ${!activePageId ? 'hidden' : 'h-[38px]'}`}
            style={{
                WebkitAppRegion: 'drag',
            } as React.CSSProperties}
        >
            {/* Top Loading Progress Bar */}
            {loadProgress > 0 && (
                <div
                    className="absolute bottom-0 left-0 h-[2px] rounded-full pointer-events-none z-[100]"
                    style={{
                        width: `${loadProgress}%`,
                        background: 'linear-gradient(90deg, hsl(var(--primary) / 0.6), hsl(var(--primary)), rgba(130,100,240,0.8))',
                        transition: loadProgress === 100
                            ? 'width 200ms ease-out, opacity 300ms 150ms ease-out'
                            : 'width 80ms linear',
                        opacity: loadProgress === 100 ? 0 : 1,
                        boxShadow: '0 0 8px hsl(var(--primary) / 0.5)',
                    }}
                />
            )}

            {/* Left — Nav buttons (always visible) */}
            <div className="flex items-center gap-0.5 pl-3 pr-1.5 pointer-events-auto shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <button
                    onClick={handleBack}
                    className="topbar-nav-btn w-[28px] h-[28px] flex items-center justify-center rounded-[8px] text-foreground/30 hover:text-foreground/70 hover:bg-white/[0.06] transition-all duration-200"
                    title="Back"
                >
                    <ArrowLeft className="w-[15px] h-[15px]" strokeWidth={1.8} />
                </button>
                <button
                    onClick={handleForward}
                    className="topbar-nav-btn w-[28px] h-[28px] flex items-center justify-center rounded-[8px] text-foreground/30 hover:text-foreground/70 hover:bg-white/[0.06] transition-all duration-200"
                    title="Forward"
                >
                    <ArrowRight className="w-[15px] h-[15px]" strokeWidth={1.8} />
                </button>
                <button
                    onClick={handleReload}
                    className="topbar-nav-btn w-[28px] h-[28px] flex items-center justify-center rounded-[8px] text-foreground/30 hover:text-foreground/70 hover:bg-white/[0.06] transition-all duration-200"
                    title="Reload"
                >
                    <RotateCw className="w-[13px] h-[13px]" strokeWidth={1.8} />
                </button>
            </div>

            {/* Center — Flat URL field (Dia-style, no pill) */}
            <div
                ref={containerRef}
                className="app-omnibox flex-1 flex items-center h-[28px] bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/[0.06] rounded-[9px] px-2.5 min-w-0 pointer-events-auto relative transition-all duration-200"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                {/* Lock icon / Search icon */}
                <div className="flex-shrink-0 pr-1.5 flex items-center">
                    {activeFlowId && activePageId && !isFocused ? (
                        <button
                            ref={lockButtonRef}
                            data-lock-button
                            onClick={togglePermissions}
                            className={`p-1 rounded-md hover:bg-white/10 transition-colors ${activePage?.url.startsWith('https://')
                                ? 'text-foreground/40'
                                : 'text-yellow-400'
                                }`}
                            title={t('privacy.siteInfo', 'View site information')}
                        >
                            {activePage?.url.startsWith('https://') ? (
                                <Lock className="w-3 h-3" strokeWidth={1.5} />
                            ) : (
                                <Unlock className="w-3 h-3" strokeWidth={1.5} />
                            )}
                        </button>
                    ) : (
                        <div className="relative" data-search-engine-selector="true">
                            <button
                                onClick={() => setIsSearchEngineOpen(!isSearchEngineOpen)}
                                className="flex items-center gap-1 text-foreground/30 hover:text-foreground/60 transition-colors p-1 rounded-md hover:bg-white/5"
                                title="Change Search Engine"
                            >
                                <Search className="w-3 h-3" strokeWidth={1.5} />
                            </button>
                            {isSearchEngineOpen && (
                                <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 w-44 py-1">
                                    {(Object.keys(SEARCH_ENGINES) as SearchEngine[]).map(engine => (
                                        <button
                                            key={engine}
                                            onClick={() => selectSearchEngine(engine)}
                                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 flex items-center gap-2 ${searchEngine === engine ? 'text-primary font-medium' : 'text-foreground/70'}`}
                                        >
                                            {SEARCH_ENGINES[engine].name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* URL Input — flat, borderless */}
                <input
                    ref={inputRef}
                    type="text"
                    value={urlInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder={activePageId ? '' : t('addressBar.placeholder', 'Where would you like to go?')}
                    className="dia-url-input flex-1 bg-transparent text-[11.5px] text-foreground/75 placeholder:text-foreground/22 outline-none min-w-0 font-medium tracking-wide"
                    style={{
                        fontFeatureSettings: '"tnum" on',
                        caretColor: 'hsl(var(--primary))',
                    }}
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                />

                {/* Clear button */}
                {isFocused && urlInput && (
                    <button
                        onClick={handleClearInput}
                        className="flex-shrink-0 p-1 rounded-md text-foreground/30 hover:text-foreground/60 hover:bg-white/5 transition-all"
                        title="Clear"
                    >
                        <X className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                )}

                {/* Suggestions Dropdown */}
                {showSuggestions && urlInput.trim() && (
                    <SearchSuggestions
                        suggestions={suggestions}
                        selectedIndex={selectedIndex}
                        onSelect={handleSelectSuggestion}
                        onHover={setSelectedIndex}
                        inputRect={inputRect}
                        query={urlInput}
                    />
                )}
            </div>

            {/* Right — Shield + Chat (Dia-style minimal) */}
            <div className="flex items-center gap-0.5 pr-3 pointer-events-auto shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                {/* Extra Actions */}
                {activePageId && (
                    <>
                        <button
                            onClick={() => {
                                const { splitView, enableSplitView, disableSplitView } = useFlowStore.getState();
                                if (splitView.isOpen) {
                                    disableSplitView();
                                } else {
                                    enableSplitView(undefined);
                                }
                            }}
                            className={`topbar-nav-btn w-[28px] h-[28px] flex items-center justify-center rounded-[8px] transition-all duration-200 ${useFlowStore.getState().splitView?.isOpen
                                ? 'text-primary hover:text-primary/80'
                                : 'text-foreground/30 hover:text-foreground/70 hover:bg-white/[0.06]'
                                }`}
                            title="Split View"
                        >
                            <Columns className="w-[14px] h-[14px]" strokeWidth={1.8} />
                        </button>
                        <button
                            onClick={() => {
                                useFlowStore.getState().cycleSpatialAudioMode();
                            }}
                            className={`topbar-nav-btn w-[28px] h-[28px] flex items-center justify-center rounded-[8px] transition-all duration-200 ${useFlowStore.getState().isSpatialAudio
                                ? 'text-primary hover:text-primary/80'
                                : 'text-foreground/30 hover:text-foreground/70 hover:bg-white/[0.06]'
                                }`}
                            title={`Spatial Audio (${useFlowStore.getState().spatialAudioMode})`}
                        >
                            <Headphones className="w-[14px] h-[14px]" strokeWidth={1.8} />
                        </button>
                    </>
                )}

                {/* Shield / Blocker status */}
                {activePageId && (
                    <button
                        onClick={toggleBlocker}
                        className={`topbar-nav-btn w-[28px] h-[28px] flex items-center justify-center rounded-[8px] transition-all duration-200 ${blockerStatus.isEnabled ? 'text-emerald-400/65 hover:text-emerald-400' : 'text-foreground/20 hover:text-foreground/50 hover:bg-white/[0.06]'}`}
                        title={blockerStatus.isEnabled ? `Protection ON (${blockerStatus.blockedCount} blocked)` : "Protection OFF"}
                    >
                        {blockerStatus.isEnabled ? <Shield className="w-[14px] h-[14px]" strokeWidth={1.5} /> : <ShieldAlert className="w-[14px] h-[14px]" strokeWidth={1.5} />}
                    </button>
                )}

                {/* New Buttons: AI, History, Theme */}
                <button
                    onClick={handleAIToggle}
                    className="topbar-nav-btn w-[28px] h-[28px] flex items-center justify-center rounded-[8px] text-foreground/30 hover:text-foreground/70 hover:bg-white/[0.06] transition-all duration-200"
                    title="AI"
                >
                    <Sparkles className="w-[14px] h-[14px]" strokeWidth={1.8} />
                </button>
                <button
                    onClick={() => toggleHistory()}
                    className="topbar-nav-btn w-[28px] h-[28px] flex items-center justify-center rounded-[8px] text-foreground/30 hover:text-foreground/70 hover:bg-white/[0.06] transition-all duration-200"
                    title="History"
                >
                    <Clock className="w-[14px] h-[14px]" strokeWidth={1.8} />
                </button>


                {/* Download indicator (small dot, not full button) */}
                {hasDownloads && activeDownloadsCount > 0 && (
                    <button
                        ref={downloadButtonRef}
                        data-download-button
                        onClick={() => {
                            setIsDownloadsOpen(prev => !prev);
                            setIsPermissionsOpen(false);
                        }}
                        className="topbar-nav-btn w-[28px] h-[28px] flex items-center justify-center rounded-[8px] text-foreground/30 hover:text-foreground/70 hover:bg-white/[0.06] transition-all duration-200 relative"
                        title="Downloads"
                    >
                        <DownloadIcon className="w-[14px] h-[14px]" strokeWidth={1.8} />
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                    </button>
                )}

                {/* Divider */}
                <div className="w-px h-3 mx-0.5 rounded-full bg-white/[0.05]" />

            </div>

            {/* Site Permissions Panel — inline rendering */}
            <div data-permissions-panel>
                <SitePermissionsPanel
                    isOpen={isPermissionsOpen}
                    onClose={() => setIsPermissionsOpen(false)}
                    url={activePage?.url || ''}
                    rect={lockButtonRef.current?.getBoundingClientRect() || null}
                    blockedCount={blockerStatus.blockedCount}
                />
            </div>

            {/* Download Manager — inline rendering */}
            <div data-downloads-panel>
                <DownloadManager
                    isOpen={isDownloadsOpen}
                    onClose={() => setIsDownloadsOpen(false)}
                    downloads={downloads}
                    rect={downloadButtonRef.current?.getBoundingClientRect() || null}
                    onPause={pause}
                    onResume={resume}
                    onCancel={cancel}
                    onShowInFolder={showInFolder}
                    onClear={clearDownload}
                />
            </div>
        </div>
    );
}

export default AddressBar;
