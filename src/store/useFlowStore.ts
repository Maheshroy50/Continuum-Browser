import { create } from 'zustand';
// import { invoke } from '@tauri-apps/api/core';
import { AppState, Flow, Page, HistoryItem, Bookmark, FlowTemplate } from '../shared/types';

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
}

// Helper to save state to disk AND localStorage
const saveStateToDisk = async (flows: Flow[], activeFlowId: string | null, history: HistoryItem[], bookmarks: Bookmark[], templates: FlowTemplate[]) => {
    try {
        const data = { flows, activeFlowId, history, bookmarks, templates };
        const jsonStr = JSON.stringify(data, null, 2);

        // Save to localStorage (primary source for loadState)
        localStorage.setItem('continuum-flows', jsonStr);

        // Also save to file system as backup
        if (window.ipcRenderer) {
            // Use invoke to match ipcMain.handle, and pass arguments correctly
            await window.ipcRenderer.invoke('save-file', 'flows.json', jsonStr);
            // console.log('[Store] State saved to disk');
        }
    } catch (err) {
        console.error("Failed to save state:", err);
    }
};

export const useFlowStore = create<FlowStore>((set, get) => ({
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
            saveStateToDisk(newFlows, newFlow.id, state.history, state.bookmarks, state.templates); // Auto-save and set active
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
                saveStateToDisk(state.flows, flowId, state.history, state.bookmarks, state.templates);
                return { activeFlowId: flowId, activePageId: lastActivePageId };
            });

            // Load the page in BrowserView
            if (window.ipcRenderer?.views) {
                window.ipcRenderer.views.select(flowId, lastActivePageId, lastActivePage.url);
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
                saveStateToDisk(state.flows, flowId, state.history, state.bookmarks, state.templates);
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
                // const state = await window.ipcRenderer.views.captureState(activeFlowId, currentPageId);
                const state: any = null; // Stub until backend supports it
                // console.log('[Store] Captured state:', state ? { scrollY: state.scrollY, scrollRatio: state.scrollRatio, hasAnchor: !!state.anchor } : 'null');
                if (state) {
                    set((prev) => {
                        const newFlows = prev.flows.map(f =>
                            f.id === activeFlowId
                                ? { ...f, pages: f.pages.map(p => p.id === currentPageId ? { ...p, state } : p) }
                                : f
                        );
                        saveStateToDisk(newFlows, prev.activeFlowId, prev.history, prev.bookmarks, prev.templates);
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
                saveStateToDisk(newFlows, prev.activeFlowId, prev.history, prev.bookmarks, prev.templates);
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
            // const state = page?.state;

            // Pass state directly to select - restoration happens in ViewManager on did-finish-load
            if (window.ipcRenderer?.views) {
                window.ipcRenderer.views.select(activeFlowId, pageId, url || undefined);
            }
        }
    },

    addPageToFlow: (flowId, page) => {
        set((state) => {
            const newFlows = state.flows.map(f =>
                f.id === flowId
                    ? { ...f, pages: [...f.pages, page], lastActivePageId: page.id, updatedAt: Date.now() }
                    : f
            );
            saveStateToDisk(newFlows, state.activeFlowId, state.history, state.bookmarks, state.templates);
            return { flows: newFlows, activePageId: page.id }; // Auto-select new page
        });

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
            saveStateToDisk(newFlows, state.activeFlowId, state.history, state.bookmarks, state.templates);
            return { flows: newFlows };
        });
    },

    removePage: (flowId, pageId) => {
        set((state) => {
            const newFlows = state.flows.map(f =>
                f.id === flowId
                    ? { ...f, pages: f.pages.filter(p => p.id !== pageId), updatedAt: Date.now() }
                    : f
            );
            const newActiveId = state.activePageId === pageId ? null : state.activePageId;
            saveStateToDisk(newFlows, state.activeFlowId, state.history, state.bookmarks, state.templates);

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

            saveStateToDisk(newFlows, state.activeFlowId, newHistory, state.bookmarks, state.templates);
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
            saveStateToDisk(newFlows, state.activeFlowId, state.history, state.bookmarks, state.templates);
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
            saveStateToDisk(state.flows, state.activeFlowId, newHistory, state.bookmarks, state.templates);
            return { history: newHistory };
        });
    },

    deleteFlow: (flowId) => {
        set((state) => {
            const newFlows = state.flows.filter(f => f.id !== flowId);
            const newActiveId = state.activeFlowId === flowId ? null : state.activeFlowId;
            saveStateToDisk(newFlows, newActiveId, state.history, state.bookmarks, state.templates);
            return { flows: newFlows, activeFlowId: newActiveId, activePageId: null };
        });
    },

    renameFlow: (flowId, newTitle) => {
        set((state) => {
            const newFlows = state.flows.map(f =>
                f.id === flowId ? { ...f, title: newTitle, updatedAt: Date.now() } : f
            );
            saveStateToDisk(newFlows, state.activeFlowId, state.history, state.bookmarks, state.templates);
            return { flows: newFlows };
        });
    },

    updateFlowNotes: (flowId, notes) => {
        set((state) => {
            const newFlows = state.flows.map(f =>
                f.id === flowId ? { ...f, notes, updatedAt: Date.now() } : f
            );
            saveStateToDisk(newFlows, state.activeFlowId, state.history, state.bookmarks, state.templates);
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
            saveStateToDisk(newFlows, state.activeFlowId, state.history, state.bookmarks, state.templates);
            return { flows: newFlows };
        });
    },

    updateNotesTitle: (flowId, title) => {
        set((state) => {
            const newFlows = state.flows.map(f =>
                f.id === flowId ? { ...f, notesTitle: title, updatedAt: Date.now() } : f
            );
            saveStateToDisk(newFlows, state.activeFlowId, state.history, state.bookmarks, state.templates);
            return { flows: newFlows };
        });
    },

    loadState: async () => {
        try {
            let jsonStr: string | null = null;
            let loadedFromDisk = false;

            // Prioritize reading from disk (Source of Truth)
            if (window.ipcRenderer) {
                console.log('[Store] Attempting to load from disk...');
                try {
                    const diskContent = await window.ipcRenderer.invoke('read-file', 'flows.json');
                    if (diskContent) {
                        console.log('[Store] Successfully loaded state from disk');
                        jsonStr = diskContent;
                        loadedFromDisk = true;
                    }
                } catch (diskErr) {
                    console.log('[Store] Disk read failed/empty (expected on fresh install):', diskErr);
                }
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
                const data = JSON.parse(json);
                if (data.flows) {
                    const savedActiveFlowId = data.activeFlowId || null;

                    set({
                        flows: data.flows,
                        activeFlowId: savedActiveFlowId,
                        history: data.history || [],
                        bookmarks: data.bookmarks || [],
                        templates: data.templates || []
                    });

                    if (savedActiveFlowId) {
                        const activeFlow = data.flows.find((f: any) => f.id === savedActiveFlowId);
                        if (activeFlow) {
                            const lastActivePageId = activeFlow.lastActivePageId;
                            const lastActivePage = lastActivePageId
                                ? activeFlow.pages.find((p: any) => p.id === lastActivePageId)
                                : null;

                            if (lastActivePage) {
                                set({ activePageId: lastActivePageId });
                                setTimeout(() => {
                                    if (window.ipcRenderer?.views) {
                                        window.ipcRenderer.views.select(
                                            savedActiveFlowId,
                                            lastActivePageId,
                                            lastActivePage.url
                                        );
                                    }
                                }, 200);
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Failed to load state:", err);
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
            saveStateToDisk(state.flows, state.activeFlowId, state.history, newBookmarks, state.templates);
            return { bookmarks: newBookmarks };
        });
    },

    removeBookmark: (url) => {
        set((state) => {
            const newBookmarks = state.bookmarks.filter(b => b.url !== url);
            saveStateToDisk(state.flows, state.activeFlowId, state.history, newBookmarks, state.templates);
            return { bookmarks: newBookmarks };
        });
    },

    isBookmarked: (url) => {
        return get().bookmarks.some(b => b.url === url);
    },

    clearHistory: () => {
        set((state) => {
            const newHistory: HistoryItem[] = [];
            saveStateToDisk(state.flows, state.activeFlowId, newHistory, state.bookmarks, state.templates);
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
        saveStateToDisk(state.flows, state.activeFlowId, state.history, state.bookmarks, newTemplates);
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
        saveStateToDisk(newFlows, newFlow.id, state.history, state.bookmarks, state.templates);
        return { flows: newFlows, activeFlowId: newFlow.id, activePageId: initialActivePageId };
    }),

    deleteTemplate: (templateId) => set(state => {
        const newTemplates = state.templates.filter(t => t.id !== templateId);
        saveStateToDisk(state.flows, state.activeFlowId, state.history, state.bookmarks, newTemplates);
        return { templates: newTemplates };
    })
}));
