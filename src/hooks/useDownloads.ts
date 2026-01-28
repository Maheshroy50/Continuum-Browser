import { useState, useEffect } from 'react';

export interface DownloadItem {
    id: string;
    filename: string;
    path: string;
    totalBytes: number;
    receivedBytes: number;
    state: 'progressing' | 'completed' | 'cancelled' | 'interrupted' | 'paused';
    startTime: number; // useful for sorting
}

export function useDownloads() {
    const [downloads, setDownloads] = useState<DownloadItem[]>([]);
    const [recentDownload, setRecentDownload] = useState<string | null>(null); // ID of most recent download for UI popover

    useEffect(() => {
        // Load initial state if any (though downloads are usually transient in this session unless persisted)
        // For now, we start empty or could fetch active ones

        // Listeners
        const handleStart = (data: DownloadItem) => {
            setDownloads(prev => {
                const exists = prev.find(d => d.id === data.id);
                if (exists) return prev;
                return [data, ...prev];
            });
            setRecentDownload(data.id);
        };

        const handleProgress = (data: DownloadItem) => {
            setDownloads(prev => prev.map(d => d.id === data.id ? data : d));
        };

        const handleComplete = (data: DownloadItem) => {
            setDownloads(prev => prev.map(d => d.id === data.id ? data : d));
            // Maybe auto-clear completed after a while? For now keep them.
        };

        // @ts-ignore
        const removeStart = window.ipcRenderer?.downloads?.onStart?.(handleStart);
        // @ts-ignore
        const removeProgress = window.ipcRenderer?.downloads?.onProgress?.(handleProgress);
        // @ts-ignore
        const removeComplete = window.ipcRenderer?.downloads?.onComplete?.(handleComplete);

        return () => {
            if (typeof removeStart === 'function') removeStart();
            if (typeof removeProgress === 'function') removeProgress();
            if (typeof removeComplete === 'function') removeComplete();
        };
    }, []);

    // Actions
    const pause = (id: string) => {
        // @ts-ignore
        window.ipcRenderer?.downloads?.pause(id);
    };

    const resume = (id: string) => {
        // @ts-ignore
        window.ipcRenderer?.downloads?.resume(id);
    };

    const cancel = (id: string) => {
        // @ts-ignore
        window.ipcRenderer?.downloads?.cancel(id);
    };

    const showInFolder = (id: string) => {
        // @ts-ignore
        window.ipcRenderer?.downloads?.showInFolder(id);
    };

    const clearDownload = (id: string) => {
        setDownloads(prev => prev.filter(d => d.id !== id));
    };

    return {
        downloads,
        recentDownload,
        setRecentDownload, // to clear the "new" flag
        pause,
        resume,
        cancel,
        showInFolder,
        clearDownload
    };
}
