import { Plus, Globe, Search, Mic, ArrowUp, FileText } from 'lucide-react';
import { useFlowStore, FlowStore } from '../store/useFlowStore';
import { useAIStore } from '../store/useAIStore';
import { usePreferencesStore } from '../store/usePreferencesStore';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flow, Page, HistoryItem } from '../shared/types';
import { ULTRA_FINE_NOISE_OPACITY, ULTRA_FINE_NOISE_TEXTURE } from '../utils/noiseTexture';





const tryParseUrl = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
};

const getFaviconUrl = (page: { favicon?: string; url: string }) => {
    if (page.favicon) return page.favicon;
    try {
        const hostname = new URL(page.url).hostname;
        return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
    } catch {
        return null;
    }
};

function FlowView() {
    const { t } = useTranslation();

    const { flows, activeFlowId, activePageId, setSplitSecondaryInfo, uiSnapshot, createFlow } = useFlowStore();
    const splitView = useFlowStore((state: FlowStore) => state.splitView) || { isOpen: false, activePageId: null, secondaryPageId: null };
    const isAIPanelOpen = useAIStore(state => state.isOpen);
    const activeFlow = flows.find((f: Flow) => f.id === activeFlowId);

    // Debugging
    useEffect(() => {
        // console.log('[FlowView] Rendering. ActiveFlowId:', activeFlowId, 'ActivePageId:', activePageId);
        // console.log('[FlowView] ActiveFlow found:', !!activeFlow, 'Pages:', activeFlow?.pages.length);
    }, [activeFlowId, activePageId, activeFlow]);

    // Refs for layout containers
    const primaryRef = useRef<HTMLDivElement>(null);
    const secondaryRef = useRef<HTMLDivElement>(null);
    // Legacy single ref
    const contentRef = useRef<HTMLDivElement>(null);

    // Theme detection for light/dark adaptive styling
    const currentTheme = usePreferencesStore(state => state.theme);
    const isLightTheme = currentTheme === 'light';
    const isNotesPanelOpen = usePreferencesStore(state => state.isNotesPanelOpen);
    const toggleNotesPanel = usePreferencesStore(state => state.toggleNotesPanel);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchEngine, setSearchEngine] = useState(() => localStorage.getItem('flow-search-engine') || 'google');
    const history = useFlowStore(state => state.history);

    // Filter history based on search query
    const historySuggestions = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        const seen = new Set<string>();
        return history
            .filter((item: HistoryItem) => {
                if (seen.has(item.url)) return false;
                seen.add(item.url);
                return (
                    item.title?.toLowerCase().includes(q) ||
                    item.url?.toLowerCase().includes(q)
                );
            })
            .slice(0, 6);
    }, [searchQuery, history]);

    const handleSearch = () => {
        if (!searchQuery.trim() || !activeFlowId) return;

        const query = searchQuery.trim();
        let finalUrl = query;

        try {
            if (query.includes('.') && !query.includes(' ')) {
                finalUrl = query.startsWith('http') ? query : `https://${query}`;
                new URL(finalUrl);
            } else {
                throw new Error('Not a direct URL');
            }
        } catch {
            const engine = searchEngine;
            if (engine === 'naver') {
                finalUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
            } else if (engine === 'duckduckgo') {
                finalUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
            } else if (engine === 'bing') {
                finalUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
            } else if (engine === 'yahoo') {
                finalUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
            } else {
                finalUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            }
        }

        const newPageId = crypto.randomUUID();
        useFlowStore.getState().addPageToFlow(activeFlowId, { id: newPageId, url: finalUrl, title: query } as any);
        useFlowStore.getState().setActivePage(newPageId);
        setSearchQuery('');
    };

    // Sync active flow change -> reset local active page
    useEffect(() => {
        // If switching flows, reset active page (or keep it if we track per flow)
        // For now, simple reset.
    }, [activeFlowId]);

    // SPLIT VIEW & LAYOUT MANAGEMENT - THROTTLED for performance
    useEffect(() => {
        let rafId: number | null = null;
        let isScheduled = false;

        const handleResize = () => {
            // Skip if already scheduled (throttle via RAF)
            if (isScheduled) return;
            isScheduled = true;

            rafId = requestAnimationFrame(() => {
                isScheduled = false;
                if (!activeFlowId) return;

                // GUARD: Never show BrowserView while Settings modal is open.
                // SettingsModal sets this data attribute and calls views.hide().
                // Without this check, the ResizeObserver immediately calls views.show()
                // and undoes the hide — causing the BrowserView to paint over settings.
                if (document.documentElement.dataset.settingsOpen) return;

                // 1. Split View Mode
                if (splitView.isOpen) {
                    if (primaryRef.current && splitView.activePageId) {
                        const rect = primaryRef.current.getBoundingClientRect();
                        // @ts-ignore
                        window.ipcRenderer?.invoke('view:resize', {
                            x: Math.round(rect.left),
                            y: Math.round(rect.top),
                            width: Math.round(rect.width),
                            height: Math.round(rect.height)
                        }, activeFlowId, splitView.activePageId);

                        // @ts-ignore
                        window.ipcRenderer?.invoke('view:show', activeFlowId, splitView.activePageId);
                    }

                    if (secondaryRef.current && splitView.secondaryPageId) {
                        const rect = secondaryRef.current.getBoundingClientRect();
                        // @ts-ignore
                        window.ipcRenderer?.invoke('view:resize', {
                            x: Math.round(rect.left),
                            y: Math.round(rect.top),
                            width: Math.round(rect.width),
                            height: Math.round(rect.height)
                        }, activeFlowId, splitView.secondaryPageId);

                        // @ts-ignore
                        window.ipcRenderer?.invoke('view:show', activeFlowId, splitView.secondaryPageId);
                    }
                }
                // 2. Single View Mode
                else if (contentRef.current && activePageId) {
                    const rect = contentRef.current.getBoundingClientRect();
                    const width = Math.round(rect.width);
                    // Note: We no longer subtract width for AIPanel as it is now a floating overlay

                    // BrowserView starts exactly where the content div starts.
                    // The sidebar hover trigger zone is a transparent overlay (z-[250]) so it works even at x=0.
                    const x = Math.round(rect.left);
                    const adjustedWidth = width;

                    // @ts-ignore
                    window.ipcRenderer?.views?.resize({
                        x: x,
                        y: Math.round(rect.top),
                        width: Math.max(0, adjustedWidth),
                        height: Math.round(rect.height)
                    });
                    // @ts-ignore
                    window.ipcRenderer?.views?.show();
                } else if (!activePageId && !splitView.isOpen) {
                    // Ensure views are hidden when in overview mode
                    // @ts-ignore
                    window.ipcRenderer?.views?.hide();
                }
            });
        };

        // Initial sync (delayed to let layout settle)
        const initialTimer = setTimeout(handleResize, 50);

        // Observer with throttled callback
        const observer = new ResizeObserver(handleResize);
        if (primaryRef.current) observer.observe(primaryRef.current);
        if (secondaryRef.current) observer.observe(secondaryRef.current);
        if (contentRef.current) observer.observe(contentRef.current);

        window.addEventListener('resize', handleResize);

        return () => {
            clearTimeout(initialTimer);
            if (rafId) cancelAnimationFrame(rafId);
            observer.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, [activeFlowId, activePageId, splitView.isOpen, splitView.activePageId, splitView.secondaryPageId, isAIPanelOpen]);


    // === NO WORKSPACE SELECTED (Neo-Dia Redesign) ===
    if (!activeFlow) {
        return (
            <div className="flow-surface flex-1 flex flex-col items-center justify-center h-full relative overflow-hidden neo-dia-surface">
                {/* Neo-Dia Aurora Background Effect - Subtle and integrated */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] left-[20%] w-[800px] h-[800px] bg-blue-900/5 rounded-full blur-[100px] opacity-20" />
                    <div className="absolute bottom-[-10%] right-[20%] w-[600px] h-[600px] bg-purple-900/5 rounded-full blur-[120px] opacity-15 delay-1000" />
                </div>

                <div className="relative z-10 flex flex-col items-center animate-slide-up max-w-3xl px-6 w-full">
                    {/* Continuum 3.0 Hero Card */}
                    <div className="group relative w-full max-w-lg aspect-video rounded-[32px] overflow-hidden bg-[rgba(255,255,255,0.03)] border border-white/[0.04] cursor-default mb-12 flex flex-col items-center justify-center"
                        style={{
                            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                            transition: `all var(--duration-large) var(--ease-continuum)`,
                        }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

                        <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md shadow-inner border border-white/10 group-hover:scale-110 transition-transform duration-500">
                            <Globe className="w-10 h-10 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" strokeWidth={1.5} />
                        </div>

                        <h2 className="text-4xl mb-3 neo-dia-heading text-center tracking-[-0.03em] font-semibold z-10">
                            {t('flowView.noWorkspaceSelected') || "Continuum"}
                        </h2>

                        <p className="text-center neo-dia-text-muted text-[15px] max-w-xs z-10">
                            {t('flowView.selectWorkspace') || "Your intelligent thinking surface."}
                        </p>

                        {/* Ambient Pulse Indicator */}
                        <div className="absolute bottom-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.05]">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-medium">System Ready</span>
                        </div>
                    </div>

                    {/* Action Buttons - Premium */}
                    <div className="flex gap-4 opacity-0 animate-fade-in delay-300" style={{ animationFillMode: 'forwards' }}>
                        <button
                            onClick={() => createFlow('New Project', 'Research')}
                            className="neo-dia-btn-primary flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Flow</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // === SPLIT VIEW RENDER ===
    if (splitView.isOpen) {
        return (
            <div className="flow-surface flex-1 flex flex-row min-w-0 h-full relative overflow-hidden">
                {/* Primary Pane (Left) */}
                <div ref={primaryRef} className="flex-1 min-w-0 h-full border-r border-border relative" />

                {/* Secondary Pane (Right) */}
                <div ref={secondaryRef} className="flex-1 min-w-0 h-full relative bg-muted/5 flex flex-col">
                    {!splitView.secondaryPageId && (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                            <h3 className="text-lg font-medium text-foreground mb-4">Select Page for Split View</h3>
                            <div className="w-full max-w-sm space-y-2 overflow-y-auto max-h-[400px] p-1">
                                {activeFlow.pages.filter((p: Page) => p.id !== splitView.activePageId).map((page: Page, idx: number) => (
                                    <button
                                        key={page.id}
                                        onClick={() => setSplitSecondaryInfo(page.id)}
                                        className="w-full flex items-center space-x-3 p-3 rounded-xl bg-card/50 hover:bg-card border border-transparent hover:border-border/50 transition-all text-left shadow-sm hover:shadow-md group animate-scale-in"
                                        style={{ animationDelay: `${idx * 50}ms` }}
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-background/50 border border-border/50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            {page.favicon ? (
                                                <img src={page.favicon} alt="" className="w-4 h-4 rounded-sm" />
                                            ) : (
                                                <Globe className="w-4 h-4 opacity-50" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">{page.title || 'Untitled'}</p>
                                            <p className="text-xs text-muted-foreground truncate opacity-70">{page.url}</p>
                                        </div>
                                    </button>
                                ))}
                                {activeFlow.pages.filter((p: Page) => p.id !== splitView.activePageId).length === 0 && (
                                    <div className="text-muted-foreground text-sm py-8 bg-card/30 rounded-xl border border-dashed border-border/50">
                                        No other pages available.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // === SINGLE VIEW RENDER ===
    return (
        <div className="flow-surface flex-1 flex flex-col relative overflow-hidden">
            <div ref={contentRef} className="flex-1 flex flex-col relative w-full h-full">
                {/* Snapshot Layer - visible when BrowserView is hidden */}
                {activePageId && uiSnapshot && (
                    <img
                        src={uiSnapshot}
                        className="absolute inset-0 w-full h-full object-cover animate-fade-in"
                        alt="Page Snapshot"
                    />
                )}

                {!activePageId && (
                    <div className="ntp-surface flex-1 flex flex-col items-center justify-center px-6 relative">
                        {/* Ultra-subtle noise grain */}
                        <div className="absolute inset-0 pointer-events-none z-[1]"
                            style={{
                                backgroundImage: ULTRA_FINE_NOISE_TEXTURE,
                                backgroundRepeat: 'repeat',
                                backgroundSize: '64px 64px',
                                opacity: ULTRA_FINE_NOISE_OPACITY,
                            }} />

                        {/* NTP Card Container — centered vertically with slight upward offset for visual balance */}
                        <div className="search-card-enter relative w-full max-w-[620px] flex flex-col items-center -mt-8" style={{ animationDelay: '60ms' }}>

                            {/* Stylish Continuum text */}
                            <div className="ntp-logo-wrap relative mb-8 z-10">
                                <h1 className="ntp-brand-text relative select-none" style={{
                                    fontSize: '32px',
                                    fontWeight: 400,
                                    fontStyle: 'italic',
                                    fontFamily: "'Georgia', 'Times New Roman', 'Palatino Linotype', serif",
                                    letterSpacing: '0.01em',
                                    color: isLightTheme ? 'rgba(0,0,0,0.60)' : 'rgba(255,255,255,0.55)',
                                }}>
                                    Continuum
                                </h1>
                            </div>

                            {/* Main Search Card — Dia-inspired clean glass */}
                            <div
                                className="ntp-search-card relative rounded-2xl overflow-hidden w-full z-10"
                                style={{
                                    background: isLightTheme ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.035)',
                                    border: `1px solid ${isLightTheme ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`,
                                    boxShadow: isLightTheme
                                        ? '0 8px 32px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.7)'
                                        : '0 8px 32px rgba(0,0,0,0.2), 0 0 0 0.5px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.04)',
                                    backdropFilter: 'blur(40px) saturate(120%)',
                                    WebkitBackdropFilter: 'blur(40px) saturate(120%)',
                                }}
                            >
                                {/* Search input row */}
                                <div className="flex items-center gap-3 px-5 pt-4 pb-3">
                                    <Search className={`shrink-0 w-[15px] h-[15px] ${isLightTheme ? 'text-foreground/30' : 'text-foreground/20'}`} strokeWidth={2} />
                                    <input
                                        type="text"
                                        placeholder="Search anything..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSearch();
                                            }
                                        }}
                                        className={`flex-1 bg-transparent text-[15px] outline-none font-[450] tracking-[0.01em] ${isLightTheme ? 'text-foreground/85 placeholder:text-foreground/30' : 'text-foreground/80 placeholder:text-foreground/22'}`}
                                        autoFocus
                                    />
                                </div>

                                {/* History suggestions when typing */}
                                {searchQuery.trim() && historySuggestions.length > 0 && (
                                    <div className={`border-t py-1 px-1.5 ${isLightTheme ? 'border-black/[0.04]' : 'border-white/[0.04]'}`}>
                                        {historySuggestions.slice(0, 5).map((item: HistoryItem, index: number) => {
                                            const domain = tryParseUrl(item.url);
                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => {
                                                        const newPageId = crypto.randomUUID();
                                                        useFlowStore.getState().addPageToFlow(activeFlowId!, { id: newPageId, url: item.url, title: item.title } as any);
                                                        useFlowStore.getState().setActivePage(newPageId);
                                                        setSearchQuery('');
                                                    }}
                                                    className="ntp-suggestion-row w-full flex items-center gap-3 px-3.5 py-[9px] text-left group"
                                                    style={{ animationDelay: `${index * 25}ms` }}
                                                >
                                                    <div className={`ntp-favicon w-5 h-5 shrink-0 rounded-[5px] flex items-center justify-center ${isLightTheme ? 'bg-black/[0.04]' : 'bg-white/[0.05]'}`}>
                                                        {(() => {
                                                            const favUrl = getFaviconUrl(item);
                                                            return favUrl ? (
                                                                <img src={favUrl} className="w-[13px] h-[13px] rounded-sm" alt="" />
                                                            ) : (
                                                                <Globe className="w-[11px] h-[11px] text-foreground/20" strokeWidth={1.5} />
                                                            );
                                                        })()}
                                                    </div>
                                                    <span className={`text-[13px] font-medium truncate group-hover:text-foreground/85 transition-colors flex-1 ${isLightTheme ? 'text-foreground/60' : 'text-foreground/55'}`}>
                                                        {item.title || 'Untitled'}
                                                    </span>
                                                    <span className={`text-[11px] shrink-0 font-medium tracking-wide ${isLightTheme ? 'text-foreground/25' : 'text-foreground/16'}`}>
                                                        — {domain}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Recent pages (when not searching) — show max 3 for clean look */}
                                {!searchQuery.trim() && activeFlow.pages.length > 0 && (
                                    <div className={`border-t py-1 px-1.5 ${isLightTheme ? 'border-black/[0.04]' : 'border-white/[0.04]'}`}>
                                        {activeFlow.pages.slice(0, 3).map((page: Page, index: number) => {
                                            const domain = tryParseUrl(page.url);
                                            return (
                                                <button
                                                    key={page.id}
                                                    onClick={() => useFlowStore.getState().setActivePage(page.id)}
                                                    className="ntp-suggestion-row w-full flex items-center gap-3 px-3.5 py-[9px] text-left group animate-fade-slide-in"
                                                    style={{ animationDelay: `${80 + index * 35}ms` }}
                                                >
                                                    <div className={`ntp-favicon w-5 h-5 shrink-0 rounded-[5px] flex items-center justify-center ${isLightTheme ? 'bg-black/[0.04]' : 'bg-white/[0.05]'}`}>
                                                        {(() => {
                                                            const favUrl = getFaviconUrl(page);
                                                            return favUrl ? (
                                                                <img src={favUrl} className="w-[13px] h-[13px] rounded-sm" alt="" />
                                                            ) : (
                                                                <Globe className="w-[11px] h-[11px] text-foreground/20" strokeWidth={1.5} />
                                                            );
                                                        })()}
                                                    </div>
                                                    <span className={`text-[13px] font-medium truncate group-hover:text-foreground/85 transition-colors flex-1 ${isLightTheme ? 'text-foreground/60' : 'text-foreground/55'}`}>
                                                        {page.title || 'Untitled'}
                                                    </span>
                                                    <span className={`text-[11px] shrink-0 font-medium tracking-wide ${isLightTheme ? 'text-foreground/25' : 'text-foreground/16'}`}>
                                                        — {domain}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Bottom toolbar — Dia-style action row */}
                                <div className={`ntp-toolbar flex items-center justify-between px-4 py-2.5 border-t ${isLightTheme ? 'border-black/[0.04]' : 'border-white/[0.04]'}`}>
                                    <div className="flex items-center gap-1.5">
                                        <select
                                            value={searchEngine}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSearchEngine(val);
                                                localStorage.setItem('flow-search-engine', val);
                                            }}
                                            className={`ntp-engine-select rounded-lg px-2 py-1 text-[11px] outline-none cursor-pointer transition-all appearance-none font-medium ${isLightTheme
                                                ? 'bg-black/[0.04] border border-black/[0.05] text-foreground/40 hover:bg-black/[0.07] hover:text-foreground/60'
                                                : 'bg-white/[0.04] border border-white/[0.04] text-foreground/35 hover:bg-white/[0.07] hover:text-foreground/50'
                                            }`}
                                        >
                                            <option value="google">Google</option>
                                            <option value="duckduckgo">DuckDuckGo</option>
                                            <option value="bing">Bing</option>
                                            <option value="yahoo">Yahoo</option>
                                            <option value="naver">Naver</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={toggleNotesPanel}
                                            className={`ntp-toolbar-btn w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isNotesPanelOpen
                                                ? (isLightTheme
                                                    ? 'text-foreground/65 bg-black/[0.07]'
                                                    : 'text-foreground/60 bg-white/[0.08]')
                                                : (isLightTheme
                                                    ? 'text-foreground/25 hover:text-foreground/55 hover:bg-black/[0.05]'
                                                    : 'text-foreground/20 hover:text-foreground/50 hover:bg-white/[0.06]')
                                            }`}
                                            title={isNotesPanelOpen ? 'Close notes' : 'Open notes'}
                                        >
                                            <FileText className="w-3.5 h-3.5" strokeWidth={1.8} />
                                        </button>
                                        <button
                                            className={`ntp-toolbar-btn w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isLightTheme
                                                ? 'text-foreground/25 hover:text-foreground/55 hover:bg-black/[0.05]'
                                                : 'text-foreground/20 hover:text-foreground/50 hover:bg-white/[0.06]'
                                            }`}
                                            title="Voice search"
                                        >
                                            <Mic className="w-3.5 h-3.5" strokeWidth={1.8} />
                                        </button>
                                        <button
                                            onClick={handleSearch}
                                            className={`ntp-toolbar-btn w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isLightTheme
                                                ? 'text-foreground/25 hover:text-foreground/55 hover:bg-black/[0.05]'
                                                : 'text-foreground/20 hover:text-foreground/50 hover:bg-white/[0.06]'
                                            }`}
                                            title="Search"
                                        >
                                            <ArrowUp className="w-3.5 h-3.5" strokeWidth={2} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default FlowView;
