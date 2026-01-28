import { useMemo } from 'react';
import { useFlowStore } from '../store/useFlowStore';

export interface Suggestion {
    id: string;
    type: 'workspace' | 'history' | 'bookmark' | 'search';
    title: string;
    url: string;
    workspaceName?: string;
    workspaceId?: string;
    favicon?: string;
    score: number;
    timestamp?: number;
}

interface GroupedSuggestions {
    continue: Suggestion[];
    history: Suggestion[];
    bookmarks: Suggestion[];
    search: Suggestion[];
}

// Fuzzy match helper - checks if query appears in text
function fuzzyMatch(text: string, query: string): boolean {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    return lowerText.includes(lowerQuery);
}

// Score a suggestion based on relevance
function scoreSuggestion(
    title: string,
    url: string,
    query: string,
    type: 'workspace' | 'history' | 'bookmark' | 'search',
    timestamp?: number
): number {
    let score = 0;
    const lowerQuery = query.toLowerCase();
    const lowerTitle = title.toLowerCase();
    const lowerUrl = url.toLowerCase();

    // Exact match bonuses
    if (lowerTitle === lowerQuery) score += 15;
    if (lowerUrl === lowerQuery) score += 12;

    // Starts with query
    if (lowerTitle.startsWith(lowerQuery)) score += 8;
    if (lowerUrl.startsWith(lowerQuery)) score += 6;

    // Contains query
    if (lowerTitle.includes(lowerQuery)) score += 4;
    if (lowerUrl.includes(lowerQuery)) score += 3;

    // Type bonuses (workspace > bookmark > history)
    if (type === 'workspace') score += 5;
    if (type === 'bookmark') score += 4;
    if (type === 'history') score += 3;

    // Recency bonus
    if (timestamp) {
        const hoursSince = (Date.now() - timestamp) / (1000 * 60 * 60);
        if (hoursSince < 1) score += 5;       // Last hour
        else if (hoursSince < 24) score += 3; // Last day
        else if (hoursSince < 168) score += 1; // Last week
    }

    return score;
}

export function useSuggestions(query: string, searchEngine: string = 'Google'): GroupedSuggestions {
    const flows = useFlowStore(state => state.flows);
    const history = useFlowStore(state => state.history);
    const bookmarks = useFlowStore(state => state.bookmarks);

    return useMemo(() => {
        const result: GroupedSuggestions = {
            continue: [],
            history: [],
            bookmarks: [],
            search: [],
        };

        const trimmedQuery = query.trim().toLowerCase();

        // No suggestions for empty query
        if (!trimmedQuery) {
            return result;
        }

        // Track seen URLs to avoid duplicates
        const seenUrls = new Set<string>();

        // 1. WORKSPACE PAGES (Continue section)
        flows.forEach(flow => {
            flow.pages.forEach(page => {
                if (seenUrls.has(page.url)) return;

                const matchesTitle = fuzzyMatch(page.title, trimmedQuery);
                const matchesUrl = fuzzyMatch(page.url, trimmedQuery);

                if (matchesTitle || matchesUrl) {
                    seenUrls.add(page.url);
                    result.continue.push({
                        id: `workspace-${flow.id}-${page.id}`,
                        type: 'workspace',
                        title: page.title,
                        url: page.url,
                        workspaceName: flow.title,
                        workspaceId: flow.id,
                        favicon: page.favicon,
                        score: scoreSuggestion(page.title, page.url, trimmedQuery, 'workspace', page.lastVisited),
                        timestamp: page.lastVisited,
                    });
                }
            });
        });

        // 2. BOOKMARKS
        bookmarks.forEach(bookmark => {
            if (seenUrls.has(bookmark.url)) return;

            const matchesTitle = fuzzyMatch(bookmark.title, trimmedQuery);
            const matchesUrl = fuzzyMatch(bookmark.url, trimmedQuery);

            if (matchesTitle || matchesUrl) {
                seenUrls.add(bookmark.url);
                result.bookmarks.push({
                    id: `bookmark-${bookmark.url}`,
                    type: 'bookmark',
                    title: bookmark.title,
                    url: bookmark.url,
                    favicon: bookmark.favicon,
                    score: scoreSuggestion(bookmark.title, bookmark.url, trimmedQuery, 'bookmark', bookmark.createdAt),
                    timestamp: bookmark.createdAt,
                });
            }
        });

        // 3. HISTORY (exclude already shown workspace pages and bookmarks)
        history.forEach(item => {
            if (seenUrls.has(item.url)) return;

            const matchesTitle = fuzzyMatch(item.title, trimmedQuery);
            const matchesUrl = fuzzyMatch(item.url, trimmedQuery);

            if (matchesTitle || matchesUrl) {
                seenUrls.add(item.url);
                result.history.push({
                    id: `history-${item.url}-${item.timestamp}`,
                    type: 'history',
                    title: item.title,
                    url: item.url,
                    favicon: undefined,  // HistoryItem doesn't have favicon
                    score: scoreSuggestion(item.title, item.url, trimmedQuery, 'history', item.timestamp),
                    timestamp: item.timestamp,
                });
            }
        });

        // Sort each group by score (descending)
        result.continue.sort((a, b) => b.score - a.score);
        result.bookmarks.sort((a, b) => b.score - a.score);
        result.history.sort((a, b) => b.score - a.score);

        // Limit results
        result.continue = result.continue.slice(0, 5);
        result.bookmarks = result.bookmarks.slice(0, 3);
        result.history = result.history.slice(0, 5);

        // 4. SEARCH SUGGESTION (always show as fallback)
        result.search.push({
            id: 'search-suggestion',
            type: 'search',
            title: `Search "${query}" on ${searchEngine}`,
            url: query,
            score: 0,
        });

        return result;
    }, [query, flows, history, bookmarks, searchEngine]);
}

export default useSuggestions;
