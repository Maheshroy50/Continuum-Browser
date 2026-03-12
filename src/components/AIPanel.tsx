import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Bot, X, Sparkles, FileText, StopCircle, Zap, Shield, Activity, Layers, Play, ChevronDown, Maximize2, AlertTriangle, Paperclip } from 'lucide-react';
import { useAIStore, ChatMessage, AgentActivity, ApprovalRequest } from '../store/useAIStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useUIStore } from '../store/useUIStore';

import ReactMarkdown from 'react-markdown';
import { Readability } from '@mozilla/readability';
import { measurePerformance } from '../utils/performance';

// Memoized Components to prevent re-renders on every activity update
const MemoizedMessageList = React.memo(({ messages }: { messages: ChatMessage[] }) => {
    return (
        <>
            {messages.map((msg, idx) => (
                <div key={`${msg.id}-${idx}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                    <div
                        className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm backdrop-blur-md prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/30 prose-pre:border prose-pre:border-white/10 ${msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-tr-sm prose-headings:text-white prose-a:text-white prose-code:text-white prose-strong:text-white'
                            : 'bg-zinc-800/50 text-foreground/90 border border-white/5 rounded-tl-sm'
                            }`}
                    >
                        <ReactMarkdown>
                            {msg.content}
                        </ReactMarkdown>
                    </div>
                </div>
            ))}
        </>
    );
});

const MemoizedAgentActivity = React.memo(({ activity, isLoading }: { activity: AgentActivity, isLoading: boolean }) => {
    if (!isLoading && activity.state === 'idle') return null;

    return (
        <div className="flex justify-start w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="w-full max-w-[95%] bg-black/20 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-lg">
                {/* Status Header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border-b border-white/5">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${activity.state === 'error' ? 'bg-red-500' :
                        activity.state === 'thinking' ? 'bg-purple-500' :
                            'bg-amber-500'
                        }`} />
                    <span className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
                        {activity.state.replace('_', ' ')}
                    </span>
                    {activity.attempt !== undefined && activity.maxAttempts !== undefined && (
                        <span className="text-xs font-mono text-muted-foreground/70">
                            {activity.attempt}/{activity.maxAttempts}
                        </span>
                    )}
                    {activity.progress !== undefined && (
                        <span className="ml-auto text-xs font-mono text-primary/80">
                            {Math.round(activity.progress * 100)}%
                        </span>
                    )}
                </div>

                {/* Message Body */}
                <div className="p-4 space-y-2">
                    <p className="text-sm text-foreground/90 font-medium">
                        {activity.message || 'Processing...'}
                    </p>

                    {(activity.details || activity.state === 'thinking') && (
                        <div className="text-xs font-mono text-muted-foreground/70 pl-3 border-l-2 border-white/10 mt-2">
                            {activity.details || 'Analyzing context...'}
                        </div>
                    )}

                    {activity.summary && (
                        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm text-foreground/85">
                            {activity.summary}
                        </div>
                    )}

                    {activity.manualSteps && activity.manualSteps.length > 0 && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-xs text-amber-100/80 space-y-1">
                            <div className="font-mono uppercase tracking-wider text-[10px] text-amber-200/70">Manual steps</div>
                            {activity.manualSteps.map((step, index) => (
                                <div key={`${step}-${index}`}>{index + 1}. {step}</div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

const MemoizedApprovalCard = React.memo(({ pendingApproval, onApprove }: { pendingApproval: ApprovalRequest | null, onApprove: (approved: boolean) => void }) => {
    if (!pendingApproval) return null;

    return (
        <div className="border border-amber-500/40 bg-amber-500/10 backdrop-blur-xl rounded-2xl p-5 shadow-[0_0_30px_rgba(245,158,11,0.1)] animate-in zoom-in-95 duration-300 ring-1 ring-amber-500/20">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-500/20">
                    <Shield className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-amber-100 mb-1">Authorization Required</h4>
                    <p className="text-sm text-amber-200/70 mb-4 leading-relaxed">
                        The agent requests to perform a <strong>{pendingApproval.intent.type.replace('_', ' ')}</strong> action.
                    </p>

                    <div className="bg-black/20 rounded-lg p-3 mb-4 border border-amber-500/10 font-mono text-xs text-amber-100/80 break-all">
                        {pendingApproval.consequences}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => onApprove(false)}
                            className="flex-1 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-200 border border-red-500/20 rounded-lg text-xs font-medium transition-all"
                        >
                            Deny
                        </button>
                        <button
                            onClick={() => onApprove(true)}
                            className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs transition-all shadow-lg shadow-amber-500/20"
                        >
                            Approve
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

// Simple Error Boundary
class AIPanelErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("AIPanel Error:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed z-[60] flex items-center justify-center p-4 bg-red-950/90 border border-red-500/50 rounded-xl shadow-2xl backdrop-blur-md"
                    style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', maxWidth: '400px' }}>
                    <div className="flex flex-col items-center text-center gap-3">
                        <AlertTriangle className="w-10 h-10 text-red-500" />
                        <h3 className="font-bold text-white">Component Error</h3>
                        <p className="text-sm text-red-200">{this.state.error?.message || 'The AI Panel encountered an unexpected error.'}</p>
                        <button
                            onClick={() => this.setState({ hasError: false })}
                            className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Reload Panel
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// Helper for timeout
const withTimeout = <T,>(promise: Promise<T>, ms: number = 30000, errorMsg = 'Request timed out'): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
    ]);
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type AgentTerminalData = {
    status: 'success' | 'failed' | 'cancelled';
    summary: string;
    answer?: string;
    manualSteps?: string[];
    finalUrl?: string;
    attemptsUsed: number;
};

const isAgentTerminalData = (value: unknown): value is AgentTerminalData => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    return typeof candidate.status === 'string' &&
        typeof candidate.summary === 'string' &&
        typeof candidate.attemptsUsed === 'number';
};

const formatAgentTerminalMessage = (data: AgentTerminalData): string => {
    const title = data.status === 'success'
        ? 'Task Complete'
        : data.status === 'cancelled'
            ? 'Task Cancelled'
            : 'Task Failed';
    const lines = [`**${title}**`, '', data.summary];

    if (data.answer) {
        lines.push('', data.answer);
    }

    if (data.finalUrl) {
        lines.push('', `Current page: ${data.finalUrl}`);
    }

    if (data.manualSteps?.length) {
        lines.push('', '**Manual steps**');
        data.manualSteps.forEach((step, index) => {
            lines.push(`${index + 1}. ${step}`);
        });
    }

    if (data.status !== 'success') {
        lines.push('', `Attempts used: ${data.attemptsUsed}/3`);
    }

    return lines.join('\n');
};

export function AIPanel() {
    return (
        <AIPanelErrorBoundary>
            <AIPanelContent />
        </AIPanelErrorBoundary>
    );
}

function AIPanelContent() {
    const [isMounted, setIsMounted] = useState(false);
    const PANEL_MIN_WIDTH = 300;
    const PANEL_MIN_HEIGHT = 280;
    const PANEL_VIEWPORT_MARGIN = 20;
    const getMinPanelWidth = useCallback(
        () => Math.min(PANEL_MIN_WIDTH, Math.max(1, window.innerWidth - 2 * PANEL_VIEWPORT_MARGIN)),
        []
    );
    const getMinPanelHeight = useCallback(
        () => Math.min(PANEL_MIN_HEIGHT, Math.max(1, window.innerHeight - 2 * PANEL_VIEWPORT_MARGIN)),
        []
    );
    const getMaxPanelWidth = useCallback(() => Math.max(getMinPanelWidth(), window.innerWidth - 2 * PANEL_VIEWPORT_MARGIN), [getMinPanelWidth]);
    const getMaxPanelHeight = useCallback(
        () => Math.max(
            getMinPanelHeight(),
            Math.min(window.innerHeight - 2 * PANEL_VIEWPORT_MARGIN, Math.floor(window.innerHeight * 0.72))
        ),
        [getMinPanelHeight]
    );
    const isOverlayMode = useMemo(
        () => new URLSearchParams(window.location.search).get('overlay') === 'true',
        []
    );

    const setOverlayInteraction = useCallback((interactive: boolean) => {
        if (!isOverlayMode) return;
        requestAnimationFrame(() => {
            window.ipcRenderer?.send?.(interactive ? 'overlay:focus' : 'overlay:blur');
        });
    }, [isOverlayMode]);

    // Manually hydrate store on mount to avoid blocking main thread during initial script evaluation
    useEffect(() => {
        // Delay hydration to ensure first paint is complete
        const timer = setTimeout(() => {
            const endMeasure = measurePerformance('AIPanel Hydration');
            useUIStore.persist.rehydrate();
            useSettingsStore.persist.rehydrate();
            endMeasure();
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        // Defer complex rendering to next frame to allow mount to complete
        const timer = requestAnimationFrame(() => {
            setIsMounted(true);
        });
        return () => cancelAnimationFrame(timer);
    }, []);

    const {
        isOpen, setIsOpen,
        chatMessages, agentMessages, addMessage,
        isLoading, setLoading,
        provider, setProvider,
        includeContext,
        pendingApproval, setPendingApproval,
        activity, powerLevel, setPowerLevel
    } = useAIStore();

    const {
        x, y, width, height, isCollapsed,
        setPosition, setSize, setCollapsed
    } = useUIStore();

    const minPanelWidth = getMinPanelWidth();
    const minPanelHeight = getMinPanelHeight();
    const maxPanelWidth = getMaxPanelWidth();
    const maxPanelHeight = getMaxPanelHeight();

    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Drag & Resize Refs
    const isDragging = useRef(false);
    const isResizing = useRef<string | null>(null);
    const dragStart = useRef({ x: 0, y: 0, initialX: 0, initialY: 0, initialW: 0, initialH: 0 });
    const panelRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);

    // Safety check + viewport clamping for store values
    const rawW = typeof width === 'number' && !isNaN(width) ? width : 380;
    const rawH = typeof height === 'number' && !isNaN(height) ? height : 520;
    const safeW = clamp(rawW, minPanelWidth, maxPanelWidth);
    const safeH = clamp(rawH, minPanelHeight, maxPanelHeight);

    // Use actual dimensions for constraints so collapsed panel can be dragged properly
    const actualW = isCollapsed ? (panelRef.current?.offsetWidth || 500) : safeW;

    // Account for tab strip (40px) + address bar (48px) = 88px total top offset
    // In overlay mode, use 0 since overlay covers full screen
    const TOP_UI_OFFSET = isOverlayMode ? 0 : 88;
    const minX = 0;
    const minY = TOP_UI_OFFSET;
    const maxX = Math.max(minX, window.innerWidth - Math.min(100, actualW));
    const maxY = Math.max(minY, window.innerHeight - 60);
    const safeX = clamp(typeof x === 'number' && !isNaN(x) ? x : PANEL_VIEWPORT_MARGIN, minX, maxX);
    const safeY = clamp(typeof y === 'number' && !isNaN(y) ? y : TOP_UI_OFFSET + PANEL_VIEWPORT_MARGIN, minY, maxY);

    const { openAIApiKey, googleApiKey, anthropicApiKey, githubApiKey, huggingFaceApiKey, grokApiKey, kimiApiKey } = useSettingsStore();

    const [input, setInput] = useState('');
    const [mode, setMode] = useState<'chat' | 'agent' | 'batch'>('agent'); // Default to Agent Mode
    const [selectedModel, setSelectedModel] = useState<string>(''); // specific model
    const [customModel, setCustomModel] = useState<string>('');
    const isComposingRef = useRef(false); // Guard for IME composition to prevent double-character input

    // Initialize transient state ref
    const transientState = useRef({
        x: safeX,
        y: safeY,
        width: safeW,
        height: safeH
    });

    // Sync transient state with committed state when not dragging
    useEffect(() => {
        if (!isDragging.current && !isResizing.current) {
            transientState.current = {
                x: safeX,
                y: safeY,
                width: safeW,
                height: safeH
            };
        }
    }, [safeX, safeY, safeW, safeH]);




    // Layout ref to avoid effect dependency churn
    const layoutRef = useRef({ isCollapsed });
    useEffect(() => {
        layoutRef.current = { isCollapsed };
    }, [isCollapsed]);

    // Available Models Mapping
    const [availableModels, setAvailableModels] = useState<Record<string, { id: string; name: string }[]>>({});

    // Fallback models defined outside effect to avoid dependency issues
    const FALLBACK_MODELS: Record<string, { id: string; name: string }[]> = useMemo(() => ({
        openai: [
            { id: '', name: 'Auto (GPT-4o)' },
            { id: 'gpt-4o', name: 'GPT-4o' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
            { id: 'o1-preview', name: 'o1 Preview' }
        ],
        gemini: [
            { id: '', name: 'Auto (Best)' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
        ],
        anthropic: [
            { id: '', name: 'Auto (Sonnet)' },
            { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' }
        ],
        github: [
            { id: '', name: 'Auto (GPT-4o)' },
            { id: 'gpt-4o', name: 'GPT-4o (GitHub)' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }
        ],
        huggingface: [
            { id: '', name: 'Auto (Llama 3)' },
            { id: 'meta-llama/Meta-Llama-3-8B-Instruct', name: 'Llama 3 8B' },
            { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B v0.3' }
        ],
        grok: [
            { id: '', name: 'Auto (Grok Beta)' },
            { id: 'grok-beta', name: 'Grok Beta' }
        ],
        kimi: [
            { id: '', name: 'Auto (Moonshot 8k)' },
            { id: 'moonshot-v1-8k', name: 'Moonshot v1 8k' }
        ]
    }), []);

    useEffect(() => {
        // Fetch models from backend
        const fetchModels = async () => {
            // Add slight delay to allow first paint
            await new Promise(r => setTimeout(r, 1000));
            try {
                // @ts-ignore
                const registry = await window.ipcRenderer?.invoke('ai:get-models');
                if (registry && Array.isArray(registry)) {
                    const grouped: Record<string, { id: string; name: string }[]> = {};

                    // Initialize all providers with an Auto option
                    ['openai', 'gemini', 'anthropic', 'github', 'huggingface', 'grok', 'kimi'].forEach(p => {
                        grouped[p] = [{ id: '', name: 'Auto (Default)' }];
                    });

                    registry.forEach((m: any) => {
                        if (!grouped[m.provider]) grouped[m.provider] = [{ id: '', name: 'Auto (Default)' }];
                        grouped[m.provider].push({ id: m.id, name: m.name });
                    });

                    setAvailableModels(grouped);
                }
            } catch (e) {
                console.error("Failed to fetch models", e);
                // Fallback to hardcoded if IPC fails (e.g. during dev without electron)
                setAvailableModels(FALLBACK_MODELS);
            }
        };
        fetchModels();
    }, [FALLBACK_MODELS]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chatMessages, agentMessages, isOpen, activity, pendingApproval]);

    // Auto-focus input
    useEffect(() => {
        if (isOpen) {
            if (textareaRef.current) textareaRef.current.focus();
            if (inputRef.current) inputRef.current.focus();
        }
    }, [isOpen, isCollapsed]);

    // Drag & Resize Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        // Only start drag if clicking the header area (and not buttons)
        if ((e.target as HTMLElement).closest('button')) return;

        isDragging.current = true;

        // Sync transient state before drag starts in case hydration shifted store positions
        // without triggering a normalizeBounds recalculation.
        const currentState = useUIStore.getState();
        transientState.current = {
            ...transientState.current,
            x: Number.isFinite(currentState.x) ? currentState.x : safeX,
            y: Number.isFinite(currentState.y) ? currentState.y : safeY
        };

        const { x: tx, y: ty, width: tw, height: th } = transientState.current;
        dragStart.current = {
            x: e.clientX,
            y: e.clientY,
            initialX: tx,
            initialY: ty,
            initialW: tw,
            initialH: th
        };
        e.preventDefault();
    };

    const handleResizeStart = (e: React.MouseEvent, direction: string) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        isResizing.current = direction;

        // Sync transient state before drag starts in case hydration shifted store sizes/positions
        const currentState = useUIStore.getState();
        transientState.current = {
            x: Number.isFinite(currentState.x) ? currentState.x : safeX,
            y: Number.isFinite(currentState.y) ? currentState.y : safeY,
            width: Number.isFinite(currentState.width) ? currentState.width : safeW,
            height: Number.isFinite(currentState.height) ? currentState.height : safeH
        };

        const { x: tx, y: ty, width: tw, height: th } = transientState.current;
        dragStart.current = {
            x: e.clientX,
            y: e.clientY,
            initialX: tx,
            initialY: ty,
            initialW: tw,
            initialH: th
        };
        e.preventDefault();
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging.current) {
                const dx = e.clientX - dragStart.current.x;
                const dy = e.clientY - dragStart.current.y;

                let newX = dragStart.current.initialX + dx;
                let newY = dragStart.current.initialY + dy;

                // Use transient state during drag to avoid snapping on unrelated re-renders.
                const { isCollapsed: layoutCollapsed } = layoutRef.current;
                const measuredPanelWidth = panelRef.current?.offsetWidth;
                const currentW = layoutCollapsed ? (measuredPanelWidth ?? transientState.current.width) : transientState.current.width;

                // Constrain to viewport bounds (relaxed)
                const minDragX = 0;
                const minDragY = 0;
                const maxDragX = Math.max(minDragX, window.innerWidth - Math.min(100, currentW));
                const maxDragY = Math.max(minDragY, window.innerHeight - 60);
                newX = clamp(newX, minDragX, maxDragX);
                newY = clamp(newY, minDragY, maxDragY);

                // Update transient state
                transientState.current.x = newX;
                transientState.current.y = newY;

                // Direct DOM update via RAF for performance (bypass React render cycle)
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(() => {
                    if (panelRef.current) {
                        panelRef.current.style.transition = 'none';
                        panelRef.current.style.transform = '';
                        panelRef.current.style.left = `${newX}px`;
                        panelRef.current.style.top = `${newY}px`;
                    }
                });

            } else if (isResizing.current) {
                const dx = e.clientX - dragStart.current.x;
                const dy = e.clientY - dragStart.current.y;
                const dir = isResizing.current;

                let newW = dragStart.current.initialW;
                let newH = dragStart.current.initialH;
                let newX = dragStart.current.initialX;
                let newY = dragStart.current.initialY;

                // Resize logic with dynamic viewport-safe min/max constraints.
                const minResizeW = getMinPanelWidth();
                const minResizeH = getMinPanelHeight();
                const maxResizeW = getMaxPanelWidth();
                const maxResizeH = getMaxPanelHeight();

                if (dir.includes('e')) {
                    newW = clamp(dragStart.current.initialW + dx, minResizeW, maxResizeW);
                }
                if (dir.includes('w')) {
                    const w = clamp(dragStart.current.initialW - dx, minResizeW, maxResizeW);
                    newX = dragStart.current.initialX + (dragStart.current.initialW - w);
                    newW = w;
                }
                if (dir.includes('s')) {
                    newH = clamp(dragStart.current.initialH + dy, minResizeH, maxResizeH);
                }
                if (dir.includes('n')) {
                    const h = clamp(dragStart.current.initialH - dy, minResizeH, maxResizeH);
                    newY = dragStart.current.initialY + (dragStart.current.initialH - h);
                    newH = h;
                }

                // Keep resized panel visible on screen.
                const minResizeX = 0;
                const minResizeY = 0;
                const maxRight = window.innerWidth;
                const maxBottom = window.innerHeight;

                newX = clamp(newX, minResizeX, Math.max(minResizeX, maxRight - newW));
                newY = clamp(newY, minResizeY, Math.max(minResizeY, maxBottom - newH));
                newW = clamp(newW, minResizeW, Math.min(maxResizeW, maxRight - newX));
                newH = clamp(newH, minResizeH, Math.min(maxResizeH, maxBottom - newY));

                // Update transient state
                transientState.current.width = newW;
                transientState.current.height = newH;
                transientState.current.x = newX;
                transientState.current.y = newY;

                // Direct DOM update via RAF
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(() => {
                    if (panelRef.current) {
                        panelRef.current.style.transition = 'none';
                        panelRef.current.style.width = `${newW}px`;
                        panelRef.current.style.height = `${newH}px`;
                        panelRef.current.style.transform = '';
                        panelRef.current.style.left = `${newX}px`;
                        panelRef.current.style.top = `${newY}px`;
                    }
                });
            }
        };

        const handleMouseUp = (_e: MouseEvent) => {
            const wasDragging = isDragging.current;
            const wasResizing = !!isResizing.current;
            isDragging.current = false;
            isResizing.current = null;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);

            // Commit only when drag/resize happened to avoid unnecessary storage writes on every click.
            if (wasDragging || wasResizing) {
                const { x: tx, y: ty, width: tw, height: th } = transientState.current;
                setPosition(tx, ty);
                if (wasResizing) {
                    setSize(tw, th);
                }
            }

            // Restore overlay blur if mouse is released outside panel
            if (!panelRef.current?.contains(_e.target as Node)) {
                setOverlayInteraction(false);
            }
        };

        if (isOpen) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            // Default to non-interactive until mouse enters, allowing web browsing
            setOverlayInteraction(false);
        } else {
            setOverlayInteraction(false);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [isOpen, setPosition, setSize, setOverlayInteraction, getMinPanelWidth, getMinPanelHeight, getMaxPanelWidth, getMaxPanelHeight]);

    // Keep panel geometry valid after hydration/open and when viewport changes.
    useEffect(() => {
        if (!isOpen) return;

        const normalizeBounds = () => {
            const state = useUIStore.getState();
            const currentX = Number.isFinite(state.x) ? state.x : 20;
            const currentY = Number.isFinite(state.y) ? state.y : 20;
            const currentW = Number.isFinite(state.width) ? state.width : 380;
            const currentH = Number.isFinite(state.height) ? state.height : 600;

            if (state.isCollapsed) {
                const collapsedW = panelRef.current?.offsetWidth ?? 500;
                const minX = 0;
                const minY = 0;
                // If the panel happens to be larger than the screen, max bounds evaluate to negative.
                // We use Math.max(min, ...) to ensure it can still be dragged without bouncing off-screen
                // while ensuring max never drops below min.
                const maxX = Math.max(minX, window.innerWidth - Math.min(100, collapsedW));
                const maxY = Math.max(minY, window.innerHeight - 60);
                const nextX = clamp(currentX, minX, maxX);
                const nextY = clamp(currentY, minY, Math.max(minY, maxY));
                if (nextX !== currentX || nextY !== currentY) {
                    state.setPosition(nextX, nextY);
                }
                return;
            }

            const minW = getMinPanelWidth();
            const minH = getMinPanelHeight();
            const maxW = getMaxPanelWidth();
            const maxH = getMaxPanelHeight();
            const nextW = clamp(currentW, minW, maxW);
            const nextH = clamp(currentH, minH, maxH);
            const minX = 0;
            const minY = 0;
            const maxX = Math.max(minX, window.innerWidth - Math.min(100, nextW));
            const maxY = Math.max(minY, window.innerHeight - 60);
            const nextX = clamp(currentX, minX, maxX);
            // Math.max guarantees maxY never goes below 0, avoiding constraints trapping big panels 
            const nextY = clamp(currentY, minY, Math.max(minY, maxY));

            if (nextW !== currentW || nextH !== currentH) {
                state.setSize(nextW, nextH);
            }
            if (nextX !== currentX || nextY !== currentY) {
                state.setPosition(nextX, nextY);
            }

            // Keep transient values in sync so drag starts from normalized geometry.
            transientState.current = { x: nextX, y: nextY, width: nextW, height: nextH };
        };

        normalizeBounds();
        window.addEventListener('resize', normalizeBounds);

        return () => {
            window.removeEventListener('resize', normalizeBounds);
        };
    }, [isOpen, getMinPanelWidth, getMinPanelHeight, getMaxPanelWidth, getMaxPanelHeight]);

    // Click-through handling with async IPC protection
    const handleMouseEnter = () => {
        setOverlayInteraction(true);
    };

    const handleMouseLeave = () => {
        if (!isDragging.current && !isResizing.current) {
            setOverlayInteraction(false);
        }
    };

    // Handle Agent Approval
    const handleApproval = (approved: boolean) => {
        if (!pendingApproval) return;
        // @ts-ignore
        window.ipcRenderer?.agent?.respondToApproval(pendingApproval.id, approved);
        setPendingApproval(null);
    };

    // Handle Power Level Change
    const handleSetPowerLevel = (level: 1 | 2 | 3) => {
        // @ts-ignore
        window.ipcRenderer?.agent?.setPowerLevel(level);
        setPowerLevel(level);
    };

    const closePanel = useCallback(() => {
        if (isOverlayMode && window.ipcRenderer?.send) {
            window.ipcRenderer.send('ai:toggle');
            return;
        }
        setIsOpen(false);
    }, [isOverlayMode, setIsOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        // @ts-ignore
        if (!window.ipcRenderer) {
            addMessage({ role: 'assistant', content: 'Error: Agent is not available (ipcRenderer missing).' }, mode === 'agent' ? 'agent' : 'chat');
            return;
        }

        // Check API Key
        let apiKey = '';
        if (provider === 'openai') apiKey = openAIApiKey;
        if (provider === 'gemini') apiKey = googleApiKey;
        if (provider === 'anthropic') apiKey = anthropicApiKey;
        if (provider === 'github') apiKey = githubApiKey;
        if (provider === 'huggingface') apiKey = huggingFaceApiKey;
        if (provider === 'grok') apiKey = grokApiKey;
        if (provider === 'kimi') apiKey = kimiApiKey;

        if (!apiKey) {
            addMessage({
                role: 'assistant',
                content: `Please set your ${provider.toUpperCase()} API Key in Settings > AI & Intelligence.`
            }, mode === 'agent' ? 'agent' : 'chat');
            return;
        }

        const userMessage = input.trim();
        setInput('');

        // Auto-expand so the user can see the AI response
        if (isCollapsed) {
            setCollapsed(false);
        }

        // Add user message
        addMessage({ role: 'user', content: userMessage }, mode === 'agent' ? 'agent' : 'chat');
        setLoading(true);

        try {
            // BRANCH: AGENT MODE
            if (mode === 'agent') {
                // Determine model based on provider (defaults handled by backend if empty)
                let model = selectedModel || undefined;
                if (selectedModel === 'custom') model = customModel;

                // Call Agent Process
                // @ts-ignore
                // Wrap in immediate timeout to allow UI to update to loading state first
                await new Promise(r => setTimeout(r, 50));

                const result = await withTimeout(
                    window.ipcRenderer.agent.processRequest(userMessage, provider, apiKey, model),
                    60000,
                    'Agent request timed out after 60s'
                );

                if (!result) {
                    // Keep this branch for transport-level failures only.
                } else if (isAgentTerminalData(result.data)) {
                    addMessage({
                        role: 'assistant',
                        content: formatAgentTerminalMessage(result.data)
                    }, 'agent');
                } else if (result.success) {
                    addMessage({
                        role: 'assistant',
                        content: `**Task Complete**\n\nTask finished successfully.`
                    }, 'agent');
                } else {
                    addMessage({
                        role: 'assistant',
                        content: `**Task Failed**\n\n${result.error || 'Unknown error occurred.'}`
                    }, 'agent');
                }
            }
            // BRANCH: CHAT MODE (Legacy)
            else {
                let contextText = '';

                // Extract context if enabled
                if (includeContext) {
                    try {
                        // @ts-ignore
                        const html = await withTimeout(
                            window.ipcRenderer.invoke('view:get-html'),
                            5000,
                            'Context extraction timed out'
                        );

                        if (html) {
                            const doc = new DOMParser().parseFromString(html, 'text/html');
                            const reader = new Readability(doc);
                            const parsed = reader.parse();
                            if (parsed && parsed.textContent) {
                                contextText = parsed.textContent.slice(0, 10000); // Truncate
                            }
                        }
                    } catch (e) {
                        console.error('Context extraction failed:', e);
                        // Continue without context
                    }
                }

                const messagesPayload = [...chatMessages, { role: 'user', content: userMessage }].map(m => ({
                    role: m.role,
                    content: m.content
                }));

                // Prepend context
                if (contextText) {
                    const lastMsg = messagesPayload[messagesPayload.length - 1];
                    lastMsg.content = `Context from current page:\n${contextText}\n\nUser Question: ${lastMsg.content}`;
                }

                // Determine model based on selection (defaults handled by backend if empty)
                let model = selectedModel || undefined;
                if (selectedModel === 'custom') model = customModel;

                // @ts-ignore
                const response = await withTimeout(
                    window.ipcRenderer.ai.chatCompletion(provider, apiKey, messagesPayload, model),
                    30000,
                    'Chat completion timed out after 30s'
                );
                addMessage({ role: 'assistant', content: response }, 'chat');
            }

        } catch (error: any) {
            addMessage({ role: 'assistant', content: `Error: ${error.message}` }, mode === 'agent' ? 'agent' : 'chat');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Don't handle Enter during IME composition (prevents double-send on CJK/accented input)
        if (isComposingRef.current) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const isActivelyMoving = isDragging.current || !!isResizing.current;
    const renderedState = isActivelyMoving
        ? transientState.current
        : { x: safeX, y: safeY, width: safeW, height: safeH };

    if (!isOpen) return null;

    if (isCollapsed) {
        return (
            <div
                ref={panelRef}
                className="fixed z-[60] flex items-center gap-3 pl-2 pr-4 py-2 bg-background/80 backdrop-blur-2xl border border-white/10 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-in fade-in zoom-in-95 ring-1 ring-white/5"
                style={{
                    left: renderedState.x,
                    top: renderedState.y,
                    width: 'auto',
                    transition: isActivelyMoving ? 'none' : undefined,
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {/* Drag Handle */}
                <div
                    className="p-2 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground transition-colors"
                    onMouseDown={handleMouseDown}
                >
                    <Layers className="w-4 h-4" />
                </div>

                {/* Input */}
                <div className="relative group w-[320px] transition-all duration-300 focus-within:w-[450px]">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/20 to-amber-500/20 rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-xl -z-10 pointer-events-none" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => {
                            if (!isComposingRef.current) {
                                setInput(e.target.value);
                            }
                        }}
                        onCompositionStart={() => { isComposingRef.current = true; }}
                        onCompositionEnd={(e) => {
                            isComposingRef.current = false;
                            setInput((e.target as HTMLInputElement).value);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={mode === 'agent' ? "Agent command..." : "Ask AI..."}
                        className="w-full bg-white/5 border border-white/10 rounded-full pl-4 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:bg-white/10 focus:border-white/20 transition-all shadow-inner"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className={`p-1.5 rounded-full transition-all duration-200 ${!input.trim()
                                ? 'text-muted-foreground opacity-50'
                                : 'bg-primary text-white shadow-md hover:scale-105'
                                }`}
                        >
                            {isLoading ? <StopCircle className="w-3 h-3 animate-pulse" /> : <Send className="w-3 h-3" />}
                        </button>
                    </div>
                </div>

                <div className="w-px h-5 bg-white/10" />

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setMode(mode === 'agent' ? 'chat' : 'agent')}
                        className={`p-2 rounded-full transition-all ${mode === 'agent' ? 'text-amber-400 bg-amber-400/10' : 'text-muted-foreground hover:bg-white/5'}`}
                        title={mode === 'agent' ? "Switch to Chat" : "Switch to Agent"}
                    >
                        {mode === 'agent' ? <Zap className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </button>

                    <button
                        onClick={() => setCollapsed(false)}
                        className="p-2 hover:bg-white/10 rounded-full text-muted-foreground hover:text-foreground transition-all"
                        title="Expand"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>

                    <button
                        onClick={closePanel}
                        className="p-2 hover:bg-white/10 rounded-full text-muted-foreground hover:text-foreground transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    if (!isOpen) return null;
    if (!isMounted) return null; // Defer render until next frame to prevent mount freeze

    return (
        <div
            ref={panelRef}
            className={`ai-panel fixed bg-background/95 border-white/10 backdrop-blur-3xl border shadow-[0_12px_60px_rgba(0,0,0,0.25)] z-[60] flex flex-col font-sans rounded-[24px] overflow-hidden animate-in fade-in zoom-in-95 text-foreground`}
            style={{
                left: renderedState.x,
                top: renderedState.y,
                width: renderedState.width,
                height: renderedState.height,
                transition: isActivelyMoving ? 'none' : 'width 0.25s, height 0.25s',
                willChange: isActivelyMoving ? 'left, top, width, height' : undefined,
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Resize Handles (Invisible Hit Zones) */}
            <div className="absolute top-0 left-0 w-10 h-10 cursor-nw-resize z-30 bg-transparent" onMouseDown={(e) => handleResizeStart(e, 'nw')} />
            <div className="absolute top-0 right-0 w-10 h-10 cursor-ne-resize z-30 bg-transparent" onMouseDown={(e) => handleResizeStart(e, 'ne')} />
            <div className="absolute bottom-0 left-0 w-10 h-10 cursor-sw-resize z-30 bg-transparent" onMouseDown={(e) => handleResizeStart(e, 'sw')} />
            <div className="absolute bottom-0 right-0 w-10 h-10 cursor-se-resize z-30 bg-transparent" onMouseDown={(e) => handleResizeStart(e, 'se')} />

            <div className="absolute top-0 left-8 right-8 h-4 cursor-n-resize z-30 bg-transparent" onMouseDown={(e) => handleResizeStart(e, 'n')} />
            <div className="absolute bottom-0 left-8 right-8 h-4 cursor-s-resize z-30 bg-transparent" onMouseDown={(e) => handleResizeStart(e, 's')} />
            <div className="absolute left-0 top-8 bottom-8 w-4 cursor-w-resize z-30 bg-transparent" onMouseDown={(e) => handleResizeStart(e, 'w')} />
            <div className="absolute right-0 top-8 bottom-8 w-4 cursor-e-resize z-30 bg-transparent" onMouseDown={(e) => handleResizeStart(e, 'e')} />

            {/* Ambient Glow Effects */}
            <div className="absolute top-0 right-0 w-full h-48 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none opacity-40" />
            <div className="absolute bottom-0 right-0 w-full h-48 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none opacity-20" />

            {/* Header - Glassy & Minimal - Draggable */}
            <div
                className="h-12 flex items-center justify-between px-5 shrink-0 relative z-10 cursor-grab active:cursor-grabbing select-none"
                onMouseDown={handleMouseDown}
            >
                {/* Left: New AI Chat Title/Selector */}
                <div className="flex items-center gap-2 group cursor-pointer hover:bg-black/5 px-2 py-1 rounded-lg transition-colors -ml-2">
                    <span className="font-medium text-[14px] text-foreground/80">
                        {mode === 'agent' ? 'Continuum Agent' : 'New AI Chat'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground/80" />
                </div>

                {/* Right: Window Controls */}
                <div className="flex items-center gap-1.5 relative z-[60]">
                    <button
                        onClick={closePanel}
                        className="p-1.5 hover:bg-black/5 rounded-md text-muted-foreground hover:text-foreground transition-all duration-200"
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Controls Surface - Frosted Pill Container */}
            <div className="px-5 py-4 shrink-0 space-y-3 relative z-10">
                {/* Provider & Model Selector Row */}
                <div className="flex items-center justify-between gap-3 relative z-[60]">
                    <div className="relative flex-1 group">
                        <select
                            value={provider}
                            onChange={(e) => setProvider(e.target.value as any)}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl pl-3.5 pr-8 py-2 text-xs font-medium text-foreground appearance-none outline-none transition-all cursor-pointer backdrop-blur-sm shadow-sm"
                        >
                            <option value="openai">OpenAI</option>
                            <option value="gemini">Gemini</option>
                            <option value="anthropic">Claude</option>
                            <option value="github">GitHub</option>
                            <option value="huggingface">HuggingFace</option>
                            <option value="grok">Grok</option>
                            <option value="kimi">Kimi</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors pointer-events-none" />
                    </div>

                    <div className="relative flex-[1.5] group">
                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl pl-3.5 pr-8 py-2 text-xs font-medium text-muted-foreground hover:text-foreground appearance-none outline-none transition-all cursor-pointer backdrop-blur-sm shadow-sm"
                        >
                            {(availableModels[provider] || []).map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                            <option value="custom">Custom...</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors pointer-events-none" />
                    </div>
                </div>

                {/* Custom Model Input */}
                {selectedModel === 'custom' && (
                    <input
                        type="text"
                        value={customModel}
                        onChange={(e) => setCustomModel(e.target.value)}
                        placeholder="Model ID (e.g. gemini-1.5-pro)"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs animate-in fade-in slide-in-from-top-1 focus:bg-white/10 focus:border-primary/30 outline-none transition-all relative z-[60]"
                    />
                )}

                {/* Mode Switcher - Glass Segmented Control */}
                <div className="flex p-1 bg-black/20 rounded-xl border border-white/5 backdrop-blur-md shadow-inner relative z-[60]">
                    <button
                        onClick={() => setMode('chat')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${mode === 'chat'
                            ? 'bg-white/10 text-white shadow-sm border border-white/5'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                            }`}
                    >
                        <Bot className="w-3.5 h-3.5" />
                        Chat
                    </button>
                    <button
                        onClick={() => {
                            setMode('agent');
                            if (powerLevel === 1) handleSetPowerLevel(2);
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${mode === 'agent'
                            ? 'bg-amber-500/20 text-amber-200 shadow-sm border border-amber-500/10'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                            }`}
                    >
                        <Zap className="w-3.5 h-3.5" />
                        Agent
                    </button>
                    <button
                        onClick={() => setMode('batch')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${mode === 'batch'
                            ? 'bg-blue-500/20 text-blue-200 shadow-sm border border-blue-500/10'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                            }`}
                    >
                        <Layers className="w-3.5 h-3.5" />
                        Batch
                    </button>
                </div>

                {/* Power Level Indicator (Agent Mode Only) */}
                {mode === 'agent' && (
                    <div className="flex items-center justify-between px-1 pt-1 animate-in fade-in slide-in-from-top-1 relative z-[60]">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
                            <Shield className="w-3 h-3" />
                            Autonomy Level
                        </span>
                        <div className="flex gap-1.5">
                            {[1, 2, 3].map((level) => (
                                <button
                                    key={level}
                                    onClick={() => handleSetPowerLevel(level as 1 | 2 | 3)}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all duration-200 border ${powerLevel === level
                                        ? 'bg-amber-500 text-black border-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.3)] scale-105'
                                        : 'bg-white/5 text-muted-foreground border-transparent hover:bg-white/10 hover:text-foreground'
                                        }`}
                                    title={level === 1 ? "Read Only" : level === 2 ? "Assistant (Safe)" : "Autonomous Agent"}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {mode === 'batch' ? (
                <BatchPanel />
            ) : (
                <>
                    {/* Messages Area - Clean & Spacious */}
                    {(() => {
                        const currentMessages = mode === 'agent' ? agentMessages : chatMessages;
                        return (
                            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent" ref={scrollRef}>
                                {currentMessages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 space-y-4 animate-in fade-in duration-700">
                                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center backdrop-blur-sm">
                                            {mode === 'chat' ? <Bot className="w-10 h-10 opacity-50" /> : <Zap className="w-10 h-10 opacity-50" />}
                                        </div>
                                        <p className="text-sm text-center px-10 font-light">
                                            {mode === 'chat'
                                                ? "Ask questions about the current page content."
                                                : "I can navigate, click, and fill forms autonomously."}
                                        </p>
                                    </div>
                                )}

                                <MemoizedMessageList messages={currentMessages} />

                                <MemoizedAgentActivity activity={activity} isLoading={isLoading} />

                                <MemoizedApprovalCard pendingApproval={pendingApproval} onApprove={handleApproval} />

                                <div className="h-4" /> {/* Spacer */}
                            </div>
                        );
                    })()}

                    {/* Input Area - Floating Glass Dock */}
                    <div className="p-4 bg-transparent shrink-0">
                        <div className="relative group bg-white/[0.06] backdrop-blur-xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.3)] rounded-[20px] p-2 transition-all focus-within:shadow-[0_8px_30px_rgba(0,0,0,0.4)] focus-within:bg-white/[0.09] focus-within:border-white/20">
                            {/* Textarea */}
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => {
                                    if (!isComposingRef.current) {
                                        setInput(e.target.value);
                                    }
                                }}
                                onCompositionStart={() => { isComposingRef.current = true; }}
                                onCompositionEnd={(e) => {
                                    isComposingRef.current = false;
                                    // Sync the final composed value
                                    setInput((e.target as HTMLTextAreaElement).value);
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder='Write, or press "@" to add context'
                                className="w-full bg-transparent pl-3 pr-3 pt-2 text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none min-h-[50px]"
                                rows={2}
                            />

                            {/* Bottom Input Controls inside the pill */}
                            <div className="flex items-center justify-between px-2 pt-2">
                                <div className="flex items-center gap-1">
                                    {/* Attachment Icon */}
                                    <button className="p-1.5 rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors">
                                        <Paperclip className="w-[18px] h-[18px]" strokeWidth={2} />
                                    </button>

                                    {/* Inline Model Selector (✨ Auto) */}
                                    <div className="relative ml-2">
                                        <select
                                            value={selectedModel}
                                            onChange={(e) => setSelectedModel(e.target.value)}
                                            className="appearance-none bg-white/10 hover:bg-white/15 text-foreground/80 font-medium text-[13px] pl-7 pr-8 py-1.5 rounded-full outline-none cursor-pointer transition-colors"
                                        >
                                            <option value="">Auto</option>
                                            {(availableModels[provider] || []).map(m => (
                                                <option key={m.id} value={m.id}>{m.name.split(' ')[0]}</option>
                                            ))}
                                            <option value="custom">Custom</option>
                                        </select>
                                        <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/50 pointer-events-none" />
                                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/50 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Send Arrow */}
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || isLoading || (mode === 'agent' && !!pendingApproval)}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${!input.trim()
                                        ? 'bg-white/10 text-muted-foreground/50 cursor-not-allowed'
                                        : 'bg-primary text-white shadow-md hover:scale-105'
                                        }`}
                                >
                                    {isLoading ? <StopCircle className="w-4 h-4 animate-pulse" /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// Separate Component to keep main panel clean
function BatchPanel() {
    const [urls, setUrls] = useState('');
    const [goal, setGoal] = useState('');
    // const [jobs, setJobs] = useState<any[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    // Poll status
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                // @ts-ignore
                const status = await window.ipcRenderer.agent.getWorkflowStatus();
                if (status) {
                    setIsRunning(status.isRunning);
                    // We need active job details if possible, but for now we rely on status
                }
            } catch (e) { }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const startBatch = async () => {
        const urlList = urls.split('\n').map(u => u.trim()).filter(u => u.length > 0);
        if (urlList.length === 0 || !goal) return;

        try {
            setIsRunning(true);
            // @ts-ignore
            await window.ipcRenderer.agent.startBatch(urlList, goal);
        } catch (e) {
            console.error(e);
            setIsRunning(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto">
            <div className="space-y-2.5">
                <label className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <FileText className="w-3 h-3" />
                    Target URLs
                </label>
                <textarea
                    value={urls}
                    onChange={e => setUrls(e.target.value)}
                    className="w-full h-40 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-xl text-xs p-4 resize-none focus:bg-white/10 focus:border-blue-500/50 outline-none font-mono leading-relaxed transition-all shadow-inner"
                    placeholder={`https://example.com/job1\nhttps://example.com/job2`}
                />
            </div>

            <div className="space-y-2.5">
                <label className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Bot className="w-3 h-3" />
                    Action Goal
                </label>
                <input
                    type="text"
                    value={goal}
                    onChange={e => setGoal(e.target.value)}
                    className="w-full bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-xl text-xs p-4 outline-none focus:bg-white/10 focus:border-blue-500/50 transition-all shadow-inner"
                    placeholder="e.g. Apply for this job using my profile"
                />
            </div>

            <button
                onClick={startBatch}
                disabled={isRunning || !urls || !goal}
                className={`w-full relative overflow-hidden rounded-xl py-3.5 text-sm font-bold flex items-center justify-center gap-2.5 transition-all duration-300 ${isRunning || !urls || !goal
                    ? 'bg-white/5 text-muted-foreground cursor-not-allowed border border-white/5'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] border border-blue-400/20'
                    }`}
            >
                {isRunning ? <Bot className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                {isRunning ? 'Running Batch Workflow...' : 'Start Automation Sequence'}
            </button>

            {/* Status Area */}
            <div className="border border-white/10 rounded-xl p-5 bg-black/20 flex-1 backdrop-blur-md shadow-inner relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Activity className="w-24 h-24" />
                </div>

                <div className="flex items-center gap-2.5 mb-4 relative z-10">
                    <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
                        <Activity className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <span className="text-xs font-semibold text-foreground/80 tracking-tight">Queue Status</span>
                </div>

                <div className="relative z-10">
                    {isRunning ? (
                        <div className="space-y-2">
                            <div className="text-xs text-blue-300 animate-pulse font-mono flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                                Processing job queue...
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono pl-3.5 border-l border-white/10">
                                Check terminal for detailed logs
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-muted-foreground/40 italic font-mono flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                            System ready. Waiting for input.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
