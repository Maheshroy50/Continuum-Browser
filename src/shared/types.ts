export type FlowType = 'Goal' | 'Study' | 'Job' | 'Build' | 'Research' | 'Browse';

export interface PageState {
    scrollX: number;
    scrollY: number;
    scrollRatio?: number;  // scrollY / docHeight - for ratio-based restore
    zoomFactor?: number;
    formData?: Record<string, string>; // input id/name -> value
    // DOM Anchor Resume - more resilient to layout changes
    anchor?: {
        text: string;      // First 120 chars of visible element
        tag: string;       // Element tag (P, H1, H2, etc.)
        offset: number;    // Offset within the element
    };
}

export interface Page {
    id: string;
    url: string;
    title: string;
    favicon?: string;
    lastVisited: number;
    state?: PageState;
    /**
     * If the page is "pinned" or crucial to the flow
     */
    isPinned?: boolean;
}

export interface MemoryChunk {
    id: string;
    sourceUrl: string;
    content: string; // The text content
    timestamp: number;
    type: 'summary' | 'excerpt' | 'note';
}

export interface Flow {
    id: string;
    title: string;
    type: FlowType;
    pages: Page[];
    /**
     * The last active page in this Flow - auto-resumed on Flow open
     */
    lastActivePageId?: string;
    /**
     * A simple scratchpad for the flow
     */
    notes: string;
    /**
     * Custom title for the notes panel (default: "Notes")
     */
    notesTitle?: string;
    /**
     * Associated memory/knowledge for this flow
     */
    memory?: MemoryChunk[];
    createdAt: number;
    updatedAt: number;
}

export interface HistoryItem {
    id: string;
    url: string;
    title: string;
    timestamp: number;
    flowId: string;
    pageId: string;
}

export interface Bookmark {
    id: string;
    url: string;
    title: string;
    favicon?: string;
    createdAt: number;
}

export interface AppState {
    flows: Flow[];
    activeFlowId: string | null;
    history: HistoryItem[];
    bookmarks: Bookmark[];
    templates: FlowTemplate[];
    historyOverlaySnapshot: string | null;
}

export interface FlowTemplate {
    id: string;
    name: string;
    pages: { url: string; title?: string; pinned: boolean }[];
    type: Flow['type'];
    createdAt: number;
}
