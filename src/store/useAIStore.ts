import { create } from 'zustand';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export interface AgentActivity {
    state: 'idle' | 'reading' | 'thinking' | 'proposing' | 'awaiting_approval' | 'executing' | 'verifying' | 'persisting' | 'complete' | 'error';
    message?: string;
    intentId?: string;
    // Granular Status UI fields
    progress?: number;
    attempt?: number;
    maxAttempts?: number;
    summary?: string;
    manualSteps?: string[];
    details?: string;
    icon?: string;
}

export interface ApprovalRequest {
    id: string;
    intent: any;
    origin: string;
    affectedElements: string[];
    consequences: string;
    timestamp: number;
}

interface AIState {
    chatMessages: ChatMessage[];
    agentMessages: ChatMessage[];
    isLoading: boolean;
    provider: 'openai' | 'gemini' | 'anthropic' | 'github' | 'huggingface' | 'grok' | 'kimi';
    includeContext: boolean;
    isOpen: boolean;

    // Agent State
    powerLevel: 1 | 2 | 3;
    activity: AgentActivity;
    pendingApproval: ApprovalRequest | null;

    // Actions
    setIsOpen: (isOpen: boolean) => void;
    toggleIsOpen: () => void;
    setProvider: (provider: 'openai' | 'gemini' | 'anthropic' | 'github' | 'huggingface' | 'grok' | 'kimi') => void;
    setIncludeContext: (include: boolean) => void;

    // Updated Action: requires 'type' to know where to add
    addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>, type?: 'chat' | 'agent') => void;
    clearChat: (type?: 'chat' | 'agent') => void;
    setLoading: (loading: boolean) => void;

    // Agent Actions
    setPowerLevel: (level: 1 | 2 | 3) => void;
    setActivity: (activity: AgentActivity) => void;
    setPendingApproval: (request: ApprovalRequest | null) => void;
}

export const useAIStore = create<AIState>((set) => ({
    chatMessages: [],
    agentMessages: [],
    isLoading: false,
    provider: 'openai', // Default
    includeContext: true,
    isOpen: false,

    // Agent Defaults
    powerLevel: 1, // Default to Reader
    activity: { state: 'idle' },
    pendingApproval: null,

    setIsOpen: (isOpen) => set({ isOpen }),
    toggleIsOpen: () => set((state) => ({ isOpen: !state.isOpen })),
    setProvider: (provider) => set({ provider }),
    setIncludeContext: (includeContext) => set({ includeContext }),

    addMessage: (message, type = 'chat') => set((state) => {
        const newMessage = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            ...message
        };

        if (type === 'agent') {
            return { agentMessages: [...state.agentMessages, newMessage] };
        }
        return { chatMessages: [...state.chatMessages, newMessage] };
    }),

    clearChat: (type = 'chat') => set((_) => {
        if (type === 'agent') {
            return { agentMessages: [] };
        }
        return { chatMessages: [] };
    }),
    setLoading: (isLoading) => set({ isLoading }),

    setPowerLevel: (powerLevel) => set({ powerLevel }),
    setActivity: (activity) => set({ activity }),
    setPendingApproval: (pendingApproval) => set({ pendingApproval }),
}));
