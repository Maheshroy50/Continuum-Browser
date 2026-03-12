import React, { useState, useRef } from 'react';
import { Search, Mic, ArrowUp, Plus, Ghost, MessageSquare, AtSign, Sparkles, BookOpen, GraduationCap, Microscope } from 'lucide-react';
import { useFlowStore } from '../store/useFlowStore';

// Search engines configuration
const SEARCH_ENGINES = {
    google: { name: 'Google', url: 'https://www.google.com/search?q=' },
    yahoo: { name: 'Yahoo', url: 'https://search.yahoo.com/search?p=' },
};

export function NewTabPage() {
    const { activeFlowId, addPageToFlow } = useFlowStore();
    const [inputValue, setInputValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && activeFlowId) {
            let url = inputValue.trim();
            const isUrl = /^https?:\/\//i.test(url) || /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/.test(url);

            if (!isUrl) {
                url = SEARCH_ENGINES.google.url + encodeURIComponent(url);
            } else if (!/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
            }

            const newPageId = crypto.randomUUID();
            addPageToFlow(activeFlowId, {
                id: newPageId,
                url,
                title: inputValue,
                favicon: '',
                lastVisited: Date.now()
            });
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-[#0F1115] text-[#9EAab7] relative overflow-hidden font-sans selection:bg-cyan-500/30">
            {/* Background Ambience - Cyan/Blue Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-cyan-900/10 blur-[120px] rounded-full pointer-events-none" />

            {/* Centered Content */}
            <div className="z-10 w-full max-w-[640px] px-4 flex flex-col items-center gap-8 animate-in fade-in zoom-in-95 duration-500">

                {/* Central Icon (Ghost/Avatar) */}
                <div className="w-12 h-12 rounded-2xl bg-[#1A1D21] border border-white/5 flex items-center justify-center shadow-xl shadow-black/20">
                    <Ghost className="w-6 h-6 text-cyan-400/80" />
                </div>

                {/* Omni-Input Container */}
                <form
                    onSubmit={handleSearch}
                    onClick={() => inputRef.current?.focus()}
                    className={`
                        w-full group relative flex flex-col justify-center gap-2 
                        bg-[#131519] border transition-all duration-300 ease-out
                        ${isFocused
                            ? 'border-cyan-500/30 shadow-[0_0_50px_-10px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/20'
                            : 'border-white/5 hover:border-white/10 shadow-2xl shadow-black/50'
                        }
                        rounded-[20px] p-3
                    `}
                >
                    <div className="flex items-center gap-3 pl-2">
                        <Search className={`w-5 h-5 ${isFocused ? 'text-cyan-400' : 'text-zinc-600'} transition-colors`} />

                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            className="flex-1 bg-transparent border-none outline-none text-[17px] text-white placeholder:text-zinc-600 h-8"
                            placeholder="Search your history..."
                            autoFocus
                        />
                    </div>

                    {/* Input Bottom Action Row */}
                    <div className="flex items-center justify-between pl-1 pr-1 pt-1">
                        {/* Left Action: Add tabs */}
                        <button type="button" className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 text-xs font-medium text-zinc-500 transition-colors">
                            <div className="w-4 h-4 rounded-full border border-zinc-700 flex items-center justify-center">
                                <Plus className="w-2.5 h-2.5" />
                            </div>
                            <span>Add tabs or files</span>
                            <span className="text-zinc-700 mx-1">···</span>
                        </button>

                        {/* Right Actions */}
                        <div className="flex items-center gap-2">
                            <button type="button" className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-600 hover:text-cyan-400 transition-colors">
                                <Mic className="w-4 h-4" />
                            </button>
                            <button
                                type="submit"
                                disabled={!inputValue}
                                className={`
                                    p-1.5 rounded-lg transition-all duration-200
                                    ${inputValue
                                        ? 'bg-zinc-700 text-white hover:bg-zinc-600'
                                        : 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                                    }
                                `}
                            >
                                <ArrowUp className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </form>

                {/* Action Pills Row */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <ActionPill icon={MessageSquare} label="Chat with any tab" />
                    <ActionPill icon={AtSign} label="Mention tabs" />
                    <ActionPill icon={Sparkles} label="Skills" hasDropdown />
                    <ActionPill icon={BookOpen} label="Explain" />
                    <ActionPill icon={GraduationCap} label="Learn Skills" />
                    <ActionPill icon={Microscope} label="Research" />
                </div>
            </div>

            {/* Corner Stats (Visual only) */}
            <div className="absolute bottom-4 right-6 flex items-center gap-4 text-[11px] font-medium text-zinc-700 tracking-wide">
                <span>Supports Markdown</span>
                <span className="w-px h-3 bg-zinc-800" />
                <span>0 words</span>
                <span>0 chars</span>
            </div>
        </div>
    );
}

function ActionPill({ icon: Icon, label, hasDropdown }: { icon: any, label: string, hasDropdown?: boolean }) {
    return (
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#181A1F] border border-white/5 hover:border-white/10 hover:bg-[#202329] text-[13px] text-zinc-400 hover:text-zinc-200 transition-all cursor-default">
            <Icon className="w-3.5 h-3.5 opacity-70" />
            <span>{label}</span>
            {hasDropdown && <span className="opacity-50 ml-0.5">▼</span>}
        </button>
    );
}
