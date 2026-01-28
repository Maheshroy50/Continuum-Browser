import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import Markdown from 'react-markdown';
import { useFlowStore } from '../store/useFlowStore';
import { usePreferencesStore } from '../store/usePreferencesStore';
import { useTranslation } from 'react-i18next';

// Persist expanded state per Flow in localStorage
const NOTES_STATE_KEY = 'flow-notes-expanded';

function getExpandedState(flowId: string): boolean {
    try {
        const stored = localStorage.getItem(NOTES_STATE_KEY);
        if (stored) {
            const states = JSON.parse(stored);
            return states[flowId] !== false; // Default to true (expanded)
        }
    } catch { }
    return true; // Default expanded
}

function setExpandedState(flowId: string, expanded: boolean) {
    try {
        const stored = localStorage.getItem(NOTES_STATE_KEY);
        const states = stored ? JSON.parse(stored) : {};
        states[flowId] = expanded;
        localStorage.setItem(NOTES_STATE_KEY, JSON.stringify(states));
    } catch { }
}

function NotesPanel() {
    const { t } = useTranslation();
    const autoSaveNotes = usePreferencesStore(state => state.autoSaveNotes);
    const activeFlowId = useFlowStore(state => state.activeFlowId);
    const activeFlow = useFlowStore(state =>
        state.flows.find(f => f.id === state.activeFlowId)
    );
    const updateFlowNotes = useFlowStore(state => state.updateFlowNotes);
    const updateNotesTitle = useFlowStore(state => state.updateNotesTitle);

    const [localNotes, setLocalNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const [isPreview, setIsPreview] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);

    // Load expanded state when flow changes
    useEffect(() => {
        if (activeFlowId) {
            setIsExpanded(getExpandedState(activeFlowId));
        }
    }, [activeFlowId]);

    // Sync local notes when flow changes
    useEffect(() => {
        if (activeFlow) {
            setLocalNotes(activeFlow.notes || '');
        } else {
            setLocalNotes('');
        }
    }, [activeFlow?.id, activeFlow?.notes]);

    // Focus title input when editing starts
    useEffect(() => {
        if (isEditingTitle && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [isEditingTitle]);

    // Toggle expanded and persist
    const toggleExpanded = useCallback(() => {
        if (!activeFlowId) return;
        const newExpanded = !isExpanded;
        setIsExpanded(newExpanded);
        setExpandedState(activeFlowId, newExpanded);
    }, [activeFlowId, isExpanded]);

    // Start editing title
    const startEditingTitle = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (!activeFlow) return;
        setEditTitle(activeFlow.notesTitle || 'Notes');
        setIsEditingTitle(true);
    }, [activeFlow]);

    // Save title
    const saveTitle = useCallback(() => {
        if (!activeFlowId) return;
        const trimmed = editTitle.trim();
        if (trimmed && trimmed !== 'Notes') {
            updateNotesTitle(activeFlowId, trimmed);
        } else {
            // Reset to default if empty or "Notes"
            updateNotesTitle(activeFlowId, '');
        }
        setIsEditingTitle(false);
    }, [activeFlowId, editTitle, updateNotesTitle]);

    // Handle title key events
    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveTitle();
        } else if (e.key === 'Escape') {
            setIsEditingTitle(false);
        }
    };

    // Debounced save
    const saveNotes = useCallback((notes: string) => {
        if (!activeFlowId) return;

        setIsSaving(true);
        updateFlowNotes(activeFlowId, notes);

        // Show saving indicator briefly
        setTimeout(() => setIsSaving(false), 500);
    }, [activeFlowId, updateFlowNotes]);

    const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newNotes = e.target.value;
        setLocalNotes(newNotes);

        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Debounce: save after 800ms of no typing IF auto-save is enabled
        if (autoSaveNotes) {
            saveTimeoutRef.current = setTimeout(() => {
                saveNotes(newNotes);
            }, 800);
        }
    };

    // Save on blur immediately
    const handleBlur = () => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        if (activeFlowId && localNotes !== activeFlow?.notes) {
            saveNotes(localNotes);
        }
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    // Stats
    const wordCount = localNotes.trim() ? localNotes.trim().split(/\s+/).length : 0;
    const charCount = localNotes.length;
    const isEmpty = localNotes.trim().length === 0;
    const displayTitle = activeFlow?.notesTitle || 'Notes';

    if (!activeFlow) {
        return (
            <div className="w-80 bg-background border-l border-border flex flex-col h-full">
                <div className="h-14 flex items-center px-4 border-b border-border/50">
                    <div className="flex items-center space-x-2 text-muted-foreground">
                        <FileText className="w-4 h-4" />
                        <span className="font-medium text-sm">{t('notes.title')}</span>
                    </div>
                </div>
                <div className="flex-1 p-6 flex flex-col items-center justify-center text-center text-muted-foreground/50">
                    <p className="text-sm">{t('notes.selectWorkspace')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-80 bg-background border-l border-border flex flex-col h-full">
            {/* Header - clickable to toggle */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-border/50">
                <div className="flex items-center space-x-2 text-muted-foreground flex-1 min-w-0">
                    <button
                        onClick={toggleExpanded}
                        className="flex items-center space-x-2 hover:text-foreground transition-colors"
                    >
                        {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                        ) : (
                            <ChevronRight className="w-4 h-4" />
                        )}
                        <FileText className="w-4 h-4" />
                    </button>

                    {isEditingTitle ? (
                        <input
                            ref={titleInputRef}
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={saveTitle}
                            onKeyDown={handleTitleKeyDown}
                            className="flex-1 bg-muted/50 text-foreground text-sm font-medium px-2 py-1 rounded outline-none border border-border focus:border-blue-500"
                        />
                    ) : (
                        <span
                            onClick={startEditingTitle}
                            className="font-medium text-sm cursor-pointer hover:text-foreground truncate"
                            title="Double-click to rename"
                        >
                            {displayTitle}
                        </span>
                    )}

                    {!isEditingTitle && (
                        <button
                            onClick={startEditingTitle}
                            className="opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
                            title="Rename notes"
                        >
                            <Pencil className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {isSaving && (
                    <span className="text-xs text-green-400 ml-2">Saving...</span>
                )}
            </div>

            {isExpanded && (
                <>
                    {/* Notes Editor */}
                    <div className="flex-1 p-4 flex flex-col min-h-0 relative group/editor">
                        {/* View Mode Toggle (Overlay) */}
                        <div className="absolute top-2 right-6 z-10 opacity-0 group-hover/editor:opacity-100 transition-opacity">
                            <button
                                onClick={() => setIsPreview(!isPreview)}
                                className="text-xs bg-muted/80 backdrop-blur px-2 py-1 rounded border border-border/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                            >
                                {isPreview ? 'Edit' : 'Preview'}
                            </button>
                        </div>

                        {isPreview ? (
                            <div className="flex-1 w-full overflow-y-auto prose dark:prose-invert prose-sm max-w-none p-2">
                                <Markdown>{localNotes}</Markdown>
                            </div>
                        ) : (
                            <textarea
                                value={localNotes}
                                onChange={handleNotesChange}
                                onBlur={handleBlur}
                                placeholder=""
                                className="flex-1 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 resize-none outline-none leading-relaxed font-mono"
                                style={{ minHeight: '200px' }}
                            />
                        )}

                        {/* Empty state - shown when notes are empty */}
                        {isEmpty && !isPreview && (
                            <div className="absolute inset-4 flex flex-col items-center justify-center text-center pointer-events-none">
                                <p className="text-sm text-muted-foreground/50 max-w-[220px] leading-relaxed">
                                    {t('notes.emptyHint')}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer - stats moved to bottom-right, subtle */}
                    <div className="px-4 py-3 border-t border-border/30 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground/40">
                            {t('notes.markdown')}
                        </span>
                        <span className="text-xs text-muted-foreground/30">
                            {wordCount} {t('notes.words')} · {charCount} {t('notes.chars')}
                        </span>
                    </div>
                </>
            )
            }

            {/* Collapsed state hint */}
            {
                !isExpanded && (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground/30 text-xs">
                        Click to expand
                    </div>
                )
            }
        </div >
    );
}

export default NotesPanel;
