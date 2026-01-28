import { create } from 'zustand';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

interface AIState {
    messages: ChatMessage[];
    isLoading: boolean;
    provider: 'openai' | 'gemini' | 'anthropic';
    includeContext: boolean;
    isOpen: boolean;

    // Actions
    setIsOpen: (isOpen: boolean) => void;
    setProvider: (provider: 'openai' | 'gemini' | 'anthropic') => void;
    setIncludeContext: (include: boolean) => void;
    addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
    clearChat: () => void;
    setLoading: (loading: boolean) => void;
}

export const useAIStore = create<AIState>((set) => ({
    messages: [],
    isLoading: false,
    provider: 'openai', // Default
    includeContext: true,
    isOpen: false,

    setIsOpen: (isOpen) => set({ isOpen }),
    setProvider: (provider) => set({ provider }),
    setIncludeContext: (includeContext) => set({ includeContext }),

    addMessage: (message) => set((state) => ({
        messages: [
            ...state.messages,
            {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                ...message
            }
        ]
    })),

    clearChat: () => set({ messages: [] }),
    setLoading: (isLoading) => set({ isLoading }),
}));
