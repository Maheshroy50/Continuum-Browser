import { useFlowStore } from '../store/useFlowStore';
import { usePreferencesStore } from '../store/usePreferencesStore';
import { useThemeColorStore } from '../store/useThemeColorStore';
import { Globe, Plus, X, Pin } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * TabStrip — Chrome-style tab bar where the active tab
 * visually connects to the content area below.
 */
export function TabStrip() {
    const activeFlow = useFlowStore(state => state.flows.find(f => f.id === state.activeFlowId));
    const activePageId = useFlowStore(state => state.activePageId);
    const setActivePage = useFlowStore(state => state.setActivePage);
    const removePage = useFlowStore(state => state.removePage);
    const updatePage = useFlowStore(state => state.updatePage);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pageId: string } | null>(null);
    const contextRef = useRef<HTMLDivElement>(null);
    const currentTheme = usePreferencesStore(state => state.theme);
    const isLight = currentTheme === 'light';
    const isZenMode = useFlowStore(state => state.isZenMode);
    const sidebarHidden = usePreferencesStore(state => state.sidebarHidden);
    const sidebarGone = isZenMode || sidebarHidden;
    const themePreset = useThemeColorStore(state => state.getActivePreset());
    const isDiaTheme = ['dia', 'obsidian', 'emerald', 'ocean', 'cobalt', 'amethyst', 'sunrise', 'ember', 'rose'].includes(currentTheme);

    // The active tab's background must match the content area below
    const contentBg = isLight ? 'hsl(0, 0%, 100%)' : (isDiaTheme ? 'rgba(255, 255, 255, 0.04)' : themePreset.innerFrame);
    // The tab strip background is darker — the "shelf" behind the tabs
    const stripBg = isLight ? 'hsl(0, 0%, 88%)' : (isDiaTheme ? 'transparent' : 'rgba(0, 0, 0, 0.35)');

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
                setContextMenu(null);
            }
        };
        if (contextMenu) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [contextMenu]);

    if (!activeFlow) return null;

    const pages = activeFlow.pages;
    const pinnedPages = pages.filter(p => p.isPinned);
    const regularPages = pages.filter(p => !p.isPinned);

    const tryParseUrl = (url: string) => {
        try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
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

    return (
        <div
            className="tab-strip flex items-end h-[40px] min-h-[40px] shrink-0 pl-2 pr-2 overflow-visible pointer-events-auto w-full"
            style={{
                WebkitAppRegion: 'drag',
                background: stripBg,
            } as React.CSSProperties}
        >
            {/* macOS traffic lights spacer — only needed when sidebar is hidden */}
            <div className="shrink-0 transition-all duration-200 h-full" style={{ width: sidebarGone ? 68 : 4 }} />

            {/* ── Pinned Tabs ── */}
            {pinnedPages.length > 0 && (
                <div
                    className="tab-pinned-capsule flex items-center gap-[5px] h-[30px] px-[5px] shrink-0 mr-[6px] mb-[4px] rounded-[8px]"
                    style={{
                        WebkitAppRegion: 'no-drag',
                        background: 'transparent', // Dia style - no background for capsule
                    } as React.CSSProperties}
                >
                    {pinnedPages.map(page => {
                        const isActive = page.id === activePageId;
                        const domain = tryParseUrl(page.url);
                        const favUrl = getFaviconUrl(page);

                        return (
                            <div
                                key={page.id}
                                onClick={() => setActivePage(page.id)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setContextMenu({ x: e.clientX, y: e.clientY, pageId: page.id });
                                }}
                                className={`
                                    tab-pinned-icon relative w-[26px] h-[26px] rounded-[6px] flex items-center justify-center
                                    cursor-pointer select-none shrink-0
                                    transition-all duration-200 ease-out
                                    ${isActive
                                        ? (isLight ? 'bg-black/[0.06]' : 'bg-white/[0.12]')
                                        : (isLight ? 'bg-transparent hover:bg-black/[0.05]' : 'bg-transparent hover:bg-white/[0.08]')
                                    }
                                `}
                                style={{
                                    boxShadow: 'none', // Dia style - no box shadow for pinned icons
                                }}
                                title={page.title || domain}
                            >
                                {favUrl ? (
                                    <img
                                        src={favUrl}
                                        className={`w-[16px] h-[16px] rounded-[2px] transition-all duration-200 ${isActive ? 'opacity-100' : isLight ? 'opacity-55' : 'opacity-60 hover:opacity-90'}`}
                                        alt=""
                                        draggable={false}
                                    />
                                ) : (
                                    <Globe className={`w-[15px] h-[15px] ${isActive ? (isLight ? 'text-black/80' : 'text-white/90') : (isLight ? 'text-black/35' : 'text-white/40')}`} strokeWidth={1.8} />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Regular Tabs ── */}
            <div
                className="tab-regular-rail flex items-end overflow-x-auto overflow-y-hidden h-full flex-1 gap-[1px] pb-0"
                style={{ scrollbarWidth: 'none' }}
            >
                {/* New Tab entry — shown when no page is active (NTP is visible) */}
                {!activePageId && (
                    <div
                        className="tab-item tab-item-active group relative flex items-center h-[34px] cursor-default select-none shrink-0 max-w-[220px] min-w-[80px] rounded-t-[10px] px-3 gap-[7px]"
                        style={{
                            WebkitAppRegion: 'no-drag',
                            background: contentBg,
                        } as React.CSSProperties}
                    >
                        <div className="w-[16px] h-[16px] shrink-0 flex items-center justify-center">
                            <Plus className={`w-[14px] h-[14px] ${isLight ? 'text-black/70' : 'text-white/85'}`} strokeWidth={1.5} />
                        </div>
                        <span className={`text-[12px] truncate leading-none flex-1 font-[500] ${isLight ? 'text-black/80' : 'text-white/90'}`}>
                            New Tab
                        </span>
                    </div>
                )}

                {regularPages.map(page => {
                    const isActive = page.id === activePageId;
                    const domain = tryParseUrl(page.url);
                    const favUrl = getFaviconUrl(page);

                    return (
                        <div
                            key={page.id}
                            onClick={() => setActivePage(page.id)}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({ x: e.clientX, y: e.clientY, pageId: page.id });
                            }}
                            className={`
                                tab-item group relative flex items-center
                                cursor-pointer select-none shrink-0 max-w-[220px] min-w-[80px]
                                transition-all duration-200 ease-out
                                ${isActive
                                    ? 'tab-item-active h-[32px] rounded-[8px] px-3 gap-[7px] mb-[4px] border border-white/[0.08]'
                                    : `tab-item-inactive h-[32px] rounded-[8px] px-2.5 gap-[6px] mb-[4px] border border-transparent ${isLight ? 'hover:bg-black/[0.06]' : 'hover:bg-white/[0.06]'}`
                                }
                            `}
                            style={{
                                WebkitAppRegion: 'no-drag',
                                alignSelf: 'flex-end',
                                ...(isActive ? {
                                    background: isDiaTheme ? 'rgba(255, 255, 255, 0.08)' : contentBg,
                                    backdropFilter: isDiaTheme ? 'blur(12px)' : 'none',
                                } : {}),
                            } as React.CSSProperties}
                        >
                            {/* Favicon */}
                            <div className="w-[16px] h-[16px] shrink-0 flex items-center justify-center">
                                {favUrl ? (
                                    <img
                                        src={favUrl}
                                        className={`w-[14px] h-[14px] rounded-[2px] transition-all duration-200 ${isActive ? 'opacity-100' : isLight ? 'opacity-80' : 'opacity-70'}`}
                                        alt=""
                                        draggable={false}
                                    />
                                ) : (
                                    <Globe className={`w-[14px] h-[14px] ${isActive ? (isLight ? 'text-black/75' : 'text-white/85') : (isLight ? 'text-black/60' : 'text-white/55')}`} strokeWidth={1.5} />
                                )}
                            </div>

                            {/* Title */}
                            <span className={`text-[12px] truncate leading-none flex-1 transition-colors duration-200 ${isActive ? (isLight ? 'text-black/85 font-[500]' : 'text-white/90 font-[500]') : (isLight ? 'text-black/70 font-normal' : 'text-white/65 font-normal')}`}>
                                {page.title || domain || 'New Tab'}
                            </span>

                            {/* Close */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removePage(activeFlow.id, page.id);
                                }}
                                className={`
                                    w-[18px] h-[18px] shrink-0 rounded-[5px] flex items-center justify-center
                                    transition-all duration-150
                                    ${isActive
                                        ? `opacity-0 group-hover:opacity-100 ${isLight ? 'hover:bg-black/[0.08] text-black/40 hover:text-black/80' : 'hover:bg-white/[0.14] text-white/50 hover:text-white'}`
                                        : `opacity-0 group-hover:opacity-60 ${isLight ? 'hover:bg-black/[0.06] text-black/25 hover:text-black/60' : 'hover:bg-white/[0.08] text-white/25 hover:text-white/60'}`
                                    }
                                `}
                            >
                                <X className="w-[10px] h-[10px]" strokeWidth={2.5} />
                            </button>
                        </div>
                    );
                })}

                {/* New Tab + */}
                <button
                    onClick={() => {
                        setActivePage(null as any);
                        if (window.ipcRenderer?.views) {
                            window.ipcRenderer.views.hide();
                        }
                    }}
                    className={`tab-new-btn w-[28px] h-[28px] shrink-0 rounded-[8px] flex items-center justify-center transition-all duration-200 ml-1 mb-[6px] ${isLight ? 'text-black/25 hover:text-black/50 hover:bg-black/[0.06]' : 'text-white/25 hover:text-white/50 hover:bg-white/[0.06]'}`}
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    title="New Tab (⌘T)"
                >
                    <Plus className="w-[13px] h-[13px]" strokeWidth={2} />
                </button>
            </div>

            {/* Context Menu */}
            {contextMenu && createPortal(
                <div
                    ref={contextRef}
                    className="fixed z-[999] py-1.5 rounded-xl min-w-[160px] overflow-hidden"
                    style={{
                        left: contextMenu.x,
                        top: contextMenu.y,
                        background: isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(20, 24, 30, 0.95)',
                        border: isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.08)',
                        backdropFilter: 'blur(24px) saturate(140%)',
                        WebkitBackdropFilter: 'blur(24px) saturate(140%)',
                        boxShadow: isLight
                            ? '0 8px 32px rgba(0,0,0,0.12), 0 0 1px rgba(0,0,0,0.1)'
                            : '0 8px 32px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.1)',
                    }}
                >
                    <button
                        onClick={() => {
                            const page = pages.find(p => p.id === contextMenu.pageId);
                            if (page) {
                                updatePage(activeFlow.id, page.id, { isPinned: !page.isPinned });
                            }
                            setContextMenu(null);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] transition-colors ${isLight ? 'text-black/65 hover:text-black hover:bg-black/[0.06]' : 'text-white/65 hover:text-white hover:bg-white/[0.07]'}`}
                    >
                        <Pin className="w-3.5 h-3.5" strokeWidth={1.8} />
                        {pages.find(p => p.id === contextMenu.pageId)?.isPinned ? 'Unpin Tab' : 'Pin Tab'}
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
}
