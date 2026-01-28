import { useState, useRef, useEffect } from 'react';

import { Send, Bot, X, Sparkles, FileText, StopCircle } from 'lucide-react';
import { useAIStore } from '../store/useAIStore';
import { useSettingsStore } from '../store/useSettingsStore';

import ReactMarkdown from 'react-markdown';
import { Readability } from '@mozilla/readability';

export function AIPanel() {
    // t is unused
    // const { t } = useTranslation();

    const {
        isOpen, setIsOpen,
        messages, addMessage,
        isLoading, setLoading,
        provider, setProvider,
        includeContext, setIncludeContext
    } = useAIStore();

    const { openAIApiKey, googleApiKey, anthropicApiKey } = useSettingsStore();

    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    // Auto-focus input
    useEffect(() => {
        if (isOpen && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        // Check API Key
        let apiKey = '';
        if (provider === 'openai') apiKey = openAIApiKey;
        if (provider === 'gemini') apiKey = googleApiKey;
        if (provider === 'anthropic') apiKey = anthropicApiKey;

        if (!apiKey) {
            addMessage({
                role: 'assistant',
                content: `Please set your ${provider.toUpperCase()} API Key in Settings > AI & Intelligence.`
            });
            return;
        }

        const userMessage = input.trim();
        setInput('');
        addMessage({ role: 'user', content: userMessage });
        setLoading(true);

        try {
            let contextText = '';

            // Extract context if enabled
            if (includeContext) {
                try {
                    // @ts-ignore
                    const html = await window.ipcRenderer.invoke('view:get-html');

                    if (html) {
                        const doc = new DOMParser().parseFromString(html, 'text/html');
                        const reader = new Readability(doc);
                        const parsed = reader.parse();
                        if (parsed && parsed.textContent) {
                            contextText = parsed.textContent.slice(0, 10000); // Truncate to avoid huge prompts
                        }
                    }
                } catch (e) {
                    console.error('Context extraction failed:', e);
                }
            }

            const messagesPayload = [...messages, { role: 'user', content: userMessage }].map(m => ({
                role: m.role,
                content: m.content
            }));

            // Prepend context to the last user message or system message
            if (contextText) {
                const lastMsg = messagesPayload[messagesPayload.length - 1];
                lastMsg.content = `Context from current page:\n${contextText}\n\nUser Question: ${lastMsg.content}`;
            }

            // @ts-ignore
            const response = await window.ipcRenderer.ai.chatCompletion(provider, apiKey, messagesPayload);

            addMessage({ role: 'assistant', content: response });

        } catch (error: any) {
            addMessage({ role: 'assistant', content: `Error: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-0 right-0 bottom-0 w-96 bg-background border-l border-border shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-muted/30">
                <div className="flex items-center gap-2 font-medium">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <span>Continuum AI</span>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value as any)}
                        className="bg-transparent text-xs border border-border rounded px-2 py-1 outline-none"
                    >
                        <option value="openai">OpenAI</option>
                        <option value="gemini">Gemini</option>
                        <option value="anthropic">Claude</option>
                    </select>
                    <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-muted rounded text-muted-foreground transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2">
                        <Bot className="w-12 h-12" />
                        <p className="text-sm">Ask me anything about this page.</p>
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                            className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed ${msg.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground'
                                }`}
                        >
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-muted rounded-lg px-4 py-3 flex gap-1">
                            <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-border bg-background">
                {/* Context Toggle */}
                <label className="flex items-center gap-2 text-xs text-muted-foreground mb-3 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={includeContext}
                        onChange={(e) => setIncludeContext(e.target.checked)}
                        className="rounded border-neutral-600 bg-neutral-800 text-primary focus:ring-primary/50"
                    />
                    <FileText className="w-3 h-3" />
                    <span>Include page context</span>
                </label>

                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="w-full bg-muted/50 border border-border rounded-lg pl-3 pr-10 py-3 text-sm focus:outline-none focus:border-primary/50 resize-none max-h-32"
                        rows={1}
                        style={{ minHeight: '44px' }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 bottom-2 p-1.5 bg-primary text-primary-foreground rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                    >
                        {isLoading ? <StopCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
