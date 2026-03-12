import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Globe, Plus, ExternalLink, Trash2, EyeOff } from 'lucide-react';
import { usePreferencesStore, FavoriteSite } from '../store/usePreferencesStore';
import { useFlowStore } from '../store/useFlowStore';

/**
 * FavoritesBar — Arc-style top-of-window favorite sites dock.
 * Shows a row of favicon icons that act as quick-launch shortcuts.
 * Sites can be added from the current page, reordered, or removed.
 */
export function FavoritesBar() {
    const favoriteSites = usePreferencesStore(state => state.favoriteSites);
    const showFavoritesBar = usePreferencesStore(state => state.showFavoritesBar);
    const removeFavoriteSite = usePreferencesStore(state => state.removeFavoriteSite);
    const addFavoriteSite = usePreferencesStore(state => state.addFavoriteSite);
    const reorderFavoriteSites = usePreferencesStore(state => state.reorderFavoriteSites);
    const toggleFavoritesBar = usePreferencesStore(state => state.toggleFavoritesBar);
    const { activeFlowId, addPageToFlow } = useFlowStore();

    const currentTheme = usePreferencesStore(state => state.theme);
    const isLight = currentTheme === 'light';

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; siteId: string } | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addUrl, setAddUrl] = useState('');
    const [addTitle, setAddTitle] = useState('');
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const contextRef = useRef<HTMLDivElement>(null);
    const addModalRef = useRef<HTMLDivElement>(null);

    // Close context menu on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
                setContextMenu(null);
            }
            if (addModalRef.current && !addModalRef.current.contains(e.target as Node)) {
                setShowAddModal(false);
            }
        };
        if (contextMenu || showAddModal) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [contextMenu, showAddModal]);

    // Listen for "add current page to favorites" from main process
    useEffect(() => {
        const handler = (_event: any, data: { url: string; title: string; favicon?: string }) => {
            if (data?.url) {
                addFavoriteSite({
                    id: crypto.randomUUID(),
                    url: data.url,
                    title: data.title || tryParseUrl(data.url),
                    favicon: data.favicon,
                });
            }
        };
        // @ts-ignore
        window.ipcRenderer?.on('favorites:add-current', handler);
        return () => {
            // @ts-ignore
            window.ipcRenderer?.off('favorites:add-current', handler);
        };
    }, [addFavoriteSite]);

    if (!showFavoritesBar) return null;

    const tryParseUrl = (url: string) => {
        try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
    };

    const getFaviconUrl = (site: FavoriteSite) => {
        if (site.favicon) return site.favicon;
        try {
            const hostname = new URL(site.url).hostname;
            return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
        } catch {
            return null;
        }
    };

    const handleNavigate = (url: string, title: string) => {
        if (!activeFlowId) return;
        const newPageId = crypto.randomUUID();
        addPageToFlow(activeFlowId, {
            id: newPageId,
            url,
            title,
            favicon: '',
            lastVisited: Date.now(),
        });
    };

    const handleAddSite = () => {
        if (!addUrl.trim()) return;
        let url = addUrl.trim();
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

        addFavoriteSite({
            id: crypto.randomUUID(),
            url,
            title: addTitle.trim() || tryParseUrl(url),
        });
        setAddUrl('');
        setAddTitle('');
        setShowAddModal(false);
    };

    // Drag & drop reorder
    const handleDragStart = (siteId: string) => {
        setDraggedId(siteId);
    };
    const handleDragOver = (e: React.DragEvent, siteId: string) => {
        e.preventDefault();
        if (siteId !== draggedId) setDragOverId(siteId);
    };
    const handleDrop = (targetId: string) => {
        if (!draggedId || draggedId === targetId) {
            setDraggedId(null);
            setDragOverId(null);
            return;
        }
        const items = [...favoriteSites];
        const fromIdx = items.findIndex(s => s.id === draggedId);
        const toIdx = items.findIndex(s => s.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return;

        const [moved] = items.splice(fromIdx, 1);
        items.splice(toIdx, 0, moved);
        reorderFavoriteSites(items);
        setDraggedId(null);
        setDragOverId(null);
    };

    return (
        <>
            <div
                className="favorites-bar flex items-center h-[38px] min-h-[38px] shrink-0 px-2 gap-[2px] overflow-x-auto"
                style={{
                    scrollbarWidth: 'none',
                    background: 'transparent',
                }}
            >
                {/* Favorite Sites */}
                {favoriteSites.map(site => {
                    const favUrl = getFaviconUrl(site);
                    const domain = tryParseUrl(site.url);
                    const isDragging = draggedId === site.id;
                    const isDragOver = dragOverId === site.id;

                    return (
                        <div
                            key={site.id}
                            draggable
                            onDragStart={() => handleDragStart(site.id)}
                            onDragOver={(e) => handleDragOver(e, site.id)}
                            onDrop={() => handleDrop(site.id)}
                            onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                            onClick={() => handleNavigate(site.url, site.title)}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({ x: e.clientX, y: e.clientY, siteId: site.id });
                            }}
                            className={`
                                group relative flex items-center justify-center
                                w-[30px] h-[30px] rounded-[10px]
                                cursor-pointer select-none shrink-0
                                transition-all duration-200 ease-out
                                ${isLight
                                    ? 'hover:bg-black/[0.06] active:bg-black/[0.1]'
                                    : 'hover:bg-white/[0.08] active:bg-white/[0.14]'
                                }
                                ${isDragging ? 'opacity-40 scale-90' : ''}
                                ${isDragOver ? (isLight ? 'bg-black/[0.08] scale-110' : 'bg-white/[0.12] scale-110') : ''}
                            `}
                            title={`${site.title}\n${domain}`}
                        >
                            {favUrl ? (
                                <img
                                    src={favUrl}
                                    className="w-[18px] h-[18px] rounded-[4px] transition-transform duration-200 group-hover:scale-110"
                                    alt={site.title}
                                    draggable={false}
                                />
                            ) : (
                                <Globe
                                    className={`w-[16px] h-[16px] ${isLight ? 'text-black/50' : 'text-white/50'}`}
                                    strokeWidth={1.8}
                                />
                            )}
                        </div>
                    );
                })}

                {/* Add Favorite Button */}
                <button
                    onClick={() => setShowAddModal(true)}
                    className={`
                        w-[28px] h-[28px] rounded-[9px] flex items-center justify-center shrink-0
                        transition-all duration-200
                        ${isLight
                            ? 'text-black/20 hover:text-black/45 hover:bg-black/[0.05]'
                            : 'text-white/20 hover:text-white/45 hover:bg-white/[0.06]'
                        }
                    `}
                    title="Add favorite site"
                >
                    <Plus className="w-[13px] h-[13px]" strokeWidth={2} />
                </button>
            </div>

            {/* ── Context Menu ── */}
            {contextMenu && createPortal(
                <div
                    ref={contextRef}
                    className="fixed z-[999] py-1.5 rounded-xl min-w-[170px] overflow-hidden"
                    style={{
                        left: contextMenu.x,
                        top: contextMenu.y,
                        background: isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(20, 24, 30, 0.95)',
                        border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
                        backdropFilter: 'blur(24px) saturate(140%)',
                        WebkitBackdropFilter: 'blur(24px) saturate(140%)',
                        boxShadow: isLight
                            ? '0 8px 32px rgba(0,0,0,0.12), 0 0 1px rgba(0,0,0,0.1)'
                            : '0 8px 32px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.1)',
                    }}
                >
                    {/* Open in new tab */}
                    <button
                        onClick={() => {
                            const site = favoriteSites.find(s => s.id === contextMenu.siteId);
                            if (site) handleNavigate(site.url, site.title);
                            setContextMenu(null);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] transition-colors ${isLight ? 'text-black/60 hover:text-black hover:bg-black/[0.05]' : 'text-white/65 hover:text-white hover:bg-white/[0.07]'}`}
                    >
                        <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.8} />
                        Open in New Tab
                    </button>

                    {/* Remove */}
                    <button
                        onClick={() => {
                            removeFavoriteSite(contextMenu.siteId);
                            setContextMenu(null);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] transition-colors ${isLight ? 'text-red-500/70 hover:text-red-600 hover:bg-red-50' : 'text-red-400/70 hover:text-red-400 hover:bg-red-500/10'}`}
                    >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                        Remove from Favorites
                    </button>

                    <div className={`my-1 mx-2 h-px ${isLight ? 'bg-black/6' : 'bg-white/8'}`} />

                    {/* Hide bar */}
                    <button
                        onClick={() => {
                            toggleFavoritesBar();
                            setContextMenu(null);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] transition-colors ${isLight ? 'text-black/50 hover:text-black/70 hover:bg-black/[0.04]' : 'text-white/45 hover:text-white/65 hover:bg-white/[0.05]'}`}
                    >
                        <EyeOff className="w-3.5 h-3.5" strokeWidth={1.8} />
                        Hide Favorites Bar
                    </button>
                </div>,
                document.body
            )}

            {/* ── Add Site Modal ── */}
            {showAddModal && createPortal(
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div
                        ref={addModalRef}
                        className="w-[360px] rounded-2xl p-5 flex flex-col gap-4"
                        style={{
                            background: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(22, 26, 32, 0.98)',
                            border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
                            backdropFilter: 'blur(32px)',
                            boxShadow: isLight
                                ? '0 16px 48px rgba(0,0,0,0.12)'
                                : '0 16px 48px rgba(0,0,0,0.5)',
                        }}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className={`text-[14px] font-semibold ${isLight ? 'text-black/80' : 'text-white/90'}`}>
                                Add Favorite Site
                            </h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${isLight ? 'hover:bg-black/[0.06] text-black/40' : 'hover:bg-white/[0.08] text-white/40'}`}
                            >
                                <X className="w-3.5 h-3.5" strokeWidth={2} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div>
                                <label className={`text-[11px] font-medium mb-1 block ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                                    URL
                                </label>
                                <input
                                    type="text"
                                    value={addUrl}
                                    onChange={(e) => setAddUrl(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSite()}
                                    placeholder="https://github.com"
                                    autoFocus
                                    className={`w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-all ${isLight
                                        ? 'bg-black/[0.04] border border-black/[0.08] text-black/80 placeholder:text-black/25 focus:border-blue-500/40 focus:bg-black/[0.02]'
                                        : 'bg-white/[0.06] border border-white/[0.08] text-white/85 placeholder:text-white/25 focus:border-blue-500/50 focus:bg-white/[0.08]'
                                    }`}
                                />
                            </div>
                            <div>
                                <label className={`text-[11px] font-medium mb-1 block ${isLight ? 'text-black/50' : 'text-white/50'}`}>
                                    Name (optional)
                                </label>
                                <input
                                    type="text"
                                    value={addTitle}
                                    onChange={(e) => setAddTitle(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSite()}
                                    placeholder="GitHub"
                                    className={`w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-all ${isLight
                                        ? 'bg-black/[0.04] border border-black/[0.08] text-black/80 placeholder:text-black/25 focus:border-blue-500/40 focus:bg-black/[0.02]'
                                        : 'bg-white/[0.06] border border-white/[0.08] text-white/85 placeholder:text-white/25 focus:border-blue-500/50 focus:bg-white/[0.08]'
                                    }`}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-1">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${isLight ? 'text-black/50 hover:bg-black/[0.05]' : 'text-white/50 hover:bg-white/[0.06]'}`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddSite}
                                disabled={!addUrl.trim()}
                                className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
