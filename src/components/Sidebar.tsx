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
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    const { flows, activeFlowId, activePageId, createFlow, setActiveFlow, setActivePage, renameFlow, clearHistory } = useFlowStore();
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

    const activeFlow = flows.find((flow) => flow.id === activeFlowId);
    const activePage = activeFlow?.pages.find((page) => page.id === activePageId);
    const currentTabLabel = (() => {
        if (activePage?.title?.trim()) return activePage.title.trim();
        if (activePage?.url) {
            try { return new URL(activePage.url).hostname.replace(/^www\./, ''); } catch { return activePage.url; }
        }
        if (activeFlow?.title?.trim()) return activeFlow.title.trim();
        return 'New Tab';
    })();

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
                    <div className="h-9 w-full flex items-center justify-end px-3 shrink-0">
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

                    {/* ── APP LAUNCHER ── */}
                    <div className="dia-launcher-grid px-2.5 pb-3 flex flex-col gap-0.5 items-stretch">
                        {DIA_LAUNCHER_APPS.map((app) => (
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
                                className={`dia-launcher-item group/app flex items-center gap-3 px-3 h-9 w-full rounded-xl transition-all duration-200 ${app.hoverBg}`}
                                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                                title={app.label}
                            >
                                <app.icon
                                    className={`w-4 h-4 flex-shrink-0 transition-all duration-200 text-foreground/50 group-hover/app:${app.color} group-hover/app:scale-110`}
                                    strokeWidth={1.5}
                                />
                                <span className="block text-sm font-medium text-foreground/60 group-hover/app:text-foreground/90 whitespace-nowrap overflow-hidden transition-colors duration-200">
                                    {app.label}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* ── CURRENT TAB ── */}
                    <div className="dia-tab-strip px-2.5 pb-3 space-y-1 flex flex-col items-stretch" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                        <button
                            onClick={() => {
                                if (activeFlowId && activePageId) { setActiveFlow(activeFlowId); setActivePage(activePageId); }
                                playSound('click', -0.85);
                            }}
                            className="sidebar-tab-current group/tab w-full h-9 px-3 rounded-xl flex items-center justify-start gap-2.5 text-left transition-all duration-200 hover:bg-white/5"
                            title={currentTabLabel}
                        >
                            <span className="w-5 h-5 rounded-md bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                                <Globe className="w-3 h-3 text-foreground/50" strokeWidth={1.8} />
                            </span>
                            <span className="block truncate text-sm text-foreground/70 group-hover/tab:text-foreground/90 transition-colors">{currentTabLabel}</span>
                        </button>
                        <button
                            onClick={() => { setActivePage(null); playSound('click', -0.85); }}
                            className="w-full h-8 px-3 rounded-lg flex items-center justify-start gap-2.5 text-left text-xs transition-all duration-150 hover:bg-white/[0.04]"
                            title="New Tab"
                        >
                            <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                <Plus className="w-3 h-3 text-foreground/35" strokeWidth={1.8} />
                            </span>
                            <span className="block text-foreground/40 text-xs">New Tab</span>
                        </button>
                    </div>
                </div>

                {/* ── FLOW LIST ── */}
                <div className="flex-1 overflow-y-auto py-2 px-2.5 space-y-0.5 flex flex-col items-stretch scrollbar-hide relative z-10">
                    <div className="text-[9px] font-bold text-foreground/30 px-3 py-2 uppercase tracking-[0.12em] flex justify-between items-center h-7">
                        <span>{t('sidebar.workspaces')}</span>
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
                                    className={`relative w-full text-left pl-3 pr-2 py-2 rounded-xl flex items-center gap-2.5 transition-all duration-200 ${activeFlowId === flow.id
                                        ? 'sidebar-flow-active text-foreground font-medium'
                                        : 'text-foreground/55 hover:text-foreground/85 hover:bg-white/[0.04] hover:translate-x-[1px]'
                                        }`}
                                >
                                    {/* Active indicator bar */}
                                    {activeFlowId === flow.id && (
                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
                                    )}
                                    <span className={`flex-shrink-0 transition-colors duration-200 ${activeFlowId === flow.id
                                        ? FLOW_TYPE_COLORS[flow.type] || 'text-primary'
                                        : 'text-foreground/35 group-hover/item:text-foreground/60'
                                        }`}>
                                        <FlowIcon type={flow.type} />
                                    </span>
                                    <span className="block truncate text-sm flex-1">{flow.title}</span>
                                    {flow.pages.length > 0 && (
                                        <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-semibold tracking-wide transition-all duration-200 ${activeFlowId === flow.id
                                            ? 'bg-primary/15 text-primary/80'
                                            : 'bg-white/[0.06] text-foreground/30 group-hover/item:bg-white/[0.08] group-hover/item:text-foreground/50'
                                            }`}>{flow.pages.length}</span>
                                    )}
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
                                        onClick={(e) => { e.stopPropagation(); if (confirm('Delete this flow?')) useFlowStore.getState().deleteFlow(flow.id); }}
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
                <div className="px-2.5 pb-3 pt-2 space-y-2 flex flex-col items-stretch shrink-0 relative z-10">
                    {/* Separator */}
                    <div className="h-px mx-1 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />

                    {/* New Workspace */}
                    <button
                        onClick={() => { handleCreateFlow(); playSound('success', -0.5); }}
                        onMouseEnter={() => playSound('hover', -0.5)}
                        className="sidebar-new-workspace-btn relative w-full flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-medium overflow-hidden transition-all duration-200 group/new"
                    >
                        <div className="absolute inset-0 bg-primary/10 group-hover/new:bg-primary/16 transition-colors duration-200" />
                        <div className="absolute inset-0 rounded-xl border border-primary/20 group-hover/new:border-primary/35 transition-colors duration-200" />
                        <Plus className="w-3.5 h-3.5 text-primary relative z-10" strokeWidth={2} />
                        <span className="text-primary relative z-10">{t('sidebar.newWorkspace')}</span>
                    </button>

                    {/* Settings glass card */}
                    <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="flex-1 flex items-center justify-center gap-1.5 hover:bg-white/[0.06] text-foreground/40 hover:text-foreground/70 h-7 rounded-lg text-xs font-medium transition-all duration-150"
                        >
                            <SettingsIcon className="w-3 h-3" strokeWidth={1.5} />
                            <span>Settings</span>
                        </button>
                        <div className="w-px bg-white/[0.07] my-1" />
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
                            className="flex-1 flex items-center justify-center gap-1.5 hover:bg-red-500/8 text-foreground/40 hover:text-red-400/80 h-7 rounded-lg text-xs font-medium transition-all duration-150"
                            title="Clear browsing data"
                        >
                            <Trash2 className="w-3 h-3" strokeWidth={1.5} />
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
