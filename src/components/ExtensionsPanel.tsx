import { RotateCw, Plus, Trash2, Settings, PanelsTopLeft } from 'lucide-react';
import { useExtensionStore } from '../store/useExtensionStore';
import { useCallback, useRef, useEffect } from 'react';
import React from 'react';

export function ExtensionsPanel() {
    const {
        isExtensionsOpen,
        setIsExtensionsOpen,
        extensions,
        setExtensions,
        isLoadingExtensions,
        setIsLoadingExtensions,
        extensionsError,
        setExtensionsError,
        installUrl,
        setInstallUrl,
        unpackedPath,
        setUnpackedPath,
        isInstallingExtension,
        setIsInstallingExtension,
        extensionsRect,
    } = useExtensionStore();

    const panelRef = useRef<HTMLDivElement>(null);

    // Refresh extensions list
    const refreshExtensions = useCallback(async () => {
        // @ts-ignore
        if (!window.ipcRenderer?.extensions) return;
        setIsLoadingExtensions(true);
        setExtensionsError(null);
        try {
            // @ts-ignore
            const list = await window.ipcRenderer.extensions.getAll();
            setExtensions(list || []);
        } catch (err: any) {
            setExtensionsError(err?.message || 'Failed to load extensions');
        } finally {
            setIsLoadingExtensions(false);
        }
    }, [setExtensions, setIsLoadingExtensions, setExtensionsError]);

    // Load extensions when panel opens
    useEffect(() => {
        if (isExtensionsOpen) {
            refreshExtensions();
        }
    }, [isExtensionsOpen, refreshExtensions]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!isExtensionsOpen) return;
            const target = e.target as Node;
            if (panelRef.current && panelRef.current.contains(target)) return;

            // Check if clicked on extensions button by checking data attribute
            const button = document.querySelector('[data-extensions-button="true"]');
            if (button && button.contains(target)) return;

            setIsExtensionsOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isExtensionsOpen, setIsExtensionsOpen]);

    const handleInstallExtension = useCallback(async () => {
        // @ts-ignore
        if (!window.ipcRenderer?.extensions) return;
        setIsInstallingExtension(true);
        setExtensionsError(null);
        try {
            // @ts-ignore
            const res = await window.ipcRenderer.extensions.install(installUrl);
            if (res?.success === false && res?.error) {
                setExtensionsError(res.error);
            } else {
                setInstallUrl('');
                await refreshExtensions();
            }
        } catch (err: any) {
            setExtensionsError(err?.message || 'Failed to install extension');
        } finally {
            setIsInstallingExtension(false);
        }
    }, [installUrl, setIsInstallingExtension, setExtensionsError, setInstallUrl, refreshExtensions]);

    const handleLoadUnpacked = useCallback(async () => {
        // @ts-ignore
        if (!window.ipcRenderer?.extensions) return;
        try {
            // @ts-ignore
            const res = await window.ipcRenderer.extensions.loadUnpacked(unpackedPath);
            if (res?.success === false && res?.error) {
                setExtensionsError(res.error);
            } else {
                setUnpackedPath('');
                await refreshExtensions();
            }
        } catch (err: any) {
            setExtensionsError(err?.message || 'Failed to load unpacked extension');
        }
    }, [unpackedPath, setUnpackedPath, setExtensionsError, refreshExtensions]);

    const handleRemoveExtension = useCallback(async (id: string) => {
        // @ts-ignore
        if (!window.ipcRenderer?.extensions) return;
        try {
            // @ts-ignore
            const res = await window.ipcRenderer.extensions.remove(id);
            if (res?.success === false && res?.error) {
                setExtensionsError(res.error);
            } else {
                await refreshExtensions();
            }
        } catch (err: any) {
            setExtensionsError(err?.message || 'Failed to remove extension');
        }
    }, [refreshExtensions, setExtensionsError]);

    const handleOpenOptions = useCallback(async (id: string) => {
        // @ts-ignore
        if (!window.ipcRenderer?.extensions) return;
        try {
            // @ts-ignore
            const res = await window.ipcRenderer.extensions.openOptions(id);
            if (res?.success) {
                setIsExtensionsOpen(false);
            } else {
                setExtensionsError(res?.error || 'No options page available');
            }
        } catch (err: any) {
            setExtensionsError(err?.message || 'Failed to open options page');
        }
    }, [setExtensionsError, setIsExtensionsOpen]);

    const handleOpenPopup = useCallback(async (id: string) => {
        // @ts-ignore
        if (!window.ipcRenderer?.extensions) return;
        try {
            // @ts-ignore
            const res = await window.ipcRenderer.extensions.openPopup(id);
            if (!res?.success) {
                setExtensionsError(res?.error || 'No popup for this extension');
            }
        } catch (err: any) {
            setExtensionsError(err?.message || 'Failed to open popup');
        }
    }, [setExtensionsError]);

    if (!isExtensionsOpen) return null;

    return (
        <div
            ref={panelRef}
            className="fixed z-[9999] animate-slide-in-right"
            style={extensionsRect ? {
                top: extensionsRect.bottom + 8,
                right: Math.max(16, window.innerWidth - extensionsRect.right - 10),
                width: 360,
                maxHeight: 'calc(100vh - 120px)',
            } : {
                top: 80,
                right: 16,
                width: 360,
                maxHeight: 'calc(100vh - 120px)',
            }}
        >
            <div className="glass-deep p-3 space-y-3 rounded-2xl" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">Extensions</div>
                    <div className="flex items-center space-x-1">
                        <button
                            onClick={() => refreshExtensions()}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                            title="Refresh extensions"
                        >
                            <RotateCw className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex space-x-2">
                        <input
                            value={installUrl}
                            onChange={(e) => setInstallUrl(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
                            placeholder="Chrome Web Store URL or .crx link"
                        />
                        <button
                            onClick={handleInstallExtension}
                            disabled={isInstallingExtension || !installUrl.trim()}
                            className="px-3 py-2 bg-primary/20 text-primary rounded-lg text-sm flex items-center space-x-1 hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Install from URL"
                        >
                            <Plus className="w-4 h-4" strokeWidth={1.5} />
                            <span>{isInstallingExtension ? 'Installing' : 'Install'}</span>
                        </button>
                    </div>
                    <div className="flex space-x-2">
                        <input
                            value={unpackedPath}
                            onChange={(e) => setUnpackedPath(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
                            placeholder="/path/to/unpacked/extension"
                        />
                        <button
                            onClick={handleLoadUnpacked}
                            disabled={!unpackedPath.trim()}
                            className="px-3 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Load unpacked folder"
                        >
                            Load
                        </button>
                    </div>
                </div>

                <div className="border-t border-white/5 pt-2 max-h-60 overflow-y-auto space-y-2">
                    {extensionsError && (
                        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1">
                            {extensionsError}
                        </div>
                    )}
                    {isLoadingExtensions && (
                        <div className="text-xs text-muted-foreground">Loading extensions...</div>
                    )}
                    {!isLoadingExtensions && extensions.length === 0 && !extensionsError && (
                        <div className="text-xs text-muted-foreground">No extensions installed yet.</div>
                    )}
                    {extensions.map(ext => (
                        <div key={ext.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                            <div className="flex flex-col">
                                <span className="text-sm text-white">{ext.name}</span>
                                <span className="text-xs text-muted-foreground">{ext.version} · {ext.id.slice(0, 8)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={() => handleOpenPopup(ext.id)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                                    title="Open extension popup"
                                >
                                    <PanelsTopLeft className="w-4 h-4" strokeWidth={1.5} />
                                </button>
                                <button
                                    onClick={() => handleOpenOptions(ext.id)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                                    title="Open extension settings"
                                >
                                    <Settings className="w-4 h-4" strokeWidth={1.5} />
                                </button>
                                <button
                                    onClick={() => handleRemoveExtension(ext.id)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Remove extension"
                                >
                                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
