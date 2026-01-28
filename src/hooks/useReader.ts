import { useState, useCallback } from 'react';
import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';

export interface ReaderArticle {
    title: string;
    content: string;
    textContent: string;
    byline: string;
    excerpt: string;
    siteName: string;
}

export function useReader() {
    const [article, setArticle] = useState<ReaderArticle | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const parseReader = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Fetch HTML from main process
            // @ts-ignore
            const html = await window.ipcRenderer.invoke('view:get-html');
            if (!html) {
                throw new Error('No content available');
            }

            // Parse in Renderer
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // We might need the actual URL to resolve relative links correctly
            // For now, Readability might handle some, but relative images will break without base URI
            // We can pass the URL from the store if needed, but let's try basic first.

            const reader = new Readability(doc);
            const parsed = reader.parse();

            if (parsed) {
                // Sanitize content
                const cleanContent = DOMPurify.sanitize(parsed.content || '');

                setArticle({
                    title: parsed.title || 'Untitled Article',
                    content: cleanContent,
                    textContent: parsed.textContent || '',
                    byline: parsed.byline || '',
                    excerpt: parsed.excerpt || '',
                    siteName: parsed.siteName || ''
                });
            } else {
                throw new Error('Failed to parse content');
            }
        } catch (e) {
            console.error('Reader parsing failed:', e);
            setError('Could not enter Reader Mode for this page.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clearReader = useCallback(() => {
        setArticle(null);
        setError(null);
    }, []);

    return { article, isLoading, error, parseReader, clearReader };
}
