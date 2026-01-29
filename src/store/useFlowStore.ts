import { create } from 'zustand';
// import { invoke } from '@tauri-apps/api/core';
import { AppState, Flow, Page, HistoryItem, FlowTemplate } from '../shared/types';

interface ExtendedAppState extends AppState {
    activePageId: string | null;
}

// Define the interface for the store actions
interface FlowStore extends ExtendedAppState {
    createFlow: (title: string, type: Flow['type']) => void;
    setActiveFlow: (flowId: string) => void;
    setActivePage: (pageId: string | null) => void;
    addPageToFlow: (flowId: string, page: Page) => void;
    updatePage: (flowId: string, pageId: string, updates: Partial<Page>) => void;
    removePage: (flowId: string, pageId: string) => void;
    updatePageUrl: (flowId: string, pageId: string, url: string) => void;
    updatePageTitle: (flowId: string, pageId: string, title: string) => void;
    addToHistory: (url: string, title: string, flowId: string, pageId: string) => void;
    deleteFlow: (flowId: string) => void;
    renameFlow: (flowId: string, newTitle: string) => void;
    updateFlowNotes: (flowId: string, notes: string) => void;
    appendToNotes: (flowId: string, text: string) => void;
    updateNotesTitle: (flowId: string, title: string) => void;
    loadState: () => Promise<void>;
    toggleHistory: () => Promise<void>;
    isHistoryOpen: boolean;
    historyOverlaySnapshot: string | null;

    // Reader Mode
    isReaderMode: boolean;
    setReaderMode: (enabled: boolean) => void;

    // Split View
    splitView: {
        isOpen: boolean;
        activePageId: null | string; // Primary (Left)
        secondaryPageId: null | string; // Secondary (Right)
    };
    enableSplitView: (secondaryPageId?: string) => void;
    disableSplitView: () => void;
    setSplitSecondaryInfo: (pageId: string) => void;

    // Bookmarks
    addBookmark: (url: string, title: string, favicon?: string) => void;
    removeBookmark: (url: string) => void;
    isBookmarked: (url: string) => boolean;
    clearHistory: () => void;
    // Page State
    savePageState: (flowId: string, pageId: string) => Promise<void>;
    restorePageState: (flowId: string, pageId: string) => Promise<void>;
    isZenMode: boolean;
    setZenMode: (enabled: boolean) => void;

    // Templates
    templates: FlowTemplate[];
    saveFlowAsTemplate: (flowId: string, name: string) => void;
    createFlowFromTemplate: (templateId: string) => void;
    deleteTemplate: (templateId: string) => void;

    // Initialization
    isInitialized: boolean;
    setInitialized: (val: boolean) => void;

    // View Management
    ensureViewSelected: () => void;
    captureCurrentPageState: () => Promise<void>;
}

// Debounced save function - reads state directly from store
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

const debouncedSaveToDisk = () => {
    // Clear any pending save
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    // Debounce: wait 300ms before saving to batch rapid updates
    saveTimeout = setTimeout(async () => {
        try {
            const state = useFlowStore.getState();

            // Don't save before initialization
            if (!state.isInitialized) {
                console.warn('[Store] Blocked save - not initialized');
                return;
            }

            const { flows, activeFlowId, history, bookmarks, templates } = state;

            // Debug log
            const pageCounts = flows.map(f => `${f.title}: ${f.pages.length}`);
            console.log(`[Store] Auto-saving. Flows: ${flows.length}. Pages: [${pageCounts.join(', ')}]`);

            const data = { flows, activeFlowId, history, bookmarks, templates };
            const jsonStr = JSON.stringify(data, null, 2);

            // Save to localStorage
            localStorage.setItem('continuum-flows', jsonStr);

            // Save to file system
            if (window.ipcRenderer) {
                await window.ipcRenderer.invoke('save-file', 'flows.json', jsonStr);

                // Backup
                if (flows.length > 0) {
                    await window.ipcRenderer.invoke('save-file', 'flows.backup.json', jsonStr);
                }
            }

            console.log('[Store] Save complete');
        } catch (err) {
            console.error('[Store] Save failed:', err);
        }
    }, 300);
};

// Legacy function for backward compatibility - now just triggers debounced save
const saveStateToDisk = (_isInitialized: boolean) => {
    debouncedSaveToDisk();
};

// Forced save without debounce - used on app close
const saveStateToDiskForced = async () => {
    const state = useFlowStore.getState();
    const { flows, activeFlowId, history, bookmarks, templates } = state;

    console.log('[Store] Forced save before quit...');
    const data = { flows, activeFlowId, history, bookmarks, templates };
    const jsonStr = JSON.stringify(data, null, 2);

    localStorage.setItem('continuum-flows', jsonStr);

    if (window.ipcRenderer) {
        await window.ipcRenderer.invoke('save-file', 'flows.json', jsonStr);
        if (flows.length > 0) {
            await window.ipcRenderer.invoke('save-file', 'flows.backup.json', jsonStr);
        }
    }
    console.log('[Store] Forced save complete');
};

export const useFlowStore = create<FlowStore>((set, get) => ({
    isInitialized: false,
    setInitialized: (val) => set({ isInitialized: val }),

    flows: [],
    history: [],
    bookmarks: [],
    templates: [],
    historyOverlaySnapshot: null,
    activeFlowId: null,
    activePageId: null,
    isHistoryOpen: false,

    isReaderMode: false,
    setReaderMode: (enabled) => set({ isReaderMode: enabled }),

    splitView: { isOpen: false, activePageId: null, secondaryPageId: null },
    enableSplitView: (secondaryPageId) => set(state => ({
        splitView: {
            isOpen: true,
            activePageId: state.activePageId,
            secondaryPageId: secondaryPageId || null
        }
    })),
    disableSplitView: () => {
        const { splitView, activeFlowId } = get();
        if (splitView.secondaryPageId && activeFlowId) {
            // @ts-ignore
            window.ipcRenderer?.invoke('view:hide', activeFlowId, splitView.secondaryPageId);
        }
        set(state => ({
            splitView: { ...state.splitView, isOpen: false, secondaryPageId: null }
        }));
    },
    setSplitSecondaryInfo: (pageId) => set(state => ({
        splitView: { ...state.splitView, secondaryPageId: pageId }
    })),

    isZenMode: false,
    setZenMode: (enabled) => set({ isZenMode: enabled }),

    createFlow: (title, type) => {
        const newFlow: Flow = {
            id: crypto.randomUUID(),
            title,
            type,
            pages: [],
            notes: '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        set((state) => {
            const newFlows = [...state.flows, newFlow];
            saveStateToDisk(state.isInitialized); // Auto-save and set active
            return {
                flows: newFlows,
                activeFlowId: newFlow.id,
                activePageId: null
            };
        });
    },

    setActiveFlow: (flowId) => {
        const { flows } = get();
        const targetFlow = flows.find(f => f.id === flowId);

        // Hide the current BrowserView when switching flows
        if (window.ipcRenderer?.views) {
            window.ipcRenderer.views.select(flowId, null, null);
        }

        // Check if the target flow has a last active page to auto-resume
        const lastActivePageId = targetFlow?.lastActivePageId;
        const lastActivePage = lastActivePageId ? targetFlow?.pages.find(p => p.id === lastActivePageId) : null;

        if (lastActivePage) {
            // Auto-resume: set the last active page immediately
            set((state) => {
                saveStateToDisk(state.isInitialized);
                return { activeFlowId: flowId, activePageId: lastActivePageId };
            });

            // Load the page in BrowserView with state for scroll restoration
            if (window.ipcRenderer?.views) {
                console.log('[Store] setActiveFlow - passing state:', lastActivePage.state ? { scrollY: lastActivePage.state.scrollY, hasAnchor: !!lastActivePage.state.anchor } : 'NO STATE');
                window.ipcRenderer.views.select(flowId, lastActivePageId, lastActivePage.url, lastActivePage.state);
            }

            // Restore state after page loads (Not supported in Rust backend yet)
            // if (lastActivePage.state) {
            //     setTimeout(async () => {
            //         try {
            //             await window.ipcRenderer.views.restoreState(flowId, lastActivePageId, lastActivePage.state);
            //         } catch (e) {
            //             console.error('[Store] Failed to restore state on flow switch:', e);
            //         }
            //     }, 800);
            // }
        } else {
            // No last active page - show the grid
            set((state) => {
                saveStateToDisk(state.isInitialized);
                return { activeFlowId: flowId, activePageId: null };
            });
        }
    },

    setActivePage: async (pageId) => {
        const { activeFlowId, activePageId: currentPageId, flows, splitView, disableSplitView } = get();

        // Auto-close split view if returning to grid (All Tabs)
        if (!pageId && splitView?.isOpen) {
            disableSplitView();
        }

        // Capture state of current page before switching
        if (currentPageId && activeFlowId) {
            try {
                console.log('[Store] Capturing state for page:', currentPageId);
                const state = await window.ipcRenderer.views.captureState(activeFlowId, currentPageId);
                console.log('[Store] Captured state:', state ? { scrollY: state.scrollY, scrollRatio: state.scrollRatio?.toFixed(3), hasAnchor: !!state.anchor } : 'null');
                if (state) {
                    set((prev) => {
                        const newFlows = prev.flows.map(f =>
                            f.id === activeFlowId
                                ? { ...f, pages: f.pages.map(p => p.id === currentPageId ? { ...p, state } : p) }
                                : f
                        );
                        saveStateToDisk(prev.isInitialized);
                        return { flows: newFlows };
                    });
                }
            } catch (e) {
                console.error('[Store] Failed to capture page state:', e);
            }
        }

        // Save lastActivePageId to the current flow
        if (pageId && activeFlowId) {
            set((prev) => {
                const newFlows = prev.flows.map(f =>
                    f.id === activeFlowId ? { ...f, lastActivePageId: pageId, updatedAt: Date.now() } : f
                );
                saveStateToDisk(prev.isInitialized);
                return { flows: newFlows, activePageId: pageId };
            });
        } else {
            set({ activePageId: pageId });

            // If we are leaving the active page (e.g., showing grid/history), hide the BrowserView
            if (!pageId && window.ipcRenderer?.views) {
                // @ts-ignore
                window.ipcRenderer.views.hide();
            }
        }

        if (activeFlowId) {
            // Find the page URL and state for restoration
            const flow = flows.find(f => f.id === activeFlowId);
            const page = flow?.pages.find(p => p.id === pageId);
            const url = page?.url;
            const stateToRestore = page?.state;

            // Pass state directly to select - restoration happens in ViewManager on did-finish-load
            if (window.ipcRenderer?.views) {
                window.ipcRenderer.views.select(activeFlowId, pageId, url || undefined, stateToRestore);
            }
        }
    },

    addPageToFlow: (flowId, page) => {
        console.log(`[Store] addPageToFlow called. flowId: ${flowId}, page.id: ${page.id}`);

        set((state) => {
            // DEBUG: Check if flow exists
            const flowIds = state.flows.map(f => f.id);
            const flowExists = state.flows.some(f => f.id === flowId);
            console.log(`[Store] Existing flowIds: ${JSON.stringify(flowIds)}`);
            console.log(`[Store] Looking for: ${flowId}, Found: ${flowExists}`);

            if (!flowExists) {
                console.error(`[Store] ⚠️ FLOW NOT FOUND! Cannot add page to flowId: ${flowId}`);
            }

            const newFlows = state.flows.map(f =>
                f.id === flowId
                    ? { ...f, pages: [...f.pages, page], lastActivePageId: page.id, updatedAt: Date.now() }
                    : f
            );

            // Verify page was added
            const updatedFlow = newFlows.find(f => f.id === flowId);
            console.log(`[Store] After add - flow pages count: ${updatedFlow?.pages.length || 'FLOW NOT FOUND'}`);

            return { flows: newFlows, activePageId: page.id };
        });

        // Save AFTER set() completes
        const { isInitialized } = useFlowStore.getState();
        saveStateToDisk(isInitialized);

        // Create view and select it immediately
        if (window.ipcRenderer?.views) {
            window.ipcRenderer.views.create(flowId, page.id, page.url)
                .then(() => window.ipcRenderer?.views?.select(flowId, page.id, page.url))
                .then(() => window.ipcRenderer?.views?.show())
                .catch((e: any) => console.error("Failed to create/select view", e));
        }
    },

    updatePage: (flowId, pageId, updates) => {
        set((state) => {
            const newFlows = state.flows.map(f =>
                f.id === flowId
                    ? {
                        ...f,
                        pages: f.pages.map(p => p.id === pageId ? { ...p, ...updates } : p),
                        updatedAt: Date.now()
                    }
                    : f
            );
            saveStateToDisk(state.isInitialized);
            return { flows: newFlows };
        });
    },

    removePage: (flowId, pageId) => {
        set((state) => {
            const targetFlow = state.flows.find(f => f.id === flowId);
            const newPages = targetFlow ? targetFlow.pages.filter(p => p.id !== pageId) : [];

            // Clear lastActivePageId if the removed page was the last active page
            const shouldClearLastActive = targetFlow?.lastActivePageId === pageId;

            const newFlows = state.flows.map(f =>
                f.id === flowId
                    ? {
                        ...f,
                        pages: newPages,
                        lastActivePageId: shouldClearLastActive ? (newPages[0]?.id || undefined) : f.lastActivePageId,
                        updatedAt: Date.now()
                    }
                    : f
            );
            const newActiveId = state.activePageId === pageId ? null : state.activePageId;
            saveStateToDisk(state.isInitialized);

            return {
                flows: newFlows,
                activePageId: newActiveId
            };
        });
        if (window.ipcRenderer?.views) {
            window.ipcRenderer.views.remove(flowId, pageId);
        }
    },

    updatePageUrl: (flowId, pageId, url) => {
        set((state) => {
            const newFlows = state.flows.map(f =>
                f.id === flowId
                    ? {
                        ...f,
                        pages: f.pages.map(p => p.id === pageId ? { ...p, url } : p),
                        updatedAt: Date.now(),
                    }
                    : f
            );
            // Add to history automatically on URL update
            const page = newFlows.find(f => f.id === flowId)?.pages.find(p => p.id === pageId);
            const newHistory = [
                {
                    id: crypto.randomUUID(),
                    url,
                    title: page?.title || url,
                    timestamp: Date.now(),
                    flowId,
                    pageId
                },
                ...state.history
            ].slice(0, 500); // Keep last 500 items

            saveStateToDisk(state.isInitialized);
            return { flows: newFlows, history: newHistory };
        });
    },

    updatePageTitle: (flowId, pageId, title) => {
        set((state) => {
            const newFlows = state.flows.map(f =>
                f.id === flowId
                    ? {
                        ...f,
                        pages: f.pages.map(p => p.id === pageId ? { ...p, title } : p),
                        updatedAt: Date.now(),
                    }
                    : f
            );
            saveStateToDisk(state.isInitialized);
            return { flows: newFlows };
        });
    },

    addToHistory: (url, title, flowId, pageId) => {
        set((state) => {
            const newHistory = [
                {
                    id: crypto.randomUUID(),
                    url,
                    title,
                    timestamp: Date.now(),
                    flowId,
                    pageId
                },
                ...state.history
            ].slice(0, 500); // Keep last 500 items
            saveStateToDisk(state.isInitialized);
            return { history: newHistory };
        });
    },

    deleteFlow: (flowId) => {
        set((state) => {
            const newFlows = state.flows.filter(f => f.id !== flowId);
            const newActiveId = state.activeFlowId === flowId ? null : state.activeFlowId;
            saveStateToDisk(state.isInitialized);
            return { flows: newFlows, activeFlowId: newActiveId, activePageId: null };
        });
    },

    renameFlow: (flowId, newTitle) => {
        set((state) => {
            const newFlows = state.flows.map(f =>
                f.id === flowId ? { ...f, title: newTitle, updatedAt: Date.now() } : f
            );
            saveStateToDisk(state.isInitialized);
            return { flows: newFlows };
        });
    },

    updateFlowNotes: (flowId, notes) => {
        set((state) => {
            const newFlows = state.flows.map(f =>
                f.id === flowId ? { ...f, notes, updatedAt: Date.now() } : f
            );
            saveStateToDisk(state.isInitialized);
            return { flows: newFlows };
        });
    },

    appendToNotes: (flowId, text) => {
        set((state) => {
            const flow = state.flows.find(f => f.id === flowId);
            if (!flow) return {};

            const existingNotes = flow.notes || '';
            const separator = existingNotes.trim().length > 0 ? '\n\n' : '';
            const newNotes = existingNotes + separator + text;

            const newFlows = state.flows.map(f =>
                f.id === flowId ? { ...f, notes: newNotes, updatedAt: Date.now() } : f
            );
            saveStateToDisk(state.isInitialized);
            return { flows: newFlows };
        });
    },

    updateNotesTitle: (flowId, title) => {
        set((state) => {
            const newFlows = state.flows.map(f =>
                f.id === flowId ? { ...f, notesTitle: title, updatedAt: Date.now() } : f
            );
            saveStateToDisk(state.isInitialized);
            return { flows: newFlows };
        });
    },

    loadState: async () => {
        // Re-entrancy lock to prevent duplicate loads (happens with HMR)
        const state = get();
        if (state.isInitialized) {
            console.warn('[Store] loadState called but already initialized. Skipping duplicate load.');
            return;
        }

        try {
            let jsonStr: string | null = null;
            let loadedFromDisk = false;

            // Prioritize reading from disk (Source of Truth)
            if (window.ipcRenderer) {
                console.log('[Store] Attempting to load from disk...');
                try {
                    const diskContent = await window.ipcRenderer.invoke('read-file', 'flows.json');
                    if (diskContent && diskContent.trim() !== '') {
                        console.log('[Store] Successfully loaded state from disk');
                        jsonStr = diskContent;
                        loadedFromDisk = true;
                    } else {
                        console.warn('[Store] flows.json is empty or missing. Attempting backup...');
                        const backupContent = await window.ipcRenderer.invoke('read-file', 'flows.backup.json');
                        if (backupContent) {
                            console.log('[Store] Restored from backup');
                            jsonStr = backupContent;
                            loadedFromDisk = true;
                        }
                    }
                } catch (diskErr) {
                    console.error('[Store] Disk read failed:', diskErr);
                    // Try backup on error too
                    try {
                        const backupContent = await window.ipcRenderer.invoke('read-file', 'flows.backup.json');
                        if (backupContent) {
                            console.log('[Store] Restored from backup (after error)');
                            jsonStr = backupContent;
                            loadedFromDisk = true;
                        }
                    } catch (backupErr) {
                        console.warn('[Store] Backup read also failed:', backupErr);
                    }
                }
            } else {
                console.warn('[Store] ipcRenderer not found, skipping disk load');
            }

            // Fallback to localStorage if disk failed
            if (!jsonStr) {
                console.log('[Store] Fallback to localStorage');
                jsonStr = localStorage.getItem('continuum-flows');
            } else if (loadedFromDisk) {
                // If loaded from disk, sync back to localStorage to keep them aligned
                localStorage.setItem('continuum-flows', jsonStr);
            }

            const json = jsonStr || null;
            if (json) {
                try {
                    const data = JSON.parse(json);
                    if (data.flows) {
                        // DETAILED HYDRATION LOGGING
                        const flowDetails = data.flows.map((f: any) => `${f.title}: ${f.pages?.length || 0} pages`);
                        console.log('[Store] Hydrating state with flows:', data.flows.length, flowDetails);

                        const savedActiveFlowId = data.activeFlowId || null;

                        set({
                            flows: data.flows,
                            activeFlowId: savedActiveFlowId,
                            history: data.history || [],
                            bookmarks: data.bookmarks || [],
                            templates: data.templates || []
                        });

                        // VERIFY HYDRATION
                        const storeState = get();
                        const storeFlowDetails = storeState.flows.map((f: any) => `${f.title}: ${f.pages?.length || 0} pages`);
                        console.log('[Store] After set(), store has:', storeState.flows.length, storeFlowDetails);

                        if (savedActiveFlowId) {
                            // ... (rest of selection logic)
                            const activeFlow = data.flows.find((f: any) => f.id === savedActiveFlowId);
                            if (activeFlow) {
                                const lastActivePageId = activeFlow.lastActivePageId;
                                const lastActivePage = lastActivePageId
                                    ? activeFlow.pages.find((p: any) => p.id === lastActivePageId)
                                    : null;

                                if (lastActivePage) {
                                    console.log('[Store] loadState - passing state:', lastActivePage.state ? { scrollY: lastActivePage.state.scrollY, hasAnchor: !!lastActivePage.state.anchor } : 'NO STATE');
                                    set({ activePageId: lastActivePageId });
                                    setTimeout(() => {
                                        if (window.ipcRenderer?.views) {
                                            window.ipcRenderer.views.select(
                                                savedActiveFlowId,
                                                lastActivePageId,
                                                lastActivePage.url,
                                                lastActivePage.state
                                            );
                                        }
                                    }, 200);
                                }
                            }
                        }
                    }
                } catch (parseErr) {
                    console.error('[Store] Failed to parse state JSON:', parseErr);
                }
            } else {
                console.warn('[Store] No state found (fresh install?)');
            }
            set({ isInitialized: true });
        } catch (err) {
            console.error("Failed to load state:", err);
            set({ isInitialized: true });
        }
    },

    ensureViewSelected: () => {
        const { activeFlowId, activePageId, flows } = get();
        if (activeFlowId && activePageId && window.ipcRenderer?.views) {
            const flow = flows.find(f => f.id === activeFlowId);
            const page = flow?.pages.find(p => p.id === activePageId);
            if (page) {
                // Pass page.state for scroll position restoration on startup
                window.ipcRenderer.views.select(activeFlowId, activePageId, page.url, page.state);
            }
        }
    },

    // Capture current page state before app close
    captureCurrentPageState: async () => {
        const { activeFlowId, activePageId, flows } = get();
        if (activeFlowId && activePageId && window.ipcRenderer?.views) {
            console.log('[Store] Capturing state for current page before quit...');
            try {
                const state = await window.ipcRenderer.views.captureState();
                console.log('[Store] Captured state before quit:', state ? { scrollY: state.scrollY } : 'null');
                if (state) {
                    const newFlows = flows.map(f =>
                        f.id === activeFlowId
                            ? {
                                ...f,
                                pages: f.pages.map(p =>
                                    p.id === activePageId ? { ...p, state } : p
                                ),
                            }
                            : f
                    );
                    set({ flows: newFlows });
                    // Force immediate save
                    await saveStateToDiskForced();
                }
            } catch (e) {
                console.error('[Store] Failed to capture state on quit:', e);
            }
        }
    },

    toggleHistory: async () => {
        const { isHistoryOpen } = get();

        if (isHistoryOpen) {
            set({ isHistoryOpen: false, historyOverlaySnapshot: null });
            if (window.ipcRenderer?.views) window.ipcRenderer.views.show();
        } else {
            if (window.ipcRenderer?.views) window.ipcRenderer.views.hide();
            set({ isHistoryOpen: true, historyOverlaySnapshot: null });

            if (window.ipcRenderer?.views) {
                // @ts-ignore
                window.ipcRenderer.views.capture().then((snapshot) => {
                    if (get().isHistoryOpen && snapshot) {
                        set({ historyOverlaySnapshot: snapshot });
                    }
                }).catch((err: any) => {
                    console.error("[Store] Background capture failed:", err);
                });
            }
        }
    },

    addBookmark: (url, title, favicon) => {
        set((state) => {
            if (state.bookmarks.some(b => b.url === url)) return {};
            const newBookmarks = [
                {
                    id: crypto.randomUUID(),
                    url,
                    title,
                    favicon,
                    createdAt: Date.now()
                },
                ...state.bookmarks
            ];
            saveStateToDisk(state.isInitialized);
            return { bookmarks: newBookmarks };
        });
    },

    removeBookmark: (url) => {
        set((state) => {
            const newBookmarks = state.bookmarks.filter(b => b.url !== url);
            saveStateToDisk(state.isInitialized);
            return { bookmarks: newBookmarks };
        });
    },

    isBookmarked: (url) => {
        return get().bookmarks.some(b => b.url === url);
    },

    clearHistory: () => {
        set((state) => {
            const newHistory: HistoryItem[] = [];
            saveStateToDisk(state.isInitialized);
            return { history: newHistory };
        });
    },

    savePageState: async (_flowId, _pageId) => {
        return;
    },

    restorePageState: async (flowId, pageId) => {
        const { flows } = get();
        const flow = flows.find(f => f.id === flowId);
        const page = flow?.pages.find(p => p.id === pageId);

        if (!page?.state) return;
        return;
    },

    saveFlowAsTemplate: (flowId, name) => set(state => {
        const flow = state.flows.find(f => f.id === flowId);
        if (!flow) return {};

        const newTemplate: FlowTemplate = {
            id: crypto.randomUUID(),
            name,
            type: flow.type,
            pages: flow.pages.map(p => ({ url: p.url, title: p.title, pinned: false })),
            createdAt: Date.now()
        };

        const newTemplates = [...state.templates, newTemplate];
        saveStateToDisk(state.isInitialized);
        return { templates: newTemplates };
    }),

    createFlowFromTemplate: (templateId) => set(state => {
        const template = state.templates.find(t => t.id === templateId);
        if (!template) return {};

        const newFlow: Flow = {
            id: crypto.randomUUID(),
            title: template.name,
            type: template.type,
            pages: template.pages.map(p => ({
                id: crypto.randomUUID(),
                url: p.url,
                title: p.title || p.url,
                lastVisited: Date.now(),
                favicon: `https://www.google.com/s2/favicons?domain=${p.url}&sz=64`
            })),

            lastActivePageId: undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            notes: ''
        };

        const initialActivePageId = newFlow.pages.length > 0 ? newFlow.pages[0].id : null;
        if (initialActivePageId) {
            newFlow.lastActivePageId = initialActivePageId;
        }

        const newFlows = [...state.flows, newFlow];
        saveStateToDisk(state.isInitialized);
        return { flows: newFlows, activeFlowId: newFlow.id, activePageId: initialActivePageId };
    }),

    deleteTemplate: (templateId) => set(state => {
        const newTemplates = state.templates.filter(t => t.id !== templateId);
        saveStateToDisk(state.isInitialized);
        return { templates: newTemplates };
    })
}));

// Subscribe to state changes and auto-save
// This fires AFTER set() completes, so getState() returns fresh state
useFlowStore.subscribe(
    (state, prevState) => {
        // Only save if initialized and if persisted data changed
        if (state.isInitialized) {
            // Check if any persistable state changed
            const flowsChanged = state.flows !== prevState.flows;
            const historyChanged = state.history !== prevState.history;
            const bookmarksChanged = state.bookmarks !== prevState.bookmarks;
            const templatesChanged = state.templates !== prevState.templates;
            const activeFlowChanged = state.activeFlowId !== prevState.activeFlowId;

            if (flowsChanged || historyChanged || bookmarksChanged || templatesChanged || activeFlowChanged) {
                console.log('[Store] State changed, triggering auto-save');
                debouncedSaveToDisk();
            }
        }
    }
);
