import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Search, FileText, ChevronRight, Maximize2, Minimize2, Trash, Plus, Sun, Moon, Edit3, XCircle, Layout } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '../store/useFlowStore';
import { useTheme } from '../hooks/useTheme';

// ============================================
// TYPES
// ============================================

interface FlowItem {
    id: string;
    title: string;
    pageCount: number;
    hasResume: boolean;
    isActive: boolean;
    updatedAt: number;
    lastActivePageTitle?: string;
    lastActivePageFavicon?: string;
}

// Helper for relative time
function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (diff < 60000) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

interface CommandItem {
    id: string;
    title: string;
    icon: any;
    action: () => void;
    shortcut?: string;
    type: 'command';
}

type PaletteItem = (FlowItem & { type: 'flow' }) | CommandItem;

// ============================================
// PURE UI COMPONENTS (Memoized)
// ============================================

interface FlowRowProps {
    flow: FlowItem;
    isSelected: boolean;
    onClick: () => void;
}

const FlowRow = memo(function FlowRow({ flow, isSelected, onClick }: FlowRowProps) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center px-4 py-3 transition-colors ${isSelected
                ? 'bg-blue-500/20 text-white'
                : 'text-neutral-300 hover:bg-neutral-800'
                }`}
        >
            <FileText className={`w-5 h-5 mr-3 ${flow.isActive ? 'text-blue-400' : 'text-neutral-500'}`} />
            <div className="flex-1 text-left">
                <div className="font-medium flex items-center">
                    {flow.title}
                    {flow.isActive && (
                        <span className="ml-2 text-xs text-blue-400">(current)</span>
                    )}
                </div>
                <div className="text-xs text-neutral-500 flex items-center gap-2">
                    <span>{flow.pageCount} page{flow.pageCount !== 1 ? 's' : ''}</span>

                    {flow.lastActivePageTitle && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-neutral-600" />
                            <span className="truncate max-w-[150px] text-neutral-400">
                                {flow.lastActivePageTitle}
                            </span>
                        </>
                    )}

                    {flow.updatedAt > 0 && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-neutral-600" />
                            <span>{formatRelativeTime(flow.updatedAt)}</span>
                        </>
                    )}
                </div>
            </div>
            <span className="text-xs text-neutral-600 uppercase tracking-wider">Flow</span>
            <ChevronRight className={`w-4 h-4 ml-3 ${isSelected ? 'text-blue-400' : 'text-neutral-600'}`} />
        </button>
    );
});

const CommandRow = memo(function CommandRow({ command, isSelected, onClick }: { command: CommandItem; isSelected: boolean; onClick: () => void }) {
    const Icon = command.icon;
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center px-4 py-3 transition-colors ${isSelected
                ? 'bg-purple-500/20 text-white'
                : 'text-neutral-300 hover:bg-neutral-800'
                }`}
        >
            <Icon className="w-5 h-5 mr-3 text-purple-400" />
            <div className="flex-1 text-left font-medium">
                {command.title}
            </div>
            {command.shortcut && (
                <kbd className="text-xs bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-400">{command.shortcut}</kbd>
            )}
        </button>
    );
});

const KeyboardHints = memo(function KeyboardHints() {
    return (
        <div className="px-4 py-2 border-t border-neutral-700 text-xs text-neutral-500 flex items-center justify-between">
            <span>
                <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded mr-1">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded mr-2">↓</kbd>
                to navigate
            </span>
            <span>
                <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded mr-1">↵</kbd>
                to switch
            </span>
        </div>
    );
});



// ============================================
// MAIN COMPONENT (Unified Palette)
// ============================================

interface FlowSwitcherProps {
    isOpen: boolean;
    onClose: () => void;
    items: PaletteItem[];
    onSelect: (item: PaletteItem) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    t: (key: string) => string;
}

export const FlowSwitcher = memo(function FlowSwitcher({
    isOpen,
    onClose,
    items,
    onSelect,
    searchQuery,
    onSearchChange,
    t
}: FlowSwitcherProps) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset selection when items change
    useEffect(() => {
        setSelectedIndex(0);
    }, [items]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            onSearchChange('');
            setSelectedIndex(0);
            const timer = setTimeout(() => inputRef.current?.focus(), 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen, onSearchChange]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < items.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
                break;
            case 'Enter':
                e.preventDefault();
                const selected = items[selectedIndex];
                if (selected) {
                    onSelect(selected);
                    onClose();
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [items, selectedIndex, onSelect, onClose]);

    // Handle input change
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onSearchChange(e.target.value);
    }, [onSearchChange]);

    // Handle row click
    const handleRowClick = useCallback((index: number) => {
        setSelectedIndex(index);
    }, []);

    // Handle row double-click
    const handleRowDoubleClick = useCallback((item: PaletteItem) => {
        onSelect(item);
        onClose();
    }, [onSelect, onClose]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/70 z-[100]"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-[101]">
                <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl overflow-hidden">
                    {/* Search Input */}
                    <div className="flex items-center px-4 py-3 border-b border-neutral-700">
                        <Search className="w-5 h-5 text-neutral-500 mr-3" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={t('switcher.placeholder')}
                            className="flex-1 bg-transparent text-white text-lg outline-none placeholder:text-neutral-500"
                        />
                        <kbd className="px-2 py-1 text-xs bg-neutral-800 text-neutral-400 rounded">
                            esc
                        </kbd>
                    </div>

                    {/* List */}
                    <div className="max-h-80 overflow-y-auto py-2">
                        {items.length === 0 ? (
                            <div className="px-4 py-8 text-center text-neutral-500">
                                {t('switcher.noResults')}
                            </div>
                        ) : (
                            items.map((item, index) => (
                                <div
                                    key={item.id}
                                    onDoubleClick={() => handleRowDoubleClick(item)}
                                >
                                    {item.type === 'flow' ? (
                                        <FlowRow
                                            flow={item}
                                            isSelected={index === selectedIndex}
                                            onClick={() => handleRowClick(index)}
                                        />
                                    ) : (
                                        <CommandRow
                                            command={item}
                                            isSelected={index === selectedIndex}
                                            onClick={() => handleRowClick(index)}
                                        />
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    <KeyboardHints />
                </div>
            </div>
        </>
    );
});

// ============================================
// CONTAINER
// ============================================

export function FlowSwitcherContainer({
    isOpen,
    onClose
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    // Local State for Input
    const [searchQuery, setSearchQuery] = useState('');

    // Store Actions
    const flows = useFlowStore(state => state.flows);
    const activeFlowId = useFlowStore(state => state.activeFlowId);
    const setActiveFlow = useFlowStore(state => state.setActiveFlow);
    const clearHistory = useFlowStore(state => state.clearHistory);
    const createFlow = useFlowStore(state => state.createFlow);
    const appendToNotes = useFlowStore(state => state.appendToNotes);
    const isZenMode = useFlowStore(state => state.isZenMode);
    const setZenMode = useFlowStore(state => state.setZenMode);
    const templates = useFlowStore(state => state.templates);
    const createFlowFromTemplate = useFlowStore(state => state.createFlowFromTemplate);
    const deleteTemplate = useFlowStore(state => state.deleteTemplate);

    // Theme
    const { theme, toggleTheme } = useTheme();

    // Prepare Items based on Search Query
    const items: PaletteItem[] = useMemo(() => {
        const query = searchQuery.toLowerCase();

        // 1. COMMAND MODE DETECTED
        if (query.startsWith('/')) {
            const commandText = query.slice(1).trim(); // "note hello"
            const [cmd, ...args] = commandText.split(' ');
            const argText = args.join(' ');

            // Dynamic Commands based on input
            const dynamicCommands: PaletteItem[] = [];

            // /note
            if ('note'.startsWith(cmd)) {
                dynamicCommands.push({
                    type: 'command',
                    id: 'cmd-note',
                    title: argText ? `Add to Notes: "${argText}"` : 'Type /note [text] to add to notes...',
                    icon: Edit3,
                    action: () => {
                        if (argText && activeFlowId) {
                            appendToNotes(activeFlowId, argText + '\n');
                            // visual feedback handled by toast eventually
                        }
                    },
                    shortcut: 'Enter'
                });
            }

            // /theme
            if ('theme'.startsWith(cmd)) {
                dynamicCommands.push({
                    type: 'command',
                    id: 'cmd-theme',
                    title: `Switch Theme to ${theme === 'dark' ? 'Light' : 'Dark'}`,
                    icon: theme === 'dark' ? Sun : Moon,
                    action: () => toggleTheme(),
                });
            }

            // /clear
            if ('clear'.startsWith(cmd)) {
                dynamicCommands.push({
                    type: 'command',
                    id: 'cmd-clear',
                    title: 'Clear All History & Data',
                    icon: Trash,
                    action: async () => {
                        if (confirm('Are you sure you want to clear all history?')) {
                            clearHistory();
                        }
                    },
                });
            }

            // /delete-template
            if ('delete-template'.startsWith(cmd)) {
                if (argText) {
                    // Filter templates by name
                    const matches = templates.filter(t => t.name.toLowerCase().includes(argText.toLowerCase()));
                    matches.forEach(t => {
                        dynamicCommands.push({
                            type: 'command',
                            id: `cmd-del-template-${t.id}`,
                            title: `Delete Template: ${t.name}`,
                            icon: Trash,
                            action: () => {
                                if (confirm(`Delete template "${t.name}"?`)) {
                                    deleteTemplate(t.id);
                                }
                            }
                        });
                    });
                } else {
                    // List all templates to delete
                    templates.forEach(t => {
                        dynamicCommands.push({
                            type: 'command',
                            id: `cmd-del-template-${t.id}`,
                            title: `Delete Template: ${t.name}`,
                            icon: Trash,
                            action: () => {
                                if (confirm(`Delete template "${t.name}"?`)) {
                                    deleteTemplate(t.id);
                                }
                            }
                        });
                    });
                    if (templates.length === 0) {
                        dynamicCommands.push({
                            type: 'command',
                            id: 'no-templates',
                            title: 'No templates to delete',
                            icon: XCircle,
                            action: () => { }
                        });
                    }
                }
            }

            return dynamicCommands.length > 0 ? dynamicCommands : [
                {
                    type: 'command',
                    id: 'cmd-unknown',
                    title: 'Unknown command',
                    icon: XCircle,
                    action: () => { },
                }
            ];
        }

        // 2. NORMAL MODE (Flows + Basic Commands)
        const flowItems: PaletteItem[] = flows
            .filter(f => f.title.toLowerCase().includes(query))
            .map(flow => {
                const lastPage = flow.lastActivePageId ? flow.pages.find(p => p.id === flow.lastActivePageId) : null;
                return {
                    type: 'flow' as const,
                    id: flow.id,
                    title: flow.title,
                    pageCount: flow.pages.length,
                    hasResume: !!flow.lastActivePageId,
                    isActive: flow.id === activeFlowId,
                    updatedAt: flow.updatedAt,
                    lastActivePageTitle: lastPage?.title || lastPage?.url,
                    lastActivePageFavicon: lastPage?.favicon
                };
            });

        const staticCommands: PaletteItem[] = [
            {
                type: 'command' as const,
                id: 'cmd-new-flow',
                title: 'New Workspace',
                icon: Plus,
                action: () => createFlow('New Workspace', 'Browse'),
            },
            {
                type: 'command' as const,
                id: 'cmd-zen',
                title: isZenMode ? 'Exit Zen Mode' : 'Enter Zen Mode',
                icon: isZenMode ? Minimize2 : Maximize2,
                action: () => setZenMode(!isZenMode),
            }
        ].filter(c => c.title.toLowerCase().includes(query));

        // 3. TEMPLATES
        const templateItems: PaletteItem[] = templates
            .filter(t => t.name.toLowerCase().includes(query))
            .map(t => ({
                type: 'command' as const,
                id: `template-${t.id}`,
                title: `Template: ${t.name}`,
                icon: Layout,
                action: () => createFlowFromTemplate(t.id),
            }));

        return [...staticCommands, ...templateItems, ...flowItems];

    }, [flows, activeFlowId, isZenMode, theme, setZenMode, createFlow, toggleTheme, clearHistory, appendToNotes, searchQuery, templates, createFlowFromTemplate, deleteTemplate]);

    const handleSelect = useCallback((item: PaletteItem) => {
        if (item.type === 'flow') {
            setActiveFlow(item.id);
        } else {
            item.action();
        }
    }, [setActiveFlow]);

    const { t } = useTranslation();

    return (
        <FlowSwitcher
            isOpen={isOpen}
            onClose={onClose}
            items={items}
            onSelect={handleSelect}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            t={t}
        />
    );
}

export default FlowSwitcherContainer;
