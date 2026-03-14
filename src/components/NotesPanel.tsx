import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, ChevronDown, Pencil } from 'lucide-react';
import Markdown from 'react-markdown';
import { useFlowStore } from '../store/useFlowStore';
import { usePreferencesStore } from '../store/usePreferencesStore';
import { useTranslation } from 'react-i18next';



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
    const [isPreview, setIsPreview] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);



    // Sync local notes when flow changes
    useEffect(() => {
        if (activeFlow) {
            setLocalNotes(activeFlow.notes || '');
        } else {
            setLocalNotes('');
        }
    }, [activeFlow?.id, activeFlow?.notes, activeFlow]);

    // Focus title input when editing starts
    useEffect(() => {
        if (isEditingTitle && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [isEditingTitle]);



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

        if (savedTimeoutRef.current) {
            clearTimeout(savedTimeoutRef.current);
        }
        savedTimeoutRef.current = setTimeout(() => { }, 1500);
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
            if (savedTimeoutRef.current) {
                clearTimeout(savedTimeoutRef.current);
            }
        };
    }, []);

    // Stats
    const wordCount = localNotes.trim() ? localNotes.trim().split(/\s+/).length : 0;
    const charCount = localNotes.length;
    const displayTitle = typeof activeFlow?.notesTitle === 'string' ? activeFlow.notesTitle : String(activeFlow?.notesTitle || 'Notes');

    if (!activeFlow) {
        return (
            <div className="notes-panel w-80 flex flex-col h-full"
                style={{
                    backdropFilter: 'blur(22px)',
                    WebkitBackdropFilter: 'blur(22px)',
                }}
            >
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
        <div className={`notes-panel notes-panel-glass transition-all duration-300 ease-[var(--ease-continuum)] flex flex-col h-full group bg-transparent border-l border-white/10 w-[300px]`}
        >
            <>
                {/* Header - clickable to toggle */}
                <div className="h-14 flex items-center justify-between px-4 border-b border-white/5 shrink-0">
                    <div className="flex items-center space-x-2 text-muted-foreground flex-1 min-w-0">
                        <ChevronDown className="w-4 h-4" />
                        <FileText className="w-4 h-4" />

                        {isEditingTitle ? (
                            <input
                                ref={titleInputRef}
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onBlur={saveTitle}
                                onKeyDown={handleTitleKeyDown}
                                className="flex-1 bg-white/5 text-foreground text-sm font-medium px-2 py-1 rounded outline-none border border-transparent focus:border-white/10"
                            />
                        ) : (
                            <span
                                onClick={startEditingTitle}
                                className="font-medium text-sm cursor-pointer hover:text-foreground truncate py-1"
                                title="Double-click to rename"
                            >
                                {typeof displayTitle === 'string' ? displayTitle : String(displayTitle)}
                            </span>
                        )}

                        {!isEditingTitle && (
                            <button
                                onClick={startEditingTitle}
                                className="opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity p-1"
                            >
                                <Pencil className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {isSaving && (
                        <span className="text-[10px] text-green-400 font-medium">SAVING</span>
                    )}
                </div>

                {/* Notes Editor */}
                <div className="flex-1 p-4 flex flex-col min-h-0 relative group/editor">
                    {/* View Mode Toggle (Overlay) */}
                    <div className="absolute top-2 right-6 z-10 opacity-0 group-hover/editor:opacity-100 transition-opacity">
                        <button
                            onClick={() => setIsPreview(!isPreview)}
                            className="text-[10px] bg-black/40 backdrop-blur px-2 py-1 rounded border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            {isPreview ? 'Edit' : 'Preview'}
                        </button>
                    </div>

                    {isPreview ? (
                        <div className="flex-1 w-full overflow-y-auto prose dark:prose-invert prose-sm max-w-none p-2 custom-scrollbar">
                            <Markdown>{localNotes}</Markdown>
                        </div>
                    ) : (
                        <textarea
                            value={localNotes}
                            onChange={handleNotesChange}
                            onBlur={handleBlur}
                            placeholder="Start typing..."
                            className="flex-1 w-full bg-transparent text-sm text-foreground/90 placeholder:text-muted-foreground/30 resize-none outline-none leading-relaxed font-mono custom-scrollbar"
                            spellCheck={false}
                        />
                    )}
                </div>

                {/* Footer - stats */}
                <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between shrink-0">
                    <span className="text-[10px] text-muted-foreground/30 font-mono">
                        {wordCount} w · {charCount} c
                    </span>
                </div>
            </>
        </div>
    );
}

export default NotesPanel;
