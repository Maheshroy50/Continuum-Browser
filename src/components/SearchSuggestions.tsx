import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Star, Search, Play } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Suggestion } from '../hooks/useSuggestions';

function highlightMatch(text: string, query: string): ReactNode {
    if (typeof text !== 'string' || typeof query !== 'string') return String(text || '');
    const trimmed = query.trim();
    if (!trimmed) return text;
    // ... rest of function consistent with original
    const lowerText = text.toLowerCase();
    const lowerQuery = trimmed.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + trimmed.length);
    const after = text.slice(idx + trimmed.length);
    return (
        <>
            {before}
            <span className="text-primary/90 font-medium">{match}</span>
            {after}
        </>
    );
}

interface SuggestionGroupProps {
    title: string;
    icon: React.ReactNode;
    suggestions: Suggestion[];
    selectedIndex: number;
    startIndex: number;
    onSelect: (suggestion: Suggestion) => void;
    onHover: (index: number) => void;
    query: string;
    isSpecial?: boolean;  // For Continue section
}

function SuggestionGroup({
    title,
    icon,
    suggestions,
    selectedIndex,
    startIndex,
    onSelect,
    onHover,
    query,
    isSpecial = false
}: SuggestionGroupProps) {
    if (suggestions.length === 0) return null;

    return (
        <div className={`py-2 ${isSpecial ? 'bg-primary/5' : ''}`}>
            <div className="px-3 pb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {icon}
                {title}
            </div>
            {suggestions.map((suggestion, i) => {
                const globalIndex = startIndex + i;
                const isSelected = globalIndex === selectedIndex;

                return (
                    <button
                        key={suggestion.id}
                        onClick={() => onSelect(suggestion)}
                        onMouseEnter={() => onHover(globalIndex)}
                        className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${isSelected
                            ? 'bg-primary/15 text-foreground'
                            : isSpecial
                                ? 'text-foreground hover:bg-primary/10'
                                : 'text-foreground hover:bg-muted/50'
                            }`}
                    >
                        {/* Favicon or default icon */}
                        {suggestion.favicon ? (
                            <img
                                src={suggestion.favicon}
                                alt=""
                                className="w-4 h-4 rounded-sm"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        ) : (
                            <div className={`w-4 h-4 rounded-sm flex items-center justify-center ${isSpecial ? 'bg-primary/20 text-primary' : 'bg-muted'
                                }`}>
                                {suggestion.type === 'search' && <Search className="w-3 h-3" />}
                                {suggestion.type === 'history' && <Clock className="w-3 h-3" />}
                                {suggestion.type === 'bookmark' && <Star className="w-3 h-3" />}
                                {suggestion.type === 'workspace' && <Play className="w-3 h-3" />}
                            </div>
                        )}

                        {/* Title and metadata */}
                        <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{highlightMatch(suggestion.title, query)}</div>
                            {suggestion.type !== 'search' && (
                                <div className="text-[11px] text-muted-foreground truncate">
                                    {highlightMatch(suggestion.url, query)}
                                </div>
                            )}
                        </div>

                        {/* Workspace badge - more prominent for Continue */}
                        {suggestion.workspaceName && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isSpecial
                                ? 'bg-primary/20 text-primary'
                                : 'bg-primary/10 text-primary'
                                }`}>
                                {suggestion.workspaceName}
                            </span>
                        )}

                        {/* Type indicator for bookmarks */}
                        {suggestion.type === 'bookmark' && (
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}


interface SearchSuggestionsProps {
    suggestions: {
        continue: Suggestion[];
        history: Suggestion[];
        bookmarks: Suggestion[];
        search: Suggestion[];
    };
    selectedIndex: number;
    onSelect: (suggestion: Suggestion) => void;
    onHover: (index: number) => void;
    inputRect: DOMRect | null;
    query: string;
}

export function SearchSuggestions({
    suggestions,
    selectedIndex,
    onSelect,
    onHover,
    inputRect,
    query
}: SearchSuggestionsProps) {
    const { t } = useTranslation();

    // Note: No longer grouping history here - using direct from useSuggestions to keep indices consistent
    const hasAnySuggestions =
        (suggestions.continue && suggestions.continue.length > 0) ||
        (suggestions.history && suggestions.history.length > 0) ||
        (suggestions.bookmarks && suggestions.bookmarks.length > 0) ||
        (suggestions.search && suggestions.search.length > 0);

    if (!hasAnySuggestions || !inputRect) return null;

    // Calculate starting indices for each group
    let currentIndex = 0;
    const continueStart = currentIndex;
    currentIndex += suggestions.continue.length;

    const historyStart = currentIndex;
    currentIndex += suggestions.history.length;

    const bookmarksStart = currentIndex;
    currentIndex += suggestions.bookmarks.length;

    const searchStart = currentIndex;

    // Detect macOS for keyboard hint
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? '⌘' : 'Ctrl';

    const dropdown = (
        <div
            className="search-suggestions-dropdown fixed bg-popover/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[400px] overflow-y-auto animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-150"
            data-search-suggestions="true"
            style={{
                top: inputRect.bottom + 8,
                left: inputRect.left,
                width: inputRect.width,
                zIndex: 9999,
            }}
        >
            {/* Continue (Workspace pages) - Special styling */}
            {suggestions.continue.length > 0 && (
                <SuggestionGroup
                    title={String(t('suggestions.continue', 'Continue'))}
                    icon={<Play className="w-3 h-3" />}
                    suggestions={suggestions.continue}
                    selectedIndex={selectedIndex}
                    startIndex={continueStart}
                    onSelect={onSelect}
                    onHover={onHover}
                    query={query}
                    isSpecial={true}
                />
            )}

            {/* History */}
            <SuggestionGroup
                title={String(t('suggestions.history', 'History'))}
                icon={<Clock className="w-3 h-3" />}
                suggestions={suggestions.history}
                selectedIndex={selectedIndex}
                startIndex={historyStart}
                onSelect={onSelect}
                onHover={onHover}
                query={query}
            />

            {/* Bookmarks */}
            <SuggestionGroup
                title={String(t('suggestions.bookmarks', 'Bookmarks'))}
                icon={<Star className="w-3 h-3" />}
                suggestions={suggestions.bookmarks}
                selectedIndex={selectedIndex}
                startIndex={bookmarksStart}
                onSelect={onSelect}
                onHover={onHover}
                query={query}
            />

            {/* Search */}
            <SuggestionGroup
                title={String(t('suggestions.search', 'Search'))}
                icon={<Search className="w-3 h-3" />}
                suggestions={suggestions.search}
                selectedIndex={selectedIndex}
                startIndex={searchStart}
                onSelect={onSelect}
                onHover={onHover}
                query={query}
            />

            {/* Keyboard Hints Footer */}
            <div className="px-3 py-2 border-t border-white/5 bg-muted/30 flex items-center justify-center gap-4 text-[10px] text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-background/50 border border-white/10 rounded text-[9px] min-w-[1.5em] text-center">↵</kbd> Open</span>
                <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-background/50 border border-white/10 rounded text-[9px] min-w-[1.5em] text-center">{modKey}↵</kbd> New Tab</span>
                <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-background/50 border border-white/10 rounded text-[9px] min-w-[1.5em] text-center">↑↓</kbd> Navigate</span>
            </div>
        </div>
    );

    return createPortal(dropdown, document.body);
}

export default SearchSuggestions;
