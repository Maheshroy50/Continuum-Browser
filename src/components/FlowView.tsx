import { Globe } from 'lucide-react';
import { useFlowStore } from '../store/useFlowStore';
import { useAIStore } from '../store/useAIStore';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

function FlowView() {
    const { t } = useTranslation();
    const { flows, activeFlowId, activePageId, removePage, setSplitSecondaryInfo } = useFlowStore();
    const splitView = useFlowStore(state => state.splitView) || { isOpen: false, activePageId: null, secondaryPageId: null };
    const isAIPanelOpen = useAIStore(state => state.isOpen);
    const activeFlow = flows.find(f => f.id === activeFlowId);

    // Debugging
    useEffect(() => {
        console.log('[FlowView] Rendering. ActiveFlowId:', activeFlowId, 'ActivePageId:', activePageId);
        console.log('[FlowView] ActiveFlow found:', !!activeFlow, 'Pages:', activeFlow?.pages.length);
    }, [activeFlowId, activePageId, activeFlow]);

    // Refs for layout containers
    const primaryRef = useRef<HTMLDivElement>(null);
    const secondaryRef = useRef<HTMLDivElement>(null);
    // Legacy single ref
    const contentRef = useRef<HTMLDivElement>(null);

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
                    let width = Math.round(rect.width);
                    if (isAIPanelOpen) {
                        width = Math.max(0, width - 384); // w-96 = 384px
                    }

                    // @ts-ignore
                    window.ipcRenderer?.views?.resize({
                        x: Math.round(rect.left),
                        y: Math.round(rect.top),
                        width: width,
                        height: Math.round(rect.height)
                    });
                    // @ts-ignore
                    window.ipcRenderer?.views?.show();
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


    // === NO WORKSPACE SELECTED ===
    if (!activeFlow) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-background h-full relative overflow-hidden">
                {/* Aurora Background Effect */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] opacity-30 animate-pulse-glow" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[90px] opacity-20 animate-pulse-glow delay-100" />

                <div className="relative z-10 flex flex-col items-center animate-slide-up">
                    <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-xl shadow-2xl">
                        <Globe className="w-10 h-10 text-primary opacity-80" strokeWidth={1} />
                    </div>
                    <h2 className="text-3xl font-medium mb-3 tracking-tight">{t('flowView.noWorkspaceSelected')}</h2>
                    <p className="max-w-md text-center text-muted-foreground/60 leading-relaxed mb-8">{t('flowView.selectWorkspace')}</p>

                    {/* Debug Info (Subtle) */}
                    <div className="mt-8 px-4 py-2 rounded-full bg-black/5 dark:bg-white/5 text-[10px] font-mono text-muted-foreground/30">
                        FlowID: {activeFlowId || 'null'}
                    </div>
                </div>
            </div>
        );
    }

    // === SPLIT VIEW RENDER ===
    if (splitView.isOpen) {
        return (
            <div className="flex-1 flex flex-row min-w-0 h-full bg-background relative overflow-hidden">
                {/* Primary Pane (Left) */}
                <div ref={primaryRef} className="flex-1 min-w-0 h-full border-r border-border relative" />

                {/* Secondary Pane (Right) */}
                <div ref={secondaryRef} className="flex-1 min-w-0 h-full relative bg-muted/5 flex flex-col">
                    {!splitView.secondaryPageId && (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                            <h3 className="text-lg font-medium text-foreground mb-4">Select Page for Split View</h3>
                            <div className="w-full max-w-sm space-y-2 overflow-y-auto max-h-[400px] p-1">
                                {activeFlow.pages.filter(p => p.id !== splitView.activePageId).map((page, idx) => (
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
                                {activeFlow.pages.filter(p => p.id !== splitView.activePageId).length === 0 && (
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
        <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
            <div ref={contentRef} className="flex-1 flex flex-col relative w-full h-full">
                {!activePageId && (
                    <div className="flex-1 w-full overflow-y-auto p-6 md:p-8">
                        {/* Header */}
                        <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h1 className="text-3xl font-bold tracking-tight text-foreground">{activeFlow.title}</h1>
                                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] uppercase font-bold tracking-wide">
                                        {activeFlow.type}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
                                    <span>{activeFlow.pages.length} pages</span>
                                    <span className="text-muted-foreground/30">•</span>
                                    <span>Last active {new Date().toLocaleDateString()}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => document.querySelector('input')?.focus()}
                                className="px-5 py-2.5 bg-foreground text-background rounded-full text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-foreground/10"
                            >
                                + New Page
                            </button>
                        </div>

                        {/* Pages Grid */}
                        {activeFlow.pages.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border/50 bg-card/30 p-16 text-center max-w-lg mx-auto">
                                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <Globe className="w-8 h-8 text-primary/60" strokeWidth={1.5} />
                                </div>
                                <h3 className="font-semibold text-xl mb-2">{t('flowView.addPages')}</h3>
                                <p className="text-muted-foreground text-sm mb-8 max-w-xs mx-auto leading-relaxed">
                                    {t('flowView.workspaceRemember')}
                                </p>
                                <button
                                    onClick={() => document.querySelector('input')?.focus()}
                                    className="px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
                                >
                                    Start Browsing
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {activeFlow.pages.map((page) => (
                                    <div
                                        key={page.id}
                                        onClick={() => useFlowStore.getState().setActivePage(page.id)}
                                        className="group relative h-44 rounded-2xl p-5 cursor-pointer glass hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/5 transition-all duration-200 flex flex-col justify-between overflow-hidden"
                                    >
                                        {/* Hover gradient overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

                                        <div className="flex justify-between items-start relative z-10">
                                            <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
                                                {page.favicon ? <img src={page.favicon} className="w-5 h-5 rounded-sm" /> : <Globe className="w-5 h-5 opacity-50" />}
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removePage(activeFlow.id, page.id);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-all"
                                                title="Remove page"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                            </button>
                                        </div>

                                        <div className="relative z-10">
                                            <h3 className="font-medium truncate text-base mb-1 group-hover:text-primary transition-colors">{page.title || 'Untitled Page'}</h3>
                                            <div className="text-xs text-muted-foreground/70 truncate">
                                                {page.url.replace(/^https?:\/\/(www\.)?/, '')}
                                            </div>
                                        </div>

                                        {/* Active badge */}
                                        {activeFlow.lastActivePageId === page.id && (
                                            <div className="absolute top-3 right-3 px-2 py-0.5 bg-primary/20 text-primary text-[9px] uppercase font-bold tracking-wide rounded-md backdrop-blur-sm">
                                                Active
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default FlowView;
