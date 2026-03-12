import { DownloadItem } from '../hooks/useDownloads';
import { Pause, Play, X, Folder, File as FileIcon, CheckCircle, Download as DownloadIcon } from 'lucide-react';
import { useRef, useEffect } from 'react';

interface DownloadManagerProps {
    downloads: DownloadItem[];
    isOpen: boolean;
    onClose: () => void;
    rect: DOMRect | null;
    onPause: (id: string) => void;
    onResume: (id: string) => void;
    onCancel: (id: string) => void;
    onShowInFolder: (id: string) => void;
    onClear: (id: string) => void;
    isPopup?: boolean;
}

export function DownloadManager({
    downloads,
    isOpen,
    onClose,
    rect,
    onPause,
    onResume,
    onCancel,
    onShowInFolder,
    onClear,
    isPopup
}: DownloadManagerProps) {
    const ref = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if ((!isOpen && !isPopup) || (!rect && !isPopup)) return null;

    const content = (
        <div
            ref={ref} // Ref needed for click outside? In popup mode, window blur handles it.
            className={`download-panel ${isPopup ? 'w-full h-full' : 'fixed z-[101] w-80 animate-slide-in-right'} glass-deep rounded-2xl overflow-hidden text-foreground`}
            style={isPopup ? undefined : { top: rect!.bottom + 8, left: rect!.right - 320 }}
        >
            <div className="p-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Downloads</span>
                <span className="text-xs text-muted-foreground">{downloads.length} items</span>
            </div>

            <div className={`overflow-y-auto ${isPopup ? 'h-[calc(100vh-48px)]' : 'max-h-[300px]'}`}>
                {downloads.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                        <DownloadIcon className="w-8 h-8 opacity-20" />
                        <span>No downloads</span>
                    </div>
                ) : (
                    downloads.map(item => (
                        <DownloadItemRow
                            key={item.id}
                            item={item}
                            onPause={onPause}
                            onResume={onResume}
                            onCancel={onCancel}
                            onShowInFolder={onShowInFolder}
                            onClear={onClear}
                        />
                    ))
                )}
            </div>
        </div>
    );

    return content;
}

function DownloadItemRow({
    item,
    onPause,
    onResume,
    onCancel,
    onShowInFolder,
    onClear
}: {
    item: DownloadItem;
    onPause: (id: string) => void;
    onResume: (id: string) => void;
    onCancel: (id: string) => void;
    onShowInFolder: (id: string) => void;
    onClear: (id: string) => void;
}) {
    const formatBytes = (bytes: any) => {
        try {
            const num = Number(bytes);
            if (isNaN(num) || num === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(num) / Math.log(k));
            return parseFloat((num / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        } catch {
            return '0 B';
        }
    };

    const progress = item.totalBytes > 0 ? (item.receivedBytes / item.totalBytes) * 100 : 0;
    const isCompleted = item.state === 'completed';
    const isPaused = item.state === 'paused';
    const isCancelled = item.state === 'cancelled' || item.state === 'interrupted';

    return (
        <div className="p-3 border-b border-border/50 list-item-hover group">
            <div className="flex items-start justify-between gap-3">
                <div className="p-2 bg-muted rounded-md text-muted-foreground">
                    <FileIcon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <div
                            className="text-sm font-medium truncate cursor-pointer hover:underline"
                            title={typeof item.filename === 'string' ? item.filename : String(item.filename || '')}
                            onClick={() => isCompleted && onShowInFolder(item.id)}
                        >
                            {typeof item.filename === 'string' ? item.filename : String(item.filename || '')}
                        </div>
                        {isCompleted && <CheckCircle className="w-3 h-3 text-green-500" />}
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-2 mb-1.5">
                        <span>{formatBytes(item.receivedBytes)} / {item.totalBytes > 0 ? formatBytes(item.totalBytes) : 'Unknown'}</span>
                        {item.state === 'progressing' && <span>• {Math.round(progress)}%</span>}
                        {item.state === 'paused' && <span className="text-yellow-500">• Paused</span>}
                        {item.state === 'cancelled' && <span className="text-red-500">• Cancelled</span>}
                    </div>

                    {/* Progress Bar */}
                    {!isCompleted && !isCancelled && (
                        <div className="h-1 bg-muted rounded-full overflow-hidden w-full">
                            <div
                                className={`h-full transition-all duration-300 ${isPaused ? 'bg-yellow-500' : 'bg-primary'}`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isCompleted && !isCancelled && (
                        <>
                            {isPaused ? (
                                <button onClick={() => onResume(item.id)} className="p-1.5 hover:bg-muted rounded text-foreground" title="Resume">
                                    <Play className="w-3.5 h-3.5" />
                                </button>
                            ) : (
                                <button onClick={() => onPause(item.id)} className="p-1.5 hover:bg-muted rounded text-foreground" title="Pause">
                                    <Pause className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <button onClick={() => onCancel(item.id)} className="p-1.5 hover:bg-muted rounded text-foreground" title="Cancel">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </>
                    )}

                    {isCompleted && (
                        <button onClick={() => onShowInFolder(item.id)} className="p-1.5 hover:bg-muted rounded text-foreground" title="Show in Folder">
                            <Folder className="w-3.5 h-3.5" />
                        </button>
                    )}

                    {(isCompleted || isCancelled) && (
                        <button onClick={() => onClear(item.id)} className="p-1.5 hover:bg-muted rounded text-foreground" title="Remove from list">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
