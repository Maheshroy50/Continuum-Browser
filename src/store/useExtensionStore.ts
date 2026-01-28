import { create } from 'zustand';

export interface InstalledExtension {
    id: string;
    name: string;
    version: string;
    path: string;
}

interface ExtensionStore {
    // Panel state
    isExtensionsOpen: boolean;
    setIsExtensionsOpen: (open: boolean) => void;
    
    // Extensions data
    extensions: InstalledExtension[];
    setExtensions: (extensions: InstalledExtension[]) => void;
    
    // UI state
    isLoadingExtensions: boolean;
    setIsLoadingExtensions: (loading: boolean) => void;
    
    extensionsError: string | null;
    setExtensionsError: (error: string | null) => void;
    
    // Form inputs
    installUrl: string;
    setInstallUrl: (url: string) => void;
    
    unpackedPath: string;
    setUnpackedPath: (path: string) => void;
    
    isInstallingExtension: boolean;
    setIsInstallingExtension: (installing: boolean) => void;
    
    // Panel position
    extensionsRect: DOMRect | null;
    setExtensionsRect: (rect: DOMRect | null) => void;
}

export const useExtensionStore = create<ExtensionStore>((set) => ({
    // Panel state
    isExtensionsOpen: false,
    setIsExtensionsOpen: (open) => set({ isExtensionsOpen: open }),
    
    // Extensions data
    extensions: [],
    setExtensions: (extensions) => set({ extensions }),
    
    // UI state
    isLoadingExtensions: false,
    setIsLoadingExtensions: (loading) => set({ isLoadingExtensions: loading }),
    
    extensionsError: null,
    setExtensionsError: (error) => set({ extensionsError: error }),
    
    // Form inputs
    installUrl: '',
    setInstallUrl: (url) => set({ installUrl: url }),
    
    unpackedPath: '',
    setUnpackedPath: (path) => set({ unpackedPath: path }),
    
    isInstallingExtension: false,
    setIsInstallingExtension: (installing) => set({ isInstallingExtension: installing }),
    
    // Panel position
    extensionsRect: null,
    setExtensionsRect: (rect) => set({ extensionsRect: rect }),
}));
