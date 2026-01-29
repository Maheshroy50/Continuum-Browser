import { Plus, Target, Book, Briefcase, Hammer, Microscope, Layout, Pencil, Sun, Moon, Trash2, PanelLeftClose } from 'lucide-react';
// import { invoke } from '@tauri-apps/api/core';
import { ErrorBoundary } from './ErrorBoundary';
import { useFlowStore } from '../store/useFlowStore';
import { Flow } from '../shared/types';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { usePreferencesStore } from '../store/usePreferencesStore';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon } from 'lucide-react';
import { SettingsModal } from './settings/SettingsModal';

const FlowIcon = ({ type }: { type: Flow['type'] }) => {
    switch (type) {
        case 'Goal': return <Target className="w-4 h-4" strokeWidth={1.5} />;
        case 'Study': return <Book className="w-4 h-4" strokeWidth={1.5} />;
        case 'Job': return <Briefcase className="w-4 h-4" strokeWidth={1.5} />;
        case 'Build': return <Hammer className="w-4 h-4" strokeWidth={1.5} />;
        case 'Research': return <Microscope className="w-4 h-4" strokeWidth={1.5} />;
        default: return <Layout className="w-4 h-4" strokeWidth={1.5} />;
    }
};

function Sidebar() {
    const { t } = useTranslation();
    const { flows, activeFlowId, createFlow, setActiveFlow, renameFlow, clearHistory } = useFlowStore();
    const { theme, toggleTheme } = useTheme();
    const { toggleSidebar } = usePreferencesStore();
    const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when editing starts
    useEffect(() => {
        if (editingFlowId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingFlowId]);

    // Hide BrowserView when Settings modal is open
    useEffect(() => {
        if (isSettingsOpen) {
            if (isSettingsOpen) {
                if (window.ipcRenderer?.views) window.ipcRenderer.views.hide();
            } else {
                if (window.ipcRenderer?.views) window.ipcRenderer.views.show();
            }
        }
    }, [isSettingsOpen]);

    const handleCreateFlow = () => {
        const types: Flow['type'][] = ['Goal', 'Study', 'Job', 'Build', 'Research', 'Browse'];
        const randomType = types[Math.floor(Math.random() * types.length)];
        createFlow('New Workspace', randomType);
    };

    const startEditing = (flow: Flow) => {
        setEditingFlowId(flow.id);
        setEditValue(flow.title);
    };

    const saveEdit = () => {
        if (editingFlowId && editValue.trim()) {
            renameFlow(editingFlowId, editValue.trim());
        }
        setEditingFlowId(null);
        setEditValue('');
    };

    const cancelEdit = () => {
        setEditingFlowId(null);
        setEditValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            saveEdit();
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    };

    return (
        <ErrorBoundary>
            <div className="w-64 bg-sidebar border-r border-border flex flex-col h-full transition-colors duration-300 relative overflow-hidden">
                {/* Traffic Lights Spacer - with bottom border */}
                <div
                    className="h-10 w-full border-b border-border/50 flex items-center justify-end px-4"
                    style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
                >
                    <button
                        onClick={toggleTheme}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted/50 transition-colors"
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {theme === 'dark' ? (
                            <Sun className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                        ) : (
                            <Moon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                        )}
                    </button>
                    <button
                        onClick={toggleSidebar}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted/50 transition-colors"
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        title="Hide Sidebar"
                    >
                        <PanelLeftClose className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                    </button>
                </div>

                {/* Flow List */}
                <div className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
                    <div className="text-[10px] font-bold text-muted-foreground/50 px-3 py-2 uppercase tracking-widest flex justify-between items-center mb-1">
                        <span>{t('sidebar.workspaces')}</span>
                    </div>

                    {flows.map((flow) => (
                        <div key={flow.id} className="group relative pr-2 rounded-md flex items-center">
                            {editingFlowId === flow.id ? (
                                <div className="flex-1 px-2 py-1.5">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        onBlur={saveEdit}
                                        className="w-full bg-background border border-primary/50 rounded px-2 py-1 text-sm outline-none focus:border-primary"
                                    />
                                </div>
                            ) : (
                                <button
                                    onClick={() => setActiveFlow(flow.id)}
                                    onDoubleClick={() => startEditing(flow)}
                                    className={`relative flex-1 text-left px-3 py-2 rounded-lg flex items-center space-x-3 transition-colors ${activeFlowId === flow.id
                                        ? 'bg-muted text-foreground font-medium'
                                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                        }`}
                                >
                                    <span className={`${activeFlowId === flow.id ? 'opacity-100 text-primary' : 'opacity-70 group-hover:text-primary/80'}`}>
                                        <FlowIcon type={flow.type} />
                                    </span>
                                    <span className="truncate text-sm flex-1">{flow.title}</span>
                                    {flow.pages.length > 0 && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeFlowId === flow.id ? 'bg-background/50 text-muted-foreground' : 'text-muted-foreground/50 group-hover:text-muted-foreground'}`}>{flow.pages.length}</span>
                                    )}
                                </button>
                            )}

                            {editingFlowId !== flow.id && (
                                <div className="hidden group-hover:flex absolute right-2 bg-sidebar shadow-sm border border-border/50 rounded-md">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            startEditing(flow);
                                        }}
                                        className="p-1.5 hover:bg-muted/50 rounded-l-md transition-colors text-muted-foreground hover:text-foreground"
                                        title="Rename"
                                    >
                                        <Pencil className="w-3 h-3" strokeWidth={1.5} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Delete this flow?')) {
                                                useFlowStore.getState().deleteFlow(flow.id);
                                            }
                                        }}
                                        className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-r-md transition-colors text-muted-foreground"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {/* Bottom Actions */}
                <div className="p-3 border-t border-border/50 space-y-2">

                    <button
                        onClick={handleCreateFlow}
                        className="w-full flex items-center justify-center space-x-2 bg-primary/10 hover:bg-primary/20 text-primary h-9 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" strokeWidth={1.5} />
                        <span>{t('sidebar.newWorkspace')}</span>
                    </button>

                    <div className="flex space-x-2">
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="flex-1 flex items-center justify-center space-x-2 hover:bg-muted/50 text-muted-foreground hover:text-foreground h-8 rounded-lg text-xs font-medium transition-colors"
                        >
                            <SettingsIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
                            <span>Settings</span>
                        </button>
                        <button
                            onClick={async () => {
                                if (confirm('Clear all browsing data? This will reset the app. This cannot be undone.')) {
                                    try {
                                        clearHistory();
                                        localStorage.removeItem('continuum-welcome-seen');
                                        localStorage.clear();
                                        window.location.reload();
                                    } catch (e) {
                                        console.error('Failed to clear data:', e);
                                    }
                                }
                            }}
                            className="flex-1 flex items-center justify-center space-x-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive h-8 rounded-lg text-xs font-medium transition-colors"
                            title="Clear browsing data"
                        >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                            <span>Clear</span>
                        </button>
                    </div>
                </div>

                <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            </div>
        </ErrorBoundary>
    );
}

export default Sidebar;
