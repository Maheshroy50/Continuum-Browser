import { X, Clock, Star } from 'lucide-react';
import { useFlowStore } from '../store/useFlowStore';
// import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';

export function HistoryPanel() {
    const { history, bookmarks, activeFlowId, activePageId, toggleHistory } = useFlowStore();
    const [activeTab, setActiveTab] = useState<'history' | 'bookmarks'>('history');

    const handleItemClick = (url: string) => {
        if (activeFlowId && activePageId) {
            // Navigate current page
            // Navigate current page
            if (window.ipcRenderer?.views) {
                window.ipcRenderer.views.updateUrl(activePageId, url);
            }
            toggleHistory(); // Close panel on selection if desired, or keep open
        }
    };

    const renderEmptyState = (type: 'history' | 'bookmarks') => (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
            {type === 'history' ? (
                <>
                    <Clock className="w-8 h-8 mb-2 opacity-20" />
                    <p>No history yet</p>
                </>
            ) : (
                <>
                    <Star className="w-8 h-8 mb-2 opacity-20" />
                    <p>No bookmarks yet</p>
                </>
            )}
        </div>
    );

    const items = activeTab === 'history' ? history : bookmarks;

    return (
        <div className="w-80 h-full bg-background border-l border-border flex flex-col z-10 transition-all duration-300 ease-in-out">
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
                {items.length === 0 ? renderEmptyState(activeTab) : (
                    items.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleItemClick(item.url)}
                            className="w-full text-left p-3 rounded-lg hover:bg-muted/50 group transition-colors border border-transparent hover:border-border/50"
                        >
                            <div className="font-medium text-sm truncate pr-2 max-w-full">
                                {item.title || item.url}
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
