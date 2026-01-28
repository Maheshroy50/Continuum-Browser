import { ArrowLeft, ArrowRight, RotateCw, Search, LayoutGrid, Clock, Star, ChevronDown, Lock, Unlock, Download as DownloadIcon, BookOpen, Columns, Shield, ShieldAlert, Sparkles, Puzzle } from 'lucide-react';
import { useState, KeyboardEvent, useEffect, useRef } from 'react';
import { useFlowStore } from '../store/useFlowStore';
import { useAIStore } from '../store/useAIStore';
import { usePreferencesStore } from '../store/usePreferencesStore';
import { useExtensionStore } from '../store/useExtensionStore';
import { useTranslation } from 'react-i18next';
// import { invoke } from '@tauri-apps/api/core';
import { useSuggestions, Suggestion } from '../hooks/useSuggestions';
import SearchSuggestions from './SearchSuggestions';
import { SitePermissionsPanel } from './SitePermissionsPanel';
import { DownloadManager } from './DownloadManager';
import { useDownloads } from '../hooks/useDownloads';

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
    const { t } = useTranslation();
    const { activeFlowId, activePageId, addPageToFlow, setActivePage, isHistoryOpen, toggleHistory, addBookmark, removeBookmark, isBookmarked, isReaderMode, setReaderMode, enableSplitView, disableSplitView, isZenMode } = useFlowStore();
    const sidebarHidden = usePreferencesStore(state => state.sidebarHidden);
    const splitView = useFlowStore(state => state.splitView) || { isOpen: false };
    const { isOpen: isAIOpen, setIsOpen: setAIOpen } = useAIStore();
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

    const toggleBlocker = async () => {
        // @ts-ignore
        if (window.ipcRenderer) {
            const newState = await window.ipcRenderer.invoke('blocker:toggle');
            setBlockerStatus(prev => ({ ...prev, isEnabled: newState }));
        }
    };
    const [isFocused, setIsFocused] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [inputRect, setInputRect] = useState<DOMRect | null>(null);
    const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
    const [permissionsRect, setPermissionsRect] = useState<DOMRect | null>(null);
    const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);
    const [downloadsRect, setDownloadsRect] = useState<DOMRect | null>(null);

    // Extension store
    const {
        isExtensionsOpen,
        setIsExtensionsOpen,
        extensions,
        setExtensionsRect,
    } = useExtensionStore();

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const lockButtonRef = useRef<HTMLButtonElement>(null);
    const downloadButtonRef = useRef<HTMLButtonElement>(null);
    const extensionsButtonRef = useRef<HTMLButtonElement>(null);

    // Downloads
    const {
        downloads,
        pause: pauseDownload,
        resume: resumeDownload,
        cancel: cancelDownload,
        showInFolder,
        clearDownload
    } = useDownloads();

    const activeDownloadsCount = downloads.filter(d => d.state === 'progressing').length;
    const hasDownloads = downloads.length > 0;

    // Silence unused warning for downloadsRect
    useEffect(() => {
        if (downloadsRect) console.log('rect update', downloadsRect);
    }, [downloadsRect]);

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

    useEffect(() => {
        if (activePage) {
            // Determine what text to show in the address bar
            // If it's a search URL, decode it back to the query
            let displayText = activePage.url;
            try {
                const urlObj = new URL(activePage.url);
                if (urlObj.hostname.includes('google') && urlObj.pathname.includes('/search')) {
                    const q = urlObj.searchParams.get('q');
                    if (q) displayText = q;
                }
                // Add similar logic for other search engines if needed
                else if ((urlObj.hostname.includes('naver') || urlObj.hostname.includes('search.naver')) && urlObj.pathname.includes('search')) {
                    const q = urlObj.searchParams.get('query');
                    if (q) displayText = q;
                }
            } catch (e) { }

            setUrlInput(displayText);
            // Force hide suggestions when navigating
            setShowSuggestions(false);
            setIsFocused(false);
        } else {
            setUrlInput('');
        }
    }, [activePage?.url, activePageId]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
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

        const shouldHide = (showSuggestions && urlInput.trim().length > 0) || isPermissionsOpen || isDownloadsOpen || isExtensionsOpen;

        if (shouldHide) {
            if (window.ipcRenderer?.views) window.ipcRenderer.views.hide();
        } else {
            if (window.ipcRenderer?.views) window.ipcRenderer.views.show();
        }
    }, [showSuggestions, urlInput, activePageId, isPermissionsOpen, isDownloadsOpen, isExtensionsOpen]);

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
            if (window.ipcRenderer?.views) window.ipcRenderer.views.updateUrl(activePageId, finalUrl);
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
                navigateToUrl(urlInput.trim());
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
        if (lockButtonRef.current) {
            setPermissionsRect(lockButtonRef.current.getBoundingClientRect());
        }
        setIsPermissionsOpen(!isPermissionsOpen);
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

    const handleGridView = () => {
        setActivePage(null);
    };

    return (
        <div
            className={`h-14 border-b border-white/[0.04] flex items-center space-x-3 bg-background/90 backdrop-blur-xl transition-all ${isZenMode || sidebarHidden ? 'pl-24 pr-4' : 'px-4'}`}
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            {/* Left Section - Navigation */}
            <div className="flex-1 flex justify-start">
                <div className="flex items-center btn-group-premium space-x-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                    <button
                        onClick={handleGridView}
                        className={`p-2 rounded-lg transition-all duration-200 ${!activePageId ? 'text-primary bg-primary/15' : 'text-muted-foreground hover:text-foreground hover:bg-white/10'}`}
                        title="View all pages"
                    >
                        <LayoutGrid className="w-4 h-4" strokeWidth={1.5} />
                    </button>

                    {activePageId && (
                        <>
                            <button
                                onClick={handleBack}
                                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-200"
                                title="Back"
                            >
                                <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                            <button
                                onClick={handleForward}
                                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-200"
                                title="Forward"
                            >
                                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                            <button
                                onClick={handleReload}
                                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-200"
                                title="Reload"
                            >
                                <RotateCw className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* URL Input with Search Engine Selector and Suggestions - Centered */}
            <div
                ref={containerRef}
                className="flex-1 max-w-3xl relative"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                {/* Search Engine Selector */}
                <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center z-10">
                    {activeFlowId && activePageId && !isFocused ? (
                        <button
                            ref={lockButtonRef}
                            onClick={togglePermissions}
                            className={`p-1 rounded-md bg-muted hover:bg-neutral-800 transition-colors z-20 relative ${activePage?.url.startsWith('https://')
                                ? 'text-green-500'
                                : 'text-yellow-500'
                                }`}
                            title={t('privacy.siteInfo', 'View site information')}
                        >
                            {activePage?.url.startsWith('https://') ? (
                                <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
                            ) : (
                                <Unlock className="w-3.5 h-3.5" strokeWidth={1.5} />
                            )}
                        </button>
                    ) : (
                        <>
                            <Search className="w-3.5 h-3.5 text-muted-foreground mr-1" strokeWidth={1.5} />
                            <select
                                value={searchEngine}
                                onChange={(e) => selectSearchEngine(e.target.value as SearchEngine)}
                                className="appearance-none bg-transparent text-muted-foreground hover:text-foreground cursor-pointer py-1 text-xs border-none outline-none w-4 opacity-0"
                                style={{ background: 'transparent', WebkitAppearance: 'none' }}
                                title={`Search with ${SEARCH_ENGINES[searchEngine].name}`}
                            >
                                {Object.entries(SEARCH_ENGINES)
                                    .filter(([key, _engine]) => {
                                        // Only show Naver for Korean locale
                                        if (key === 'naver') {
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
                                            return currentLang.startsWith('ko');
                                        }
                                        return true;
                                    })
                                    .map(([key, engine]) => (
                                        <option key={key} value={key} className="bg-neutral-900 text-white">
                                            {engine.name}
                                        </option>
                                    ))
                                }
                            </select>
                            <ChevronDown className="w-3 h-3 text-muted-foreground -ml-3 pointer-events-none" strokeWidth={1.5} />
                        </>
                    )}
                </div>

                {/* Input */}
                <input
                    ref={inputRef}
                    type="text"
                    value={urlInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    disabled={!activeFlowId}
                    placeholder={activeFlowId
                        ? (activePageId
                            ? t('addressBar.searchOrUrl')
                            : `${t('addressBar.searchOrUrl')}`)
                        : t('addressBar.selectWorkspace')
                    }
                    className="w-full h-11 input-arc pl-14 pr-28 text-sm outline-none placeholder:text-muted-foreground/40 disabled:opacity-50 disabled:cursor-not-allowed glow-focus"
                />

                {/* Reader Mode & Split View Toggle & Blocker Shield */}
                {activePageId && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center btn-group-premium space-x-0.5">
                        <button
                            onClick={toggleBlocker}
                            className={`p-1.5 rounded-lg transition-all duration-200 ${blockerStatus.isEnabled ? 'text-green-500 hover:bg-green-500/15' : 'text-muted-foreground hover:bg-white/10'}`}
                            title={blockerStatus.isEnabled ? `Protection ON (${blockerStatus.blockedCount} blocked)` : "Protection OFF"}
                        >
                            {blockerStatus.isEnabled ? <Shield className="w-4 h-4" strokeWidth={1.5} /> : <ShieldAlert className="w-4 h-4" strokeWidth={1.5} />}
                        </button>
                        <button
                            onClick={() => splitView?.isOpen ? disableSplitView() : enableSplitView()}
                            className={`p-1.5 rounded-lg transition-all duration-200 ${splitView?.isOpen ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/10'}`}
                            title="Toggle Split View"
                        >
                            <Columns className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                        <button
                            onClick={() => setReaderMode(!isReaderMode)}
                            className={`p-1.5 rounded-lg transition-all duration-200 ${isReaderMode ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/10'}`}
                            title="Toggle Reader Mode"
                        >
                            <BookOpen className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                    </div>
                )}

                {/* Suggestions Dropdown */}
                {showSuggestions && urlInput.trim() && (
                    <SearchSuggestions
                        suggestions={suggestions}
                        selectedIndex={selectedIndex}
                        onSelect={handleSelectSuggestion}
                        onHover={setSelectedIndex}
                        inputRect={inputRect}
                    />
                )}
            </div>

            {/* Right Section - Actions */}
            <div className="flex-1 flex justify-end">
                <div className="flex items-center btn-group-premium space-x-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                    <button
                        ref={extensionsButtonRef}
                        data-extensions-button="true"
                        onClick={() => {
                            if (extensionsButtonRef.current) {
                                setExtensionsRect(extensionsButtonRef.current.getBoundingClientRect());
                            }
                            setIsExtensionsOpen(!isExtensionsOpen);
                        }}
                        className={`p-2 rounded-lg transition-all duration-200 relative ${isExtensionsOpen ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/10'}`}
                        title="Extensions"
                    >
                        <Puzzle className="w-4 h-4" strokeWidth={1.5} />
                        {extensions.length > 0 && !isExtensionsOpen && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full"></span>
                        )}
                    </button>

                    {/* Download Manager Button */}
                    {hasDownloads && (
                        <button
                            ref={downloadButtonRef}
                            onClick={() => {
                                if (downloadButtonRef.current) {
                                    setDownloadsRect(downloadButtonRef.current.getBoundingClientRect());
                                }
                                setIsDownloadsOpen(!isDownloadsOpen);
                            }}
                            className={`p-2 rounded-lg transition-all duration-200 relative ${isDownloadsOpen ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/10'}`}
                            title="Downloads"
                        >
                            <DownloadIcon className="w-4 h-4" strokeWidth={1.5} />
                            {activeDownloadsCount > 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                            )}
                        </button>
                    )}

                    <button
                        onClick={() => {
                            if (activePage?.url) {
                                if (isBookmarked(activePage.url)) {
                                    removeBookmark(activePage.url);
                                } else {
                                    addBookmark(activePage.url, activePage.title || activePage.url, activePage.favicon);
                                }
                            }
                        }}
                        className={`p-2 rounded-lg transition-all duration-200 ${activePage?.url && isBookmarked(activePage.url) ? 'text-yellow-400' : 'text-muted-foreground hover:text-foreground hover:bg-white/10'}`}
                        disabled={!activePage?.url}
                        title="Bookmark this page"
                    >
                        <Star className={`w-4 h-4 ${activePage?.url && isBookmarked(activePage.url) ? 'fill-current' : ''}`} strokeWidth={1.5} />
                    </button>

                    <button
                        onClick={toggleHistory}
                        className={`p-2 rounded-lg transition-all duration-200 ${isHistoryOpen ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/10'}`}
                        title="History & Bookmarks"
                    >
                        <Clock className="w-4 h-4" strokeWidth={1.5} />
                    </button>

                    {/* AI Button with emphasis */}
                    <button
                        onClick={() => setAIOpen(!isAIOpen)}
                        className={`p-2 rounded-lg transition-all duration-200 ${isAIOpen ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400' : 'text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10'}`}
                        title="Ask AI (Second Brain)"
                    >
                        <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                </div>
            </div>

            {/* Extensions panel now rendered at app root via ExtensionsPanel */}

            {/* Site Permissions Panel */}
            <SitePermissionsPanel
                url={activePage ? activePage.url : ''}
                isOpen={isPermissionsOpen}
                onClose={() => setIsPermissionsOpen(false)}
                rect={permissionsRect}
                blockedCount={blockerStatus.blockedCount}
            />

            <DownloadManager
                downloads={downloads}
                isOpen={isDownloadsOpen}
                onClose={() => setIsDownloadsOpen(false)}
                rect={downloadsRect}
                onPause={pauseDownload}
                onResume={resumeDownload}
                onCancel={cancelDownload}
                onShowInFolder={showInFolder}
                onClear={clearDownload}
            />
        </div>
    );
}

export default AddressBar;
