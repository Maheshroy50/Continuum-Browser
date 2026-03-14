import {
    Plus,
    Target,
    Book,
    Briefcase,
    Hammer,
    Microscope,
    Layout,
    Pencil,
    Sun,
    Moon,
    Trash2,
    PanelLeftClose,
    Mail,
    Github,
    Figma,
    Music2,
    Youtube,
    Globe,
    Sparkles,
} from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { useFlowStore } from '../store/useFlowStore';
import { Flow } from '../shared/types';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { usePreferencesStore } from '../store/usePreferencesStore';
import { Settings as SettingsIcon } from 'lucide-react';
import { SettingsModal } from './settings/SettingsModal';
import { useSpatialAudio } from '../hooks/useSpatialAudio';
import { useAIStore } from '../store/useAIStore';

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

const FLOW_TYPE_COLORS: Record<string, string> = {
    Goal: 'text-rose-400',
    Study: 'text-blue-400',
    Job: 'text-amber-400',
    Build: 'text-emerald-400',
    Research: 'text-purple-400',
    Browse: 'text-sky-400',
};

const DIA_LAUNCHER_APPS = [
    { id: 'web', label: 'Web', icon: Globe, color: 'text-sky-400', hoverBg: 'hover:bg-sky-500/10' },
    { id: 'chat', label: 'AI Chat', icon: Sparkles, color: 'text-violet-400', hoverBg: 'hover:bg-violet-500/10' },
    { id: 'mail', label: 'Mail', icon: Mail, color: 'text-blue-400', hoverBg: 'hover:bg-blue-500/10' },
    { id: 'code', label: 'GitHub', icon: Github, color: 'text-foreground/80', hoverBg: 'hover:bg-white/5' },
    { id: 'design', label: 'Figma', icon: Figma, color: 'text-pink-400', hoverBg: 'hover:bg-pink-500/10' },
    { id: 'music', label: 'Music', icon: Music2, color: 'text-green-400', hoverBg: 'hover:bg-green-500/10' },
    { id: 'video', label: 'YouTube', icon: Youtube, color: 'text-red-400', hoverBg: 'hover:bg-red-500/10' },
];

function Sidebar() {
    const { flows, activeFlowId, createFlow, setActiveFlow, setActivePage, renameFlow, clearHistory, deleteFlow } = useFlowStore();
    const { toggleIsOpen } = useAIStore();
    const { theme, toggleTheme } = useTheme();
    const { toggleSidebar } = usePreferencesStore();
    const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const { playSound } = useSpatialAudio();

    useEffect(() => {
        if (editingFlowId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingFlowId]);

    useEffect(() => {
        if (isSettingsOpen) {
            // Signal to App.tsx sidebar shell to NOT retract while settings is open
            document.documentElement.dataset.settingsOpen = 'true';
            // Hide BrowserView IMMEDIATELY — it's a native OS overlay that renders above DOM
            if (window.ipcRenderer?.views) window.ipcRenderer.views.hide();
        } else {
            delete document.documentElement.dataset.settingsOpen;
            // Delay BrowserView re-show slightly to allow settings close animation to complete
            // and prevent a flash where BrowserView appears above the closing modal
            const timer = setTimeout(() => {
                // Double-check settings didn't re-open during the delay
                if (!document.documentElement.dataset.settingsOpen) {
                    if (window.ipcRenderer?.views) window.ipcRenderer.views.show();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
        return () => {
            // Cleanup on unmount — always restore BrowserView visibility
            delete document.documentElement.dataset.settingsOpen;
            if (window.ipcRenderer?.views) window.ipcRenderer.views.show();
        };
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
        if (e.key === 'Enter') saveEdit();
        else if (e.key === 'Escape') cancelEdit();
    };

    return (
        <ErrorBoundary>
            <div
                className="app-sidebar app-sidebar-root w-64 flex flex-col h-full relative overflow-hidden z-[200] group sidebar-premium"
                style={{ transition: 'background-color 0.3s ease' }}
            >
                {/* Ambient noise texture overlay */}
                <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.025]" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                }} />

                {/* Right edge: no separator — blend is handled by CSS border */}

                {/* ── TOP BAR ── */}
                <div className="sidebar-top-stack shrink-0 relative z-10">
                    {/* macOS traffic light spacer */}
                    <div className="h-[38px] w-full shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
                    <div className="h-9 w-full flex items-center justify-end px-3 shrink-0 mb-2">
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => { toggleTheme(); playSound('click', -0.9); }}
                                onMouseEnter={() => playSound('hover', -0.9)}
                                className="sidebar-icon-btn w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                            >
                                {theme === 'dark'
                                    ? <Sun className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                                    : <Moon className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />}
                            </button>
                            <button
                                onClick={() => { toggleSidebar(); playSound('click', -0.9); }}
                                onMouseEnter={() => playSound('hover', -0.9)}
                                className="sidebar-icon-btn w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                                title="Hide Sidebar"
                            >
                                <PanelLeftClose className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                            </button>
                        </div>
                    </div>

                    {/* ── DIA PINNED APPS (Grid layout like Arc) ── */}
                    <div className="px-3 pb-4">
                        <div className="grid grid-cols-4 gap-2">
                            {DIA_LAUNCHER_APPS.slice(0, 4).map((app) => (
                                <button
                                    key={app.id}
                                    onClick={() => {
                                        if (app.id === 'chat') {
                                            if (window.ipcRenderer?.send) window.ipcRenderer.send('ai:toggle');
                                            else toggleIsOpen();
                                            playSound('click', -0.85);
                                        } else {
                                            setActivePage(null);
                                            playSound('click', -0.85);
                                        }
                                    }}
                                    onMouseEnter={() => playSound('hover', -0.95)}
                                    className={`dia-launcher-item group/app flex flex-col items-center justify-center h-12 rounded-xl transition-all duration-200 bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/10`}
                                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                                    title={app.label}
                                >
                                    <app.icon
                                        className={`w-5 h-5 transition-all duration-200 text-foreground/60 group-hover/app:${app.color} group-hover/app:scale-110`}
                                        strokeWidth={1.5}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-px mx-3 mb-2 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
                </div>

                {/* ── FLOW LIST (SPACES) ── */}
                <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1 flex flex-col items-stretch scrollbar-hide relative z-10">
                    <div className="text-[11px] font-semibold text-foreground/40 px-2 py-2 uppercase tracking-wider flex justify-between items-center h-8">
                        <span>Spaces</span>
                    </div>

                    {flows.map((flow, index) => (
                        <div key={`${flow.id}-${index}`} className="group/item relative flex items-center w-full">
                            {editingFlowId === flow.id ? (
                                <div className="flex-1 px-2 py-1.5 w-full">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        onBlur={saveEdit}
                                        className="w-full bg-white/5 border border-primary/40 rounded-lg px-2.5 py-1 text-sm outline-none focus:border-primary/60 text-foreground"
                                    />
                                </div>
                            ) : (
                                <button
                                    onClick={() => { setActiveFlow(flow.id); playSound('click', -0.8); }}
                                    onMouseEnter={() => playSound('hover', -0.8)}
                                    onDoubleClick={() => startEditing(flow)}
                                    className={`relative w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-all duration-200 ${activeFlowId === flow.id
                                        ? 'bg-white/[0.08] text-foreground font-medium shadow-sm border border-white/[0.05]'
                                        : 'text-foreground/60 hover:text-foreground/90 hover:bg-white/[0.04]'
                                        }`}
                                >
                                    <span className={`flex-shrink-0 transition-colors duration-200 ${activeFlowId === flow.id
                                        ? FLOW_TYPE_COLORS[flow.type] || 'text-primary'
                                        : 'text-foreground/40 group-hover/item:text-foreground/60'
                                        }`}>
                                        <FlowIcon type={flow.type} />
                                    </span>
                                    <span className="block truncate text-[13px] flex-1">{flow.title}</span>
                                </button>
                            )}

                            {editingFlowId !== flow.id && (
                                <div className="absolute right-1.5 hidden group-hover/item:flex gap-0.5 bg-background/80 backdrop-blur-md border border-white/8 rounded-lg p-0.5 shadow-lg opacity-0 group-hover/item:opacity-100 transition-all duration-150">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); startEditing(flow); }}
                                        className="p-1 hover:bg-white/10 rounded-md transition-colors text-foreground/40 hover:text-foreground/80"
                                        title="Rename"
                                    >
                                        <Pencil className="w-3 h-3" strokeWidth={1.5} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); if (confirm('Delete this flow?')) deleteFlow(flow.id); }}
                                        className="p-1 hover:bg-red-500/10 hover:text-red-400 rounded-md transition-colors text-foreground/40"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* ── BOTTOM ACTIONS ── */}
                <div className="px-3 pb-3 pt-2 space-y-2 flex flex-col items-stretch shrink-0 relative z-10">
                    <div className="h-px mx-1 mb-2 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />

                    <button
                        onClick={() => { handleCreateFlow(); playSound('success', -0.5); }}
                        onMouseEnter={() => playSound('hover', -0.5)}
                        className="w-full flex items-center justify-start gap-3 h-10 px-3 rounded-xl text-[13px] font-medium transition-all duration-200 text-foreground/60 hover:text-foreground/90 hover:bg-white/[0.04]"
                    >
                        <Plus className="w-4 h-4" strokeWidth={1.5} />
                        <span>New Space</span>
                    </button>

                    <div className="flex gap-1.5 pt-1">
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="flex-1 flex items-center justify-center h-8 rounded-lg hover:bg-white/[0.06] text-foreground/40 hover:text-foreground/70 transition-all duration-150"
                            title="Settings"
                        >
                            <SettingsIcon className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                        <button
                            onClick={async () => {
                                if (confirm('Clear all browsing data? This will reset the app.')) {
                                    try {
                                        clearHistory();
                                        localStorage.removeItem('continuum-welcome-seen');
                                        localStorage.clear();
                                        window.location.reload();
                                    } catch (e) { console.error('Failed to clear data:', e); }
                                }
                            }}
                            className="flex-1 flex items-center justify-center h-8 rounded-lg hover:bg-red-500/10 text-foreground/40 hover:text-red-400/80 transition-all duration-150"
                            title="Clear browsing data"
                        >
                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                    </div>
                </div>

                <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            </div>
        </ErrorBoundary>
    );
}

export default Sidebar;
