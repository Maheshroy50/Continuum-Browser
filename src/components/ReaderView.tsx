import { useEffect } from 'react';
import { X, AlignLeft } from 'lucide-react';
import { ReaderArticle } from '../hooks/useReader';

interface ReaderViewProps {
    article: ReaderArticle | null;
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    error: string | null;
}

export function ReaderView({ article, isOpen, onClose, isLoading, error }: ReaderViewProps) {

    // Prevent scrolling parent when reader is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
            // Also ensure view is shown again just in case
            // @ts-ignore
            if (window.ipcRenderer?.views) window.ipcRenderer.views.show();
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // Hide browser view when Reader is open
    useEffect(() => {
        if (isOpen && !isLoading) {
            // @ts-ignore
            if (window.ipcRenderer?.views) window.ipcRenderer.views.hide();
        }
    }, [isOpen, isLoading]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-40 bg-background flex flex-col items-center animate-in fade-in duration-200">
            {/* Toolbar */}
            <div className="w-full max-w-3xl px-6 py-4 flex items-center justify-between border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-50">
                <div className="flex items-center space-x-2 text-muted-foreground">
                    <AlignLeft className="w-5 h-5" />
                    <span className="font-medium text-sm">Reader View</span>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-5 h-5" />
                        <span className="sr-only">Close</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 w-full overflow-y-auto px-6 py-10">
                <main className="max-w-2xl mx-auto pb-20">
                    {isLoading ? (
                        <div className="space-y-6 animate-pulse">
                            <div className="h-12 bg-muted rounded-lg w-3/4"></div>
                            <div className="h-6 bg-muted/60 rounded w-1/4 mb-10"></div>
                            <div className="space-y-4">
                                <div className="h-4 bg-muted/40 rounded w-full"></div>
                                <div className="h-4 bg-muted/40 rounded w-full"></div>
                                <div className="h-4 bg-muted/40 rounded w-5/6"></div>
                                <div className="h-4 bg-muted/40 rounded w-full"></div>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-20">
                            <p className="text-muted-foreground mb-4">{error}</p>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
                            >
                                Return to Page
                            </button>
                        </div>
                    ) : article ? (
                        <article className="prose dark:prose-invert prose-lg max-w-none">
                            <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground">{article.title}</h1>
                            {article.byline && (
                                <div className="text-muted-foreground text-sm mb-8 pb-4 border-b border-border">
                                    By {article.byline} • {article.siteName}
                                </div>
                            )}
                            <div
                                className="leading-relaxed text-foreground/90 font-serif"
                                dangerouslySetInnerHTML={{ __html: article.content }}
                            />
                        </article>
                    ) : null}
                </main>
            </div>
        </div>
    );
}
