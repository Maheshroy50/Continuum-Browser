import { X, Clock, Star } from 'lucide-react';
import { useFlowStore } from '../store/useFlowStore';
// import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';

export function HistoryPanel() {
    const { history, bookmarks, activeFlowId, activePageId, toggleHistory, addPageToFlow } = useFlowStore();
    const [activeTab, setActiveTab] = useState<'history' | 'bookmarks'>('history');
    const [filter, setFilter] = useState('');

    const handleItemClick = (item: { url: string; title?: string }) => {
        if (!activeFlowId) return;
        if (activePageId) {
            if (window.ipcRenderer?.views) {
                window.ipcRenderer.views.updateUrl(item.url);
            }
        } else {
            const pageTitle = item.title || item.url;
            addPageToFlow(activeFlowId, {
                id: crypto.randomUUID(),
                url: item.url,
                title: pageTitle,
                lastVisited: Date.now(),
                favicon: `https://www.google.com/s2/favicons?domain=${item.url}&sz=64`
            });
        }
        toggleHistory();
    };

    const renderEmptyState = (type: 'history' | 'bookmarks', isFiltered: boolean) => (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
            {type === 'history' ? (
                <>
                    <Clock className="w-8 h-8 mb-2 opacity-20" />
                    <p>{isFiltered ? 'No results' : 'No history yet'}</p>
                </>
            ) : (
                <>
                    <Star className="w-8 h-8 mb-2 opacity-20" />
                    <p>{isFiltered ? 'No results' : 'No bookmarks yet'}</p>
                </>
            )}
        </div>
    );

    const items = activeTab === 'history' ? history : bookmarks;
    const normalizedFilter = filter.trim().toLowerCase();
    const filteredItems = normalizedFilter
        ? items.filter((item) =>
            (item.title || '').toLowerCase().includes(normalizedFilter) ||
            item.url.toLowerCase().includes(normalizedFilter)
        )
        : items;

    return (
        <div className="history-panel w-80 h-full bg-background border-l border-border flex flex-col z-10 transition-all duration-300 ease-in-out">
            {/* Header with Tabs */}
            <div className="h-14 border-b border-border flex items-center justify-between px-2 shrink-0">
                <div className="flex items-center space-x-1 bg-muted/50 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'history' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        <span>History</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('bookmarks')}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'bookmarks' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Star className="w-3.5 h-3.5" />
                        <span>Bookmarks</span>
                    </button>
                </div>
                <button
                    onClick={toggleHistory}
                    className="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <div className="px-1 pb-2">
                    <input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder={activeTab === 'history' ? 'Search history' : 'Search bookmarks'}
                        className="w-full bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground/50 rounded-lg px-3 py-2 outline-none border border-transparent focus:border-border"
                    />
                </div>
                {filteredItems.length === 0 ? renderEmptyState(activeTab, !!normalizedFilter) : (
                    filteredItems.slice(0, 50).map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleItemClick(item)}
                            className="w-full text-left p-3 rounded-lg hover:bg-muted/50 group transition-colors border border-transparent hover:border-border/50"
                        >
                            <div className="font-medium text-sm truncate pr-2 max-w-full">
                                {typeof item.title === 'string' ? (item.title || item.url) : String(item.title || item.url || '')}
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                                    {/* Handle potentially invalid URLs gracefully */}
                                    {(() => {
                                        try {
                                            return new URL(item.url).hostname.replace('www.', '');
                                        } catch {
                                            return item.url;
                                        }
                                    })()}
                                </span>
                                {activeTab === 'history' && (
                                    <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
                                        {/* @ts-ignore */}
                                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
